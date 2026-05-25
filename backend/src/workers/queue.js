const IORedis = require('ioredis');
const { Queue, Worker } = require('bullmq');
const { config } = require('../lib/config');
const { processIncidentPipeline } = require('../services/autofix.service');

let redis;
let autofixQueue;
let maintenanceQueue;
let memoryQueue;
let notificationQueue;
let postmortemQueue;
let autofixWorker;
let maintenanceWorker;
let memoryWorker;
let notificationWorker;
let postmortemWorker;
let redisAvailable = false;
let redisChecked = false;

/**
 * Probe Redis once at startup. Returns true if reachable.
 * Prevents BullMQ from spamming ECONNREFUSED when Redis isn't running.
 */
async function isRedisReachable() {
  if (redisChecked) return redisAvailable;
  redisChecked = true;

  const probe = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: 2000,
    retryStrategy: () => null, // no retries
  });

  try {
    await probe.connect();
    await probe.ping();
    redisAvailable = true;
    await probe.quit();
  } catch {
    redisAvailable = false;
    try { probe.disconnect(false); } catch {}
  }

  return redisAvailable;
}

function getRedis() {
  if (!redis) {
    redis = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    // Suppress repeated connection errors — logged once at startup instead
    let errorLogged = false;
    redis.on('error', () => {
      if (!errorLogged) {
        errorLogged = true;
        // Logged once; subsequent errors silenced
      }
    });
  }
  return redis;
}

function getMaintenanceQueue() {
  if (!maintenanceQueue && redisAvailable) {
    maintenanceQueue = new Queue('maintenance', { connection: getRedis() });
  }
  return maintenanceQueue;
}

function getAutofixQueue() {
  if (!autofixQueue && redisAvailable) {
    autofixQueue = new Queue('autofix', { connection: getRedis() });
  }
  return autofixQueue;
}

function getMemoryQueue() {
  if (!memoryQueue && redisAvailable) {
    memoryQueue = new Queue('memory', { connection: getRedis() });
  }
  return memoryQueue;
}

function getNotificationQueue() {
  if (!notificationQueue && redisAvailable) {
    notificationQueue = new Queue('notifications', { connection: getRedis() });
  }
  return notificationQueue;
}

function getPostmortemQueue() {
  if (!postmortemQueue && redisAvailable) {
    postmortemQueue = new Queue('postmortems', { connection: getRedis() });
  }
  return postmortemQueue;
}

async function enqueueAutofix(incidentId) {
  const queue = getAutofixQueue();
  if (queue) {
    try {
      await Promise.race([
        queue.add('process_incident', { incidentId }, {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis enqueue timeout')), 1500)),
      ]);
      return;
    } catch (error) {
      console.warn(`BullMQ enqueue failed; falling back to inline: ${error.message}`);
    }
  }

  // Inline fallback — processes without Redis
  setImmediate(() => {
    processIncidentPipeline(incidentId).catch((err) => {
      console.error(`Inline AutoFix failed for ${incidentId}:`, err);
    });
  });
}

async function enqueueMemoryDecay(workspaceId) {
  const queue = getMemoryQueue();
  if (queue) {
    try {
      await Promise.race([
        queue.add('update_decay', { workspaceId }, { attempts: 1 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis enqueue timeout')), 1500)),
      ]);
      return;
    } catch (error) {
      console.warn(`BullMQ memory decay enqueue failed; falling back to inline: ${error.message}`);
    }
  }
  setImmediate(async () => {
    try {
      const decayService = require('../services/memory-decay.service');
      await decayService.updateDecayFactors(workspaceId);
    } catch (err) {
      console.error(`Inline memory decay failed for ${workspaceId}:`, err.message);
    }
  });
}

async function enqueueNotification(workspaceId, payload) {
  const queue = getNotificationQueue();
  if (queue) {
    try {
      await Promise.race([
        queue.add('send_notification', { workspaceId, ...payload }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis enqueue timeout')), 1500)),
      ]);
      return;
    } catch (error) {
      console.warn(`BullMQ notification enqueue failed; falling back to inline: ${error.message}`);
    }
  }
  setImmediate(async () => {
    try {
      const notificationService = require('../services/notification.service');
      await notificationService.broadcastNotification(workspaceId, payload);
    } catch (err) {
      console.error(`Inline notification failed for ${workspaceId}:`, err.message);
    }
  });
}

async function enqueuePostMortem(incidentId) {
  const queue = getPostmortemQueue();
  if (queue) {
    try {
      await Promise.race([
        queue.add('generate_postmortem', { incidentId }, { attempts: 2, backoff: { type: 'exponential', delay: 5000 } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis enqueue timeout')), 1500)),
      ]);
      return;
    } catch (error) {
      console.warn(`BullMQ postmortem enqueue failed; falling back to inline: ${error.message}`);
    }
  }
  setImmediate(async () => {
    try {
      const postmortemService = require('../services/postmortem.service');
      await postmortemService.generatePostMortem(incidentId);
    } catch (err) {
      console.error(`Inline postmortem failed for ${incidentId}:`, err.message);
    }
  });
}

async function startWorkers() {
  if (autofixWorker) return { autofixWorker };

  const reachable = await isRedisReachable();

  if (!reachable) {
    console.log('⚡ Redis not available — BullMQ workers disabled (inline fallback active)');
    return { autofixWorker: null };
  }

  try {
    autofixWorker = new Worker(
      'autofix',
      async (job) => processIncidentPipeline(job.data.incidentId),
      { connection: getRedis(), concurrency: 3 },
    );

    autofixWorker.on('failed', (job, error) => {
      console.error(`AutoFix job ${job?.id || 'unknown'} failed:`, error);
    });

    console.log('✅ BullMQ AutoFix worker started (Redis connected)');

    maintenanceWorker = new Worker(
      'maintenance',
      async (job) => {
        if (job.name === 'detect_problems') {
          const { prisma } = require('../lib/prisma');
          const workspaces = await prisma.workspace.findMany({ select: { id: true } });
          const { detectRecurringProblems } = require('../services/problem.service');
          for (const ws of workspaces) {
            await detectRecurringProblems(ws.id).catch(err => 
              console.error(`Maintenance: Problem detection failed for ${ws.id}:`, err.message)
            );
          }
        }
      },
      { connection: getRedis(), concurrency: 1 },
    );

    // Memory decay worker
    memoryWorker = new Worker(
      'memory',
      async (job) => {
        if (job.name === 'memory_decay') {
          const { decayWorkspaceChunks } = require('../services/memory-decay.service');
          return decayWorkspaceChunks(job.data.workspaceId);
        }
      },
      { connection: getRedis(), concurrency: 2 },
    );
    memoryWorker.on('failed', (job, error) => {
      console.error(`Memory job ${job?.id} failed:`, error.message);
    });
    console.log('✅ BullMQ Memory worker started');

    // Notification worker
    notificationWorker = new Worker(
      'notifications',
      async (job) => {
        const notificationService = require('../services/notification.service');
        return notificationService.broadcastNotification(job.data.workspaceId, job.data);
      },
      { connection: getRedis(), concurrency: 5 },
    );
    notificationWorker.on('failed', (job, error) => {
      console.error(`Notification job ${job?.id} failed:`, error.message);
    });
    console.log('✅ BullMQ Notification worker started');

    // Post-mortem worker
    postmortemWorker = new Worker(
      'postmortems',
      async (job) => {
        const postmortemService = require('../services/postmortem.service');
        return postmortemService.generatePostMortem(job.data.incidentId);
      },
      { connection: getRedis(), concurrency: 2 },
    );
    postmortemWorker.on('failed', (job, error) => {
      console.error(`Post-mortem job ${job?.id} failed:`, error.message);
    });
    console.log('✅ BullMQ Post-mortem worker started');

    // Setup repeatable jobs
    const mQueue = getMaintenanceQueue();
    if (mQueue) {
      await mQueue.add('detect_problems', {}, {
        repeat: { pattern: '0 */6 * * *' } // Every 6 hours
      });

      await mQueue.add('memory_decay_all', {}, {
        repeat: { pattern: '0 2 * * *' } // Daily at 2 AM
      });

      console.log('✅ BullMQ Maintenance worker started (Repeatable jobs scheduled)');
    }
  } catch (error) {
    console.warn(`BullMQ worker disabled: ${error.message}`);
  }

  return { autofixWorker, maintenanceWorker, memoryWorker, notificationWorker, postmortemWorker };
}

function getMemoryQueue() {
  if (!memoryQueue && redisAvailable) {
    memoryQueue = new Queue('memory', { connection: getRedis() });
  }
  return memoryQueue;
}

function getNotificationQueue() {
  if (!notificationQueue && redisAvailable) {
    notificationQueue = new Queue('notifications', { connection: getRedis() });
  }
  return notificationQueue;
}

function getPostmortemQueue() {
  if (!postmortemQueue && redisAvailable) {
    postmortemQueue = new Queue('postmortems', { connection: getRedis() });
  }
  return postmortemQueue;
}

async function enqueueMemoryDecay(workspaceId) {
  const queue = getMemoryQueue();
  if (queue) {
    try {
      await queue.add('memory_decay', { workspaceId }, {
        attempts: 1,
        removeOnComplete: true,
      });
      return;
    } catch (error) {
      console.warn(`Memory decay enqueue failed: ${error.message}`);
    }
  }
  // Inline fallback
  const { decayWorkspaceChunks } = require('../services/memory-decay.service');
  setImmediate(() => decayWorkspaceChunks(workspaceId).catch(() => {}));
}

async function enqueueNotification(workspaceId, payload) {
  const queue = getNotificationQueue();
  if (queue) {
    try {
      await queue.add('send_notification', { workspaceId, ...payload }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
      return;
    } catch (error) {
      console.warn(`Notification enqueue failed: ${error.message}`);
    }
  }
  // Inline fallback
  const notificationService = require('../services/notification.service');
  setImmediate(() => notificationService.broadcastNotification(workspaceId, payload).catch(() => {}));
}

async function enqueuePostMortem(incidentId) {
  const queue = getPostmortemQueue();
  if (queue) {
    try {
      await queue.add('generate_postmortem', { incidentId }, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
      });
      return;
    } catch (error) {
      console.warn(`Post-mortem enqueue failed: ${error.message}`);
    }
  }
  // Inline fallback
  const postmortemService = require('../services/postmortem.service');
  setImmediate(() => postmortemService.generatePostMortem(incidentId).catch(() => {}));
}

module.exports = {
  getAutofixQueue,
  getMemoryQueue,
  getNotificationQueue,
  getPostmortemQueue,
  enqueueAutofix,
  enqueueMemoryDecay,
  enqueueNotification,
  enqueuePostMortem,
  startWorkers,
};
