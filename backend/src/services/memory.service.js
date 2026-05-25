const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const OpenAI = require('openai');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { ChatGroq } = require('@langchain/groq');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { prisma } = require('../lib/prisma');
const { config } = require('../lib/config');
const { AppError } = require('../lib/http');
const { embedDocuments, insertChunkWithEmbedding, similaritySearch } = require('./vector.service');
const storageService = require('./storage.service');
const otelService = require('./otel.service');
const decayService = require('./memory-decay.service');

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150,
  separators: ['\n\n', '\n', '. ', '! ', '? ', ' '],
});

const AUDIO_MIMES = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/webm',
  'audio/flac', 'audio/x-flac', 'video/mp4', 'video/webm',
]);

const AUDIO_EXTS = new Set(['.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.webm', '.flac', '.mpeg']);

function isAudioFile(file) {
  if (AUDIO_MIMES.has(file.mimetype)) return true;
  const ext = path.extname(file.originalname || '').toLowerCase();
  return AUDIO_EXTS.has(ext);
}

function getOpenAIClient() {
  if (!config.OPENAI_API_KEY) return null;
  return new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_BASE_URL,
  });
}

async function transcribeAudio(filePath, originalName) {
  const client = getOpenAIClient();
  if (!client) throw new AppError(503, 'OPENAI_API_KEY required for audio transcription');

  const fileStream = fsSync.createReadStream(filePath);
  const ext = path.extname(originalName || '.mp3').toLowerCase() || '.mp3';
  fileStream.path = `audio${ext}`;

  const result = await client.audio.transcriptions.create({
    file: fileStream,
    model: 'whisper-1',
    response_format: 'text',
  });
  return typeof result === 'string' ? result : result.text || '';
}

async function extractTextFromFile(file) {
  let buffer = file.buffer;
  let tempFilePath = null;

  if (!buffer && file.path) {
    buffer = await fs.readFile(file.path);
  }

  if (!buffer) {
    throw new AppError(400, 'No file content available');
  }

  const name = (file.originalname || '').toLowerCase();

  if (file.mimetype === 'application/pdf' || name.endsWith('.pdf')) {
    const parsed = await pdf(buffer);
    return parsed.text;
  }

  if (
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || name.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (isAudioFile(file)) {
    let audioPath = file.path;
    if (!audioPath && file.buffer) {
      const tempDir = path.join(process.cwd(), 'uploads', 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      const ext = path.extname(file.originalname || '.mp3').toLowerCase() || '.mp3';
      tempFilePath = path.join(tempDir, `temp-${Date.now()}${ext}`);
      await fs.writeFile(tempFilePath, file.buffer);
      audioPath = tempFilePath;
    }

    try {
      const text = await transcribeAudio(audioPath, file.originalname);
      return text;
    } finally {
      if (tempFilePath) {
        await fs.unlink(tempFilePath).catch(() => null);
      }
    }
  }

  return buffer.toString('utf8');
}

async function createSource({ workspaceId, name, sourceType = 'document', metadata = {}, content, fileUrl }) {
  return prisma.source.create({
    data: {
      workspace_id: workspaceId,
      name,
      source_type: sourceType,
      status: content ? 'processing' : 'pending',
      metadata,
      file_url: fileUrl || null,
    },
  });
}

async function detectAndSaveTasks(workspaceId, sourceId, chunks) {
  if (!config.GROQ_API_KEY || chunks.length === 0) return [];

  const sampleText = chunks.slice(0, 10).map((c) => c.pageContent).join('\n\n').slice(0, 3000);

  const llm = new ChatGroq({ apiKey: config.GROQ_API_KEY, model: config.GROQ_MODEL });
  const prompt = ChatPromptTemplate.fromTemplate(`
Extract action items and decisions from this team discussion. Return ONLY valid JSON array:
[{{"title":"...", "description":"...", "priority":"low|medium|high", "assignee_hint":"name or null", "deadline_hint":"date string or null"}}]
Return [] if no action items found.

Text:
{text}
`);

  let tasks = [];
  try {
    const chain = prompt.pipe(llm);
    const response = await chain.invoke({ text: sampleText });
    const content = response.content || '';
    const match = content.match(/\[[\s\S]*\]/);
    if (match) tasks = JSON.parse(match[0]);
  } catch (_) {
    return [];
  }

  if (!Array.isArray(tasks) || tasks.length === 0) return [];

  const chunkRecord = await prisma.documentChunk.findFirst({
    where: { source_id: sourceId },
    select: { id: true, text: true },
  });

  const saved = await Promise.all(
    tasks.slice(0, 10).map((t) =>
      prisma.task.create({
        data: {
          workspace_id: workspaceId,
          title: String(t.title || '').slice(0, 500),
          description: t.description || null,
          priority: ['low', 'medium', 'high', 'critical'].includes(t.priority) ? t.priority : 'medium',
          assignee_hint: t.assignee_hint || null,
          deadline_hint: t.deadline_hint || null,
          source_chunk_id: chunkRecord?.id || null,
          source_preview: chunkRecord?.text?.slice(0, 200) || null,
          status: 'detected',
        },
      }).catch(() => null),
    ),
  );

  return saved.filter(Boolean);
}

async function ingestText({ workspaceId, name, sourceType = 'document', text, metadata = {}, detectTasks = false, fileUrl }) {
  if (!text || !text.trim()) throw new AppError(400, 'No text content found to ingest');

  return otelService.traceIngestion(workspaceId, sourceType, async () => {
  const source = await createSource({ workspaceId, name, sourceType, metadata, content: text, fileUrl });

  try {
    const docs = await splitter.createDocuments([text], [{
      ...metadata,
      workspace_id: workspaceId,
      source_id: source.id,
      source_type: sourceType,
    }]);
    const texts = docs.map((doc) => doc.pageContent);
    const embeddings = await embedDocuments(texts);

    for (let index = 0; index < docs.length; index += 1) {
      await insertChunkWithEmbedding({
        workspaceId,
        sourceId: source.id,
        chunkIndex: index,
        text: docs[index].pageContent,
        embedding: embeddings[index],
        metadata: docs[index].metadata,
      });
    }

    if (detectTasks) {
      await detectAndSaveTasks(workspaceId, source.id, docs).catch(() => null);
    }

    await prisma.activityLog.create({
      data: {
        workspace_id: workspaceId,
        module: 'memory',
        action: 'source_ingested',
        resource_type: sourceType,
        resource_id: source.id,
        metadata: { name, chunks: docs.length },
      },
    }).catch(() => null);

    return prisma.source.update({
      where: { id: source.id },
      data: { status: 'processed', processed_at: new Date() },
    });
  } catch (error) {
    await prisma.source.update({
      where: { id: source.id },
      data: { status: 'failed', error_message: error.message },
    });
    throw error;
  }
  });
}

async function ingestFile({ workspaceId, file, metadata = {} }) {
  const audioFile = isAudioFile(file);
  const fileName = (file.originalname || '').toLowerCase();
  const inferredType = fileName.endsWith('.md') || fileName.endsWith('.markdown') ? 'markdown' : 'document';
  const sourceType = audioFile ? 'voice' : (metadata.source_type || metadata.sourceType || inferredType);
  
  const text = await extractTextFromFile(file);
  const fileUrl = await storageService.uploadFile(file, sourceType).catch((err) => {
    console.warn('Storage upload failed, continuing with text only:', err.message);
    return null;
  });

  const result = await ingestText({
    workspaceId,
    name: file.originalname,
    sourceType,
    text,
    fileUrl,
    metadata: { ...metadata, original_name: file.originalname, mimetype: file.mimetype, size: file.size },
    detectTasks: metadata.detect_tasks !== false && metadata.detectTasks !== false,
  });

  // Clean up local file after successful ingestion
  if (file.path) {
    fs.unlink(file.path).catch(() => null);
  }

  return result;
}

async function ingestIncidentMemory({ workspaceId, incidentId, analysis, fix, memoryContext }) {
  const parts = [
    `INCIDENT ANALYSIS — ${new Date().toISOString()}`,
    analysis.root_cause ? `Root Cause: ${analysis.root_cause}` : '',
    analysis.explanation ? `Explanation: ${analysis.explanation}` : '',
    Array.isArray(analysis.affected_files) && analysis.affected_files.length
      ? `Files: ${analysis.affected_files.join(', ')}`
      : '',
    fix.title ? `Fix: ${fix.title}` : '',
    fix.explanation ? `Fix Explanation: ${fix.explanation}` : '',
  ].filter(Boolean).join('\n');

  if (!parts.trim()) return null;

  return ingestText({
    workspaceId,
    name: `Incident #${incidentId} — AI Analysis`,
    sourceType: 'incident',
    text: parts,
    metadata: {
      source_type: 'incident',
      incident_id: incidentId,
      safety_score: fix.safety_score,
    },
  }).catch(() => null);
}

async function answerWithGroq(question, chunks) {
  if (!chunks.length) return "I couldn't find this in your team's records.";

  if (!config.GROQ_API_KEY) {
    const preview = chunks[0].text.slice(0, 350);
    return `I found relevant context, but GROQ_API_KEY is not configured. Top match: ${preview}`;
  }

  const llm = new ChatGroq({ apiKey: config.GROQ_API_KEY, model: config.GROQ_MODEL });
  const prompt = ChatPromptTemplate.fromTemplate(`
You are NexusOps Memory, an intelligent knowledge assistant for engineering teams.
Answer based only on the provided context. If the answer is not present, say: "I couldn't find this in your team's records."
Cite sources compactly when possible.

Context:
{context}

Question: {question}
`);

  const chain = prompt.pipe(llm);
  const response = await chain.invoke({
    question,
    context: chunks.map((chunk, index) => `[${index + 1}] ${chunk.text}`).join('\n\n'),
  });

  return response.content || String(response);
}

async function queryMemory({ workspaceId, question, userId }) {
  const startedAt = Date.now();
  return otelService.traceMemoryQuery(workspaceId, question, async () => {
    try {
      const chunks = await similaritySearch(workspaceId, question, 12);
      const reranked = decayService.rerankResults(chunks);
      const filtered = reranked.filter((chunk) => !chunk.effective_score || chunk.effective_score >= 0.3).slice(0, 5);
      const answer = await answerWithGroq(question, filtered);

    const sources = filtered.slice(0, 3).map((chunk) => ({
      id: chunk.id,
      source_id: chunk.source_id,
      content: chunk.text,
      text: chunk.text,
      metadata: chunk.metadata || {},
      score: chunk.score,
    }));

    await Promise.all([
      prisma.queryHistory.create({
        data: {
          workspace_id: workspaceId,
          user_id: userId || null,
          question,
          answer,
          sources,
          latency_ms: Date.now() - startedAt,
          model_used: config.GROQ_MODEL,
        },
      }),
      prisma.activityLog.create({
        data: {
          workspace_id: workspaceId,
          user_id: userId || null,
          module: 'memory',
          action: 'memory_query',
          resource_type: 'query',
          metadata: { question, answer_preview: answer.slice(0, 100), latency_ms: Date.now() - startedAt },
        },
      }),
    ]).catch((err) => console.error('[Memory Service] History/Log creation failed:', err.message));

    return { answer, sources };
    } catch (error) {
      console.error('[Memory Service] queryMemory error:', error);
      return {
        answer: "I encountered an error while searching your team's memory. This might be due to a service outage or configuration issue. Please try again later.",
        sources: [],
      };
    }
  });
}

module.exports = {
  createSource,
  ingestFile,
  ingestText,
  ingestIncidentMemory,
  queryMemory,
  similaritySearch,
  detectAndSaveTasks,
};
