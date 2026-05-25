const { config } = require('../lib/config');
const { ChatPromptTemplate } = require('@langchain/core/prompts');

/**
 * Confidence scoring engine for incident analysis and fix proposals.
 * Combines multiple signals into a unified confidence score (0-1).
 */

// Weight configuration for different signals
const WEIGHTS = {
  llm_self_report: 0.25,
  stack_trace_quality: 0.15,
  memory_context_relevance: 0.20,
  affected_files_found: 0.15,
  historical_accuracy: 0.15,
  safety_check: 0.10,
};

/**
 * Score the confidence of an incident analysis.
 * Returns a score between 0 and 1.
 */
async function scoreAnalysis(incident, analysis, memoryContext) {
  const signals = {};

  // Signal 1: LLM self-reported confidence
  signals.llm_self_report = analysis.confidence || 0.5;

  // Signal 2: Stack trace quality
  signals.stack_trace_quality = scoreStackTraceQuality(incident.stack_trace || incident.raw_stack_trace);

  // Signal 3: Memory context relevance
  signals.memory_context_relevance = scoreMemoryRelevance(memoryContext);

  // Signal 4: Affected files found
  const affectedFiles = analysis.affected_files || [];
  signals.affected_files_found = affectedFiles.length > 0 ? Math.min(affectedFiles.length / 5, 1) : 0;

  // Signal 5: Historical accuracy for this error type
  signals.historical_accuracy = await scoreHistoricalAccuracy(incident.workspace_id, incident.error_type);

  // Signal 6: Safety check score
  signals.safety_check = 1.0; // Will be updated after safety check

  const finalScore = Object.entries(WEIGHTS).reduce((score, [key, weight]) => {
    return score + (signals[key] || 0) * weight;
  }, 0);

  return {
    score: Math.round(Math.max(0, Math.min(1, finalScore)) * 100) / 100,
    signals,
    weights: WEIGHTS,
  };
}

/**
 * Score the quality of a stack trace.
 * Higher scores for traces with file paths, line numbers, and function names.
 */
function scoreStackTraceQuality(stackTrace) {
  if (!stackTrace) return 0;

  let score = 0;
  const text = String(stackTrace);

  // Has file paths
  if (/\/[\w\-./]+\.\w+:\d+/.test(text)) score += 0.3;
  // Has line numbers
  if (/:\d+:\d+/.test(text)) score += 0.2;
  // Has function names
  if (/at\s+\w+/.test(text) || /\w+\.\w+\(/.test(text)) score += 0.2;
  // Has error type/message
  if (/Error:|Exception:|TypeError:|ReferenceError:/.test(text)) score += 0.2;
  // Multiple frames
  if ((text.match(/\n/g) || []).length >= 3) score += 0.1;

  return Math.min(1, score);
}

/**
 * Score the relevance of memory context.
 * Based on similarity scores from vector search.
 */
function scoreMemoryRelevance(memoryContext) {
  if (!memoryContext) return 0;
  if (Array.isArray(memoryContext) && memoryContext.length === 0) return 0;

  const chunks = Array.isArray(memoryContext) ? memoryContext : memoryContext.chunks || [];
  if (chunks.length === 0) return 0;

  const avgScore = chunks.reduce((sum, c) => sum + (c.similarity || c.score || 0), 0) / chunks.length;
  const countBonus = Math.min(chunks.length / 5, 0.2);

  return Math.min(1, avgScore + countBonus);
}

/**
 * Score based on historical fix accuracy for similar error types.
 */
async function scoreHistoricalAccuracy(workspaceId, errorType) {
  if (!errorType) return 0.5;

  try {
    const { prisma } = require('../lib/prisma');
    const recentFixes = await prisma.fix.findMany({
      where: {
        incident: { workspace_id: workspaceId, error_type: errorType },
        status: 'approved',
      },
      take: 10,
      orderBy: { created_at: 'desc' },
    });

    if (recentFixes.length === 0) return 0.5;

    const avgConfidence = recentFixes.reduce((sum, f) => sum + (f.confidence || 0.5), 0) / recentFixes.length;
    return avgConfidence;
  } catch {
    return 0.5;
  }
}

/**
 * Score a fix proposal's confidence.
 */
async function scoreFixProposal(fix, incident) {
  const signals = {};

  // Signal 1: LLM self-reported confidence
  signals.llm_self_report = fix.confidence || 0.5;

  // Signal 2: Diff quality
  signals.diff_quality = scoreDiffQuality(fix.diff || '');

  // Signal 3: File changes present
  const fileChanges = fix.file_changes || [];
  signals.file_changes_present = fileChanges.length > 0 ? Math.min(fileChanges.length / 3, 1) : 0;

  // Signal 4: Caveats count (fewer is better)
  signals.caveats_penalty = Math.max(0, 1 - (fix.caveats?.length || 0) * 0.2);

  // Signal 5: Historical accuracy
  signals.historical_accuracy = await scoreHistoricalAccuracy(incident.workspace_id, incident.error_type);

  const fixWeights = {
    llm_self_report: 0.30,
    diff_quality: 0.25,
    file_changes_present: 0.20,
    caveats_penalty: 0.10,
    historical_accuracy: 0.15,
  };

  const finalScore = Object.entries(fixWeights).reduce((score, [key, weight]) => {
    return score + (signals[key] || 0) * weight;
  }, 0);

  return {
    score: Math.round(Math.max(0, Math.min(1, finalScore)) * 100) / 100,
    signals,
    weights: fixWeights,
  };
}

/**
 * Score diff quality.
 */
function scoreDiffQuality(diff) {
  if (!diff) return 0;

  let score = 0;
  const text = String(diff);

  // Has additions and deletions
  if (/^\+/.test(text, 'm') || /\n\+/.test(text)) score += 0.3;
  if (/^-/.test(text, 'm') || /\n-/.test(text)) score += 0.3;
  // Has file headers
  if (/^diff --git/.test(text) || /^@@/.test(text)) score += 0.2;
  // Has meaningful content (not just whitespace changes)
  const meaningfulLines = text.split('\n').filter((l) => /^[+-][^+-]/.test(l));
  if (meaningfulLines.length >= 2) score += 0.2;

  return Math.min(1, score);
}

/**
 * Classify confidence into a human-readable label.
 */
function classifyConfidence(score) {
  if (score >= 0.85) return { label: 'very_high', emoji: 'high', description: 'Highly confident in this assessment' };
  if (score >= 0.70) return { label: 'high', emoji: 'medium-high', description: 'Confident with minor uncertainty' };
  if (score >= 0.50) return { label: 'medium', emoji: 'medium', description: 'Moderate confidence, review recommended' };
  if (score >= 0.30) return { label: 'low', emoji: 'low', description: 'Low confidence, manual review required' };
  return { label: 'very_low', emoji: 'very-low', description: 'Very low confidence, significant uncertainty' };
}

/**
 * Get aggregate confidence stats for a workspace.
 */
async function getWorkspaceConfidenceStats(workspaceId) {
  const { prisma } = require('../lib/prisma');

  const [incidents, fixes] = await Promise.all([
    prisma.incident.findMany({
      where: { workspace_id: workspaceId, confidence_score: { not: null } },
      select: { confidence_score: true, severity: true },
      orderBy: { created_at: 'desc' },
      take: 100,
    }),
    prisma.fix.findMany({
      where: { incident: { workspace_id: workspaceId }, confidence: { not: null } },
      select: { confidence: true },
      orderBy: { created_at: 'desc' },
      take: 100,
    }),
  ]);

  const avgIncidentConfidence = incidents.length > 0
    ? incidents.reduce((s, i) => s + (i.confidence_score || 0), 0) / incidents.length
    : 0;

  const avgFixConfidence = fixes.length > 0
    ? fixes.reduce((s, f) => s + (f.confidence || 0), 0) / fixes.length
    : 0;

  return {
    avg_incident_confidence: Math.round(avgIncidentConfidence * 100) / 100,
    avg_fix_confidence: Math.round(avgFixConfidence * 100) / 100,
    total_scored_incidents: incidents.length,
    total_scored_fixes: fixes.length,
    classification: classifyConfidence(avgIncidentConfidence),
  };
}

module.exports = {
  scoreAnalysis,
  scoreFixProposal,
  scoreStackTraceQuality,
  classifyConfidence,
  getWorkspaceConfidenceStats,
  WEIGHTS,
};
