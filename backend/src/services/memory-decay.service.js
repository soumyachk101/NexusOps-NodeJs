const { prisma } = require('../lib/prisma');

/**
 * Memory decay and re-ranking policies for document chunks.
 *
 * Implements time-based decay with access-frequency boosting:
 *   effective_score = base_similarity * decay_factor * access_boost
 *
 * Decay formula: decay_factor = e^(-lambda * days_since_creation)
 * Access boost:  1 + log(1 + access_count) * 0.1
 */

const DEFAULT_LAMBDA = 0.01;      // ~50% decay after 69 days
const ACCESS_BOOST_WEIGHT = 0.1;
const MIN_DECAY_FACTOR = 0.05;    // Never fully decay to zero
const MAX_ACCESS_BOOST = 2.0;     // Cap access boost

/**
 * Calculate decay factor for a chunk based on age.
 */
function calculateDecayFactor(createdAt, lambda = DEFAULT_LAMBDA) {
  const now = Date.now();
  const ageMs = now - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.max(MIN_DECAY_FACTOR, Math.exp(-lambda * ageDays));
}

/**
 * Calculate access boost based on how frequently a chunk is accessed.
 */
function calculateAccessBoost(accessCount) {
  return Math.min(MAX_ACCESS_BOOST, 1 + Math.log(1 + (accessCount || 0)) * ACCESS_BOOST_WEIGHT);
}

/**
 * Re-rank search results using decay and access boosting.
 * Takes raw similarity results and returns re-ranked list.
 */
function rerankResults(chunks, options = {}) {
  const { lambda = DEFAULT_LAMBDA, decayWeight = 0.5, accessWeight = 0.3, similarityWeight = 0.5 } = options;

  return chunks
    .map((chunk) => {
      const baseSimilarity = chunk.similarity || chunk.score || 0;
      const decayFactor = calculateDecayFactor(chunk.created_at, lambda);
      const accessBoost = calculateAccessBoost(chunk.access_count);

      // Composite score blending
      const effectiveScore = (
        baseSimilarity * similarityWeight +
        decayFactor * decayWeight +
        accessBoost * accessWeight
      );

      return {
        ...chunk,
        decay_factor: Math.round(decayFactor * 1000) / 1000,
        access_boost: Math.round(accessBoost * 1000) / 1000,
        effective_score: Math.round(effectiveScore * 1000) / 1000,
      };
    })
    .sort((a, b) => b.effective_score - a.effective_score);
}

/**
 * Record access to a chunk (increments access_count, updates last_accessed_at).
 */
async function recordChunkAccess(chunkId) {
  return prisma.documentChunk.update({
    where: { id: chunkId },
    data: {
      access_count: { increment: 1 },
      last_accessed_at: new Date(),
    },
  });
}

/**
 * Batch record access for multiple chunks.
 */
async function recordBatchAccess(chunkIds) {
  if (!chunkIds || chunkIds.length === 0) return;

  await Promise.allSettled(
    chunkIds.map((id) => recordChunkAccess(id))
  );
}

/**
 * Update decay factors for all chunks in a workspace.
 * Should be run periodically (e.g., daily cron).
 */
async function updateDecayFactors(workspaceId, lambda = DEFAULT_LAMBDA) {
  const chunks = await prisma.documentChunk.findMany({
    where: { workspace_id: workspaceId },
    select: { id: true, created_at: true, access_count: true },
  });

  const updates = chunks.map((chunk) => {
    const decayFactor = calculateDecayFactor(chunk.created_at, lambda);
    return prisma.documentChunk.update({
      where: { id: chunk.id },
      data: { decay_factor: decayFactor },
    });
  });

  await Promise.allSettled(updates);
  return { updated: chunks.length };
}

/**
 * Get decay statistics for a workspace.
 */
async function getDecayStats(workspaceId) {
  const chunks = await prisma.documentChunk.findMany({
    where: { workspace_id: workspaceId },
    select: {
      id: true,
      created_at: true,
      access_count: true,
      decay_factor: true,
      relevance_score: true,
    },
  });

  if (chunks.length === 0) {
    return {
      total_chunks: 0,
      avg_decay_factor: 0,
      avg_access_count: 0,
      healthy_chunks: 0,
      stale_chunks: 0,
    };
  }

  const avgDecay = chunks.reduce((s, c) => s + (c.decay_factor || 1), 0) / chunks.length;
  const avgAccess = chunks.reduce((s, c) => s + (c.access_count || 0), 0) / chunks.length;
  const stale = chunks.filter((c) => (c.decay_factor || 1) < 0.3).length;

  return {
    total_chunks: chunks.length,
    avg_decay_factor: Math.round(avgDecay * 1000) / 1000,
    avg_access_count: Math.round(avgAccess * 10) / 10,
    healthy_chunks: chunks.length - stale,
    stale_chunks: stale,
  };
}

/**
 * Prune chunks below decay threshold (for memory cleanup).
 */
async function pruneStaleChunks(workspaceId, threshold = 0.1) {
  const staleChunks = await prisma.documentChunk.findMany({
    where: {
      workspace_id: workspaceId,
      decay_factor: { lt: threshold },
      access_count: { lt: 2 },
    },
    select: { id: true },
  });

  if (staleChunks.length === 0) return { pruned: 0 };

  const ids = staleChunks.map((c) => c.id);
  await prisma.documentChunk.deleteMany({
    where: { id: { in: ids } },
  });

  return { pruned: ids.length };
}

/**
 * Apply decay-weighted search to vector results.
 * Integrates with vector.service similarity search.
 */
async function decayAwareSearch(workspaceId, queryEmbedding, options = {}) {
  const { limit = 10, lambda = DEFAULT_LAMBDA } = options;
  const vectorService = require('./vector.service');

  // Get more results than needed to re-rank
  const rawResults = await vectorService.similaritySearch(workspaceId, queryEmbedding, { limit: limit * 2 });

  // Re-rank with decay
  const reranked = rerankResults(rawResults, { lambda });

  // Record access for returned chunks
  const returnedIds = reranked.slice(0, limit).map((c) => c.id).filter(Boolean);
  await recordBatchAccess(returnedIds);

  return reranked.slice(0, limit);
}

module.exports = {
  calculateDecayFactor,
  calculateAccessBoost,
  rerankResults,
  recordChunkAccess,
  recordBatchAccess,
  updateDecayFactors,
  getDecayStats,
  pruneStaleChunks,
  decayAwareSearch,
  DEFAULT_LAMBDA,
};
