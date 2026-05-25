const { ChatGroq } = require('@langchain/groq');
const { ChatPromptTemplate } = require('@langchain/core/prompts');
const { prisma } = require('../lib/prisma');
const { config } = require('../lib/config');
const { extractJsonObject } = require('../utils/json');
const { similaritySearch, ingestIncidentMemory } = require('./memory.service');
const githubService = require('./github.service');
const confidenceService = require('./confidence.service');
const otelService = require('./otel.service');
const notificationService = require('./notification.service');

const SECRET_PATTERNS = [
  { name: 'jwt', pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { name: 'api_key', pattern: /\b(?:sk|pk|ghp|github_pat|xoxb|xoxp|AKIA)[A-Za-z0-9_\-]{16,}\b/g },
  { name: 'database_url', pattern: /\b(?:postgres|mysql|mongodb|redis):\/\/[^\s]+/gi },
  { name: 'email', pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { name: 'ipv4', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { name: 'password_assignment', pattern: /(password|passwd|pwd|secret|token)\s*[:=]\s*["']?[^"'\s]+/gi },
];

const DANGEROUS_PATTERNS = [
  /rm\s+-rf/,
  /child_process/,
  /execSync/,
  /eval\s*\(/,
  /new Function\s*\(/,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
  /process\.env\s*=/,
  /chmod\s+/,
  /chown\s+/,
  /mkfifo\s+/,
  /shred\s+/,
  /wget\s+/,
  /curl\s+.*\s*\|\s*sh/,
];

function sanitizeText(value) {
  let text = String(value || '');
  const replacements = [];

  for (const item of SECRET_PATTERNS) {
    const before = text;
    text = text.replace(item.pattern, `[REDACTED_${item.name.toUpperCase()}]`);
    if (before !== text) replacements.push(item.name);
  }

  return { text, replacements };
}

function parseStackFiles(stackTrace) {
  const text = String(stackTrace || '');
  const matches = new Set();
  const patterns = [
    /\(([^():\s]+\.(?:js|ts|jsx|tsx|py|java|go|rb)):(\d+):?(\d+)?\)/g,
    /\bat\s+([^():\s]+\.(?:js|ts|jsx|tsx|py|java|go|rb)):(\d+):?(\d+)?/g,
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(text);
    while (match) {
      matches.add(match[1]);
      match = pattern.exec(text);
    }
  }

  return Array.from(matches).slice(0, 8);
}

async function invokeJson(promptTemplate, input, fallback) {
  if (!config.GROQ_API_KEY) return fallback;

  const llm = new ChatGroq({
    apiKey: config.GROQ_API_KEY,
    model: config.GROQ_MODEL,
  });
  const chain = ChatPromptTemplate.fromTemplate(promptTemplate).pipe(llm);
  const response = await chain.invoke(input);
  return extractJsonObject(response.content, fallback);
}

async function analyzeIncident(incident) {
  const fallbackFiles = parseStackFiles(incident.sanitized_stack_trace || incident.stack_trace);
  const fallback = {
    root_cause: 'The incident needs human review. Automated analysis could not be completed.',
    explanation: incident.sanitized_error || incident.error_message || 'No error details provided.',
    affected_files: fallbackFiles,
    keywords: [
      incident.error_type,
      ...String(incident.error_message || '').split(/\s+/).slice(0, 4),
      ...fallbackFiles.map((file) => file.split('/').pop()),
    ].filter(Boolean).slice(0, 8),
    confidence: 0.35,
  };

  return invokeJson(`
Analyze this production incident and return ONLY valid JSON:
{{
  "root_cause": "short root cause",
  "explanation": "detailed but concise explanation",
  "affected_files": ["path/from/stack.js"],
  "keywords": ["keyword"],
  "confidence": 0.0
}}

Error type: {errorType}
Error: {error}
Stack trace: {stackTrace}
`, {
    errorType: incident.error_type || 'Unknown',
    error: incident.sanitized_error || incident.error_message || '',
    stackTrace: incident.sanitized_stack_trace || incident.stack_trace || '',
  }, fallback);
}

async function buildMemoryContext(incident, analysis) {
  const affectedFiles = Array.isArray(analysis.affected_files) ? analysis.affected_files : [];
  const query = [...(analysis.keywords || []), ...affectedFiles.map((file) => String(file).split('/').pop())]
    .filter(Boolean)
    .join(' ');

  if (!query.trim()) {
    return {
      related_discussions: [],
      query: '',
      matches_found: 0,
      insight: 'No memory query could be built from the incident analysis.',
    };
  }

  const matches = await similaritySearch(incident.workspace_id, query, 3).catch(() => []);
  const contextText = matches.map((m, i) => `[Discussion ${i + 1}]: ${m.text}`).join('\n\n');
  
  let insight = 'No related team discussions found in memory.';
  if (matches.length > 0) {
    const summary = await invokeJson(`
      Summarize how these team discussions relate to the current incident: {error}.
      Return ONLY a JSON object: {{"summary": "1-2 sentence summary"}}
      
      Discussions:
      {context}
    `, { error: incident.error_message, context: contextText }, { summary: `Found ${matches.length} related discussions.` });
    insight = summary.summary;
  }

  return {
    related_discussions: matches.map((match) => match.text.slice(0, 500)),
    query,
    matches_found: matches.length,
    insight,
  };
}

async function fetchRepoFileContents(incident, affectedFiles) {
  if (!incident.repository || !affectedFiles.length) return {};
  const token = incident.repository.github_token || config.GITHUB_TOKEN;
  if (!token || !incident.repository.full_name) return {};
  return githubService.fetchMultipleFiles(incident.repository.full_name, affectedFiles, token).catch(() => ({}));
}

async function generateFix(incident, analysis, memoryContext, fileContents = {}) {
  const fileContext = Object.entries(fileContents)
    .filter(([, v]) => v !== null)
    .map(([p, code]) => `File: ${p}\n\`\`\`\n${code.slice(0, 800)}\n\`\`\``)
    .join('\n\n');

  const fallback = {
    title: `Review fix for ${incident.error_type || 'incident'}`,
    explanation: 'NexusOps generated a safe review stub. Add repository context to produce a concrete patch.',
    diff: '',
    confidence: fileContext ? 0.55 : 0.4,
    file_changes: [],
    caveats: fileContext ? [] : ['No source file contents were fetched.'],
  };

  return invokeJson(`
You are generating a safe proposed fix for a production incident.
Return ONLY valid JSON:
{{
  "title": "short title",
  "explanation": "what should change and why",
  "diff": "unified diff if possible, otherwise empty string",
  "confidence": 0.0,
  "file_changes": [{{"path":"...", "original_code":"...", "fixed_code":"...", "change_summary":"..."}}],
  "caveats": ["..."]
}}

Incident error: {error}
Analysis: {analysis}
Team memory: {memory}
Source files: {files}
`, {
    error: incident.sanitized_error || incident.error_message || '',
    analysis: JSON.stringify(analysis),
    memory: JSON.stringify(memoryContext),
    files: fileContext || 'Not available',
  }, fallback);
}

function safetyCheck(fix) {
  const body = [
    fix.diff,
    JSON.stringify(fix.file_changes || []),
    fix.explanation,
  ].join('\n');
  const issues = DANGEROUS_PATTERNS
    .filter((pattern) => pattern.test(body))
    .map((pattern) => ({ type: 'dangerous_pattern', pattern: pattern.toString() }));

  return {
    safety_score: issues.length ? 'REVIEW_REQUIRED' : 'SAFE',
    safety_issues: issues,
  };
}

async function setIncidentStatus(id, status, data = {}) {
  return prisma.incident.update({
    where: { id },
    data: { status, ...data },
  });
}

async function processIncidentPipeline(incidentId) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: { repository: true },
  });

  if (!incident) throw new Error('Incident not found');

  return otelService.traceIncidentPipeline(incidentId, async (span) => {
    try {
      await setIncidentStatus(incidentId, 'sanitizing');
      span?.addEvent?.('sanitizing');
      const sanitizedError = sanitizeText(incident.raw_error || incident.error_message);
      const sanitizedStack = sanitizeText(incident.raw_stack_trace || incident.stack_trace);

      await setIncidentStatus(incidentId, 'analyzing', {
        sanitized_error: sanitizedError.text,
        sanitized_stack_trace: sanitizedStack.text,
        sanitization_report: {
          replacements: Array.from(new Set([...sanitizedError.replacements, ...sanitizedStack.replacements])),
        },
      });
      span?.addEvent?.('analyzing');

      const analysis = await analyzeIncident({
        ...incident,
        sanitized_error: sanitizedError.text,
        sanitized_stack_trace: sanitizedStack.text,
      });

      await setIncidentStatus(incidentId, 'querying_memory', {
        root_cause: analysis.root_cause || analysis.explanation,
        affected_files: analysis.affected_files || [],
        analysis_keywords: analysis.keywords || [],
        analysis_confidence: Number(analysis.confidence || 0.35),
      });
      span?.addEvent?.('querying_memory');

      const memoryContext = await buildMemoryContext(incident, analysis);
      const fileContents = await fetchRepoFileContents(incident, analysis.affected_files || []);

      // Score confidence
      const confidenceResult = await confidenceService.scoreAnalysis(incident, analysis, memoryContext);

      await setIncidentStatus(incidentId, 'generating_fix', {
        memory_context: memoryContext,
        confidence_score: confidenceResult.score,
        trace_id: otelService.getCurrentTraceId(),
      });
      span?.addEvent?.('generating_fix');

      const fix = await generateFix(incident, analysis, memoryContext, fileContents);
      const safety = safetyCheck(fix);

      // Score fix confidence
      const fixConfidence = await confidenceService.scoreFixProposal(fix, incident);

      const savedFix = await prisma.fix.create({
        data: {
          incident_id: incidentId,
          title: fix.title || 'Proposed fix',
          explanation: fix.explanation || '',
          diff: fix.diff || '',
          confidence: fixConfidence.score,
          caveats: Array.isArray(fix.caveats) ? fix.caveats : [],
          file_changes: fix.file_changes || [],
          safety_score: safety.safety_score,
          safety_issues: safety.safety_issues,
          model_used: config.GROQ_MODEL,
          status: 'pending',
        },
      });

      await setIncidentStatus(incidentId, (safety.safety_score === 'BLOCKED' || safety.safety_score === 'REVIEW_REQUIRED') ? 'fix_blocked' : 'resolved');

      // Index fix + analysis back into memory for future incident correlation
      await ingestIncidentMemory({
        workspaceId: incident.workspace_id,
        incidentId,
        analysis,
        fix: { ...fix, safety_score: safety.safety_score },
        memoryContext,
      });

      await prisma.activityLog.create({
        data: {
          workspace_id: incident.workspace_id,
          module: 'autofix',
          action: 'fix_generated',
          resource_type: 'fix',
          resource_id: savedFix.id,
          metadata: { incident_id: incidentId, safety_score: safety.safety_score, confidence: fixConfidence.score },
        },
      }).catch(() => null);

      // Notify on fix generated
      notificationService.notifyIncidentEvent(incident.workspace_id, incidentId, 'fix_generated').catch(() => null);

      return savedFix;
    } catch (error) {
      await setIncidentStatus(incidentId, 'failed', { pipeline_error: error.message }).catch(() => null);
      throw error;
    }
  });
}

async function getRepositories(workspaceId) {
  return prisma.repository.findMany({
    where: { workspace_id: workspaceId },
    orderBy: { created_at: 'desc' },
  });
}

async function connectRepository(data) {
  return prisma.repository.create({
    data: {
      workspace_id: data.workspace_id,
      name: data.name || data.full_name.split('/').pop(),
      full_name: data.full_name,
      default_branch: data.default_branch,
      branch: data.default_branch,
      github_token: data.github_token,
      language: data.language,
      is_private: data.is_private,
    },
  });
}

async function deleteRepository(id) {
  return prisma.repository.delete({ where: { id } });
}

async function getIncidents(workspaceId) {
  return prisma.incident.findMany({
    where: { workspace_id: workspaceId },
    orderBy: { created_at: 'desc' },
    include: { fixes: { orderBy: { created_at: 'desc' }, take: 1 } },
  });
}

async function createManualIncident(data) {
  return prisma.incident.create({
    data: {
      workspace_id: data.workspace_id,
      repository_id: data.repository_id || null,
      raw_error: data.error_message,
      raw_stack_trace: data.stack_trace,
      error_type: data.error_type,
      error_message: data.error_message,
      stack_trace: data.stack_trace,
      severity: data.severity,
      environment: data.environment,
      source: 'manual',
      status: 'received',
    },
  });
}

async function getIncidentById(id) {
  return prisma.incident.findUnique({
    where: { id: id },
    include: {
      repository: true,
      fixes: { orderBy: { created_at: 'desc' } },
    },
  });
}

async function updateIncidentStatus(id, status) {
  const data = { status: String(status) };
  if (status === 'resolved') data.resolved_at = new Date();
  return prisma.incident.update({ where: { id }, data });
}

async function retryIncident(id) {
  return prisma.incident.update({
    where: { id },
    data: { status: 'received', pipeline_error: null },
  });
}

async function getFixesByIncidentId(incidentId) {
  return prisma.fix.findMany({
    where: { incident_id: incidentId },
    orderBy: { created_at: 'desc' },
  });
}

async function createPR(fixId, overrideToken) {
  const fix = await prisma.fix.findUnique({
    where: { id: fixId },
    include: { incident: { include: { repository: true } } },
  });
  if (!fix) throw new Error('Fix not found');
  if (fix.pr_url) throw new Error('PR already created');

  const { incident } = fix;
  const repo = incident.repository;
  if (!repo) throw new Error('No repository linked to this incident');

  const token = overrideToken || repo.github_token || config.GITHUB_TOKEN;
  if (!token) throw new Error('No GitHub token available');

  const fileChanges = Array.isArray(fix.file_changes) ? fix.file_changes : [];
  if (fileChanges.length === 0) throw new Error('Fix has no file changes to commit');

  const branchName = `nexusops/fix-${fixId.slice(0, 8)}-${Date.now()}`;
  const baseBranch = repo.branch || repo.default_branch || 'main';

  await githubService.createBranch(repo.full_name, baseBranch, branchName, token);

  for (const change of fileChanges) {
    if (!change.path || !change.fixed_code) continue;
    await githubService.commitFileChange(
      repo.full_name,
      branchName,
      change.path,
      change.fixed_code,
      `fix: ${change.change_summary || fix.title}`,
      token,
    );
  }

  const prBody = [
    `## NexusOps AutoFix\n`,
    fix.explanation || '',
    fix.diff ? `\n### Diff\n\`\`\`diff\n${fix.diff.slice(0, 3000)}\n\`\`\`` : '',
    `\n### Caveats\n${(fix.caveats || []).map((c) => `- ${c}`).join('\n')}`,
    `\n*Generated by NexusOps — confidence: ${((fix.confidence || 0) * 100).toFixed(0)}%*`,
  ].filter(Boolean).join('\n');

  const pr = await githubService.createPullRequest(repo.full_name, {
    title: fix.title || 'NexusOps AutoFix',
    body: prBody,
    head: branchName,
    base: baseBranch,
  }, token);

  await prisma.fix.update({ where: { id: fixId }, data: { pr_url: pr.url, status: 'pr_created' } });
  await prisma.incident.update({
    where: { id: incident.id },
    data: { pr_url: pr.url, pr_number: pr.number, pr_branch: branchName, pr_created_at: new Date() },
  });

  await prisma.activityLog.create({
    data: {
      workspace_id: incident.workspace_id,
      module: 'autofix',
      action: 'pr_created',
      resource_type: 'fix',
      resource_id: fixId,
      metadata: { pr_url: pr.url, pr_number: pr.number, repository: repo.full_name },
    },
  }).catch(() => null);

  // Notify on PR creation
  notificationService.notifyIncidentEvent(incident.workspace_id, incident.id, 'pr_created').catch(() => null);

  return pr;
}

async function reviewFix(fixId, { reviewerId, status, reviewNote }) {
  const normalized = String(status || '').toLowerCase();
  const allowed = new Set(['approved', 'rejected', 'needs_changes']);
  if (!allowed.has(normalized)) throw new Error('status must be approved, rejected, or needs_changes');

  const fix = await prisma.fix.findUnique({
    where: { id: fixId },
    include: { incident: true },
  });
  if (!fix) throw new Error('Fix not found');

  const reviewed = await prisma.fix.update({
    where: { id: fixId },
    data: {
      status: normalized,
      reviewed_by: reviewerId,
      reviewed_at: new Date(),
      review_note: reviewNote || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      workspace_id: fix.incident.workspace_id,
      user_id: reviewerId || null,
      module: 'autofix',
      action: `fix_${normalized}`,
      resource_type: 'fix',
      resource_id: fixId,
      metadata: { incident_id: fix.incident_id, review_note: reviewNote || null },
    },
  }).catch(() => null);

  return reviewed;
}

module.exports = {
  processIncidentPipeline,
  sanitizeText,
  parseStackFiles,
  safetyCheck,
  getRepositories,
  connectRepository,
  deleteRepository,
  getIncidents,
  createManualIncident,
  getIncidentById,
  updateIncidentStatus,
  retryIncident,
  getFixesByIncidentId,
  createPR,
  reviewFix,
};
