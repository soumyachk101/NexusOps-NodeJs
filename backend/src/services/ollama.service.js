const { config } = require('../lib/config');
const { ChatPromptTemplate } = require('@langchain/core/prompts');

let chatModel;
let embeddingModel;

/**
 * Get a ChatGroq-compatible Ollama chat model via LangChain.
 * Falls back to Groq if Ollama is unavailable.
 */
async function getOllamaChatModel(overrides = {}) {
  const baseUrl = overrides.baseUrl || config.OLLAMA_BASE_URL;
  const model = overrides.model || config.OLLAMA_MODEL || 'llama3.3:70b';

  if (chatModel && !overrides.baseUrl) return chatModel;

  try {
    const { ChatOllama } = require('@langchain/community/chat_models/ollama');
    const instance = new ChatOllama({
      baseUrl: baseUrl,
      model: model,
      temperature: 0.2,
    });

    // Verify Ollama is reachable
    const testResponse = await instance.invoke([['human', 'ping']]);
    if (!testResponse) throw new Error('No response');

    chatModel = instance;
    console.log(`[Ollama] Connected to ${baseUrl} with model ${model}`);
    return instance;
  } catch (err) {
    console.warn(`[Ollama] Unavailable at ${baseUrl}: ${err.message}. Using Groq fallback.`);
    const { ChatGroq } = require('@langchain/groq');
    const fallback = new ChatGroq({
      apiKey: config.GROQ_API_KEY,
      model: overrides.groqModel || config.GROQ_MODEL || 'llama-3.3-70b-versatile',
      temperature: 0.2,
    });
    return fallback;
  }
}

/**
 * Get Ollama embeddings model.
 */
async function getOllamaEmbeddings(overrides = {}) {
  const baseUrl = overrides.baseUrl || config.OLLAMA_BASE_URL;
  const model = overrides.model || 'nomic-embed-text';

  if (embeddingModel && !overrides.baseUrl) return embeddingModel;

  try {
    const { OllamaEmbeddings } = require('@langchain/community/embeddings/ollama');
    const instance = new OllamaEmbeddings({
      baseUrl: baseUrl,
      model: model,
    });

    // Test embeddings
    const test = await instance.embedQuery('test');
    if (!test || test.length === 0) throw new Error('No embeddings');

    embeddingModel = instance;
    console.log(`[Ollama] Embeddings connected with model ${model}`);
    return instance;
  } catch (err) {
    console.warn(`[Ollama] Embeddings unavailable: ${err.message}. Using OpenAI fallback.`);
    const { OpenAIEmbeddings } = require('@langchain/openai');
    return new OpenAIEmbeddings({
      openAIApiKey: config.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small',
    });
  }
}

/**
 * Invoke Ollama with automatic Groq fallback.
 */
async function invokeWithFallback(prompt, variables, options = {}) {
  const model = await getOllamaChatModel(options);

  const chatPrompt = ChatPromptTemplate.fromMessages([
    ['system', prompt],
    ['human', '{input}'],
  ]);

  const chain = chatPrompt.pipe(model);
  const result = await chain.invoke({ input: variables.input || '' });
  return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
}

/**
 * Generate a chat completion (OpenAI-compatible).
 * Supports streaming for longer responses.
 */
async function chatCompletion(messages, options = {}) {
  const model = await getOllamaChatModel(options);

  const { ChatPromptTemplate } = require('@langchain/core/prompts');
  const formattedMessages = messages.map((m) => [m.role, m.content]);
  const prompt = ChatPromptTemplate.fromMessages(formattedMessages);

  const chain = prompt.pipe(model);
  const result = await chain.invoke({});
  return result.content;
}

/**
 * Check Ollama health and list available models.
 */
async function checkHealth() {
  const baseUrl = config.OLLAMA_BASE_URL;
  const http = require('http');

  return new Promise((resolve) => {
    const req = http.get(`${baseUrl}/api/tags`, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            available: true,
            baseUrl,
            models: (parsed.models || []).map((m) => m.name),
          });
        } catch {
          resolve({ available: false, baseUrl, error: 'Invalid response' });
        }
      });
    });
    req.on('error', () => resolve({ available: false, baseUrl, error: 'Connection refused' }));
    req.on('timeout', () => { req.destroy(); resolve({ available: false, baseUrl, error: 'Timeout' }); });
  });
}

/**
 * Pull a model in Ollama.
 */
async function pullModel(modelName) {
  const baseUrl = config.OLLAMA_BASE_URL;
  const http = require('http');

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ name: modelName });
    const req = http.request({
      hostname: new URL(baseUrl).hostname,
      port: new URL(baseUrl).port || 11434,
      path: '/api/pull',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 300000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: 'completed', model: modelName, response: data }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = {
  getOllamaChatModel,
  getOllamaEmbeddings,
  invokeWithFallback,
  chatCompletion,
  checkHealth,
  pullModel,
};
