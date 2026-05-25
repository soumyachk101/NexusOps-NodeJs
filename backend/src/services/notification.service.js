const { prisma } = require('../lib/prisma');
const { getBot } = require('../bot');

/**
 * Send notification through the specified channel (telegram, slack, in_app).
 */
async function sendNotification(workspaceId, { channel, eventType, title, body, resourceType, resourceId }) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new Error('Workspace not found');

  const notification = await prisma.notification.create({
    data: {
      workspace_id: workspaceId,
      channel: channel || 'in_app',
      event_type: eventType || 'info',
      title: title || 'NexusOps Alert',
      body: body || '',
      resource_type: resourceType,
      resource_id: resourceId,
      status: 'pending',
    },
  });

  try {
    switch (channel) {
      case 'telegram': {
        const chatId = workspace.notify_telegram_chat_id;
        if (chatId) {
          const bot = getBot();
          if (bot) {
            const message = `*${title}*\n${body}`;
            await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
          }
        }
        break;
      }
      case 'slack': {
        const slackService = require('./slack.service');
        await slackService.sendSlackNotification(workspaceId, { title, body, eventType, resourceType, resourceId });
        return notification;
      }
      default:
        break;
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'sent', sent_at: new Date() },
    });
  } catch (err) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'failed', error_message: err.message },
    });
    throw err;
  }

  return notification;
}

/**
 * Multi-channel notification: sends to all configured channels.
 */
async function broadcastNotification(workspaceId, { eventType, title, body, resourceType, resourceId }) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new Error('Workspace not found');

  const results = [];

  // Telegram
  if (workspace.notify_telegram_chat_id) {
    try {
      const result = await sendNotification(workspaceId, {
        channel: 'telegram', eventType, title, body, resourceType, resourceId,
      });
      results.push({ channel: 'telegram', status: 'sent', id: result.id });
    } catch (err) {
      results.push({ channel: 'telegram', status: 'failed', error: err.message });
    }
  }

  // Slack
  if (workspace.slack_channel_id || workspace.slack_webhook_url) {
    try {
      const result = await sendNotification(workspaceId, {
        channel: 'slack', eventType, title, body, resourceType, resourceId,
      });
      results.push({ channel: 'slack', status: 'sent', id: result.id });
    } catch (err) {
      results.push({ channel: 'slack', status: 'failed', error: err.message });
    }
  }

  // In-app (always)
  try {
    const result = await sendNotification(workspaceId, {
      channel: 'in_app', eventType, title, body, resourceType, resourceId,
    });
    results.push({ channel: 'in_app', status: 'sent', id: result.id });

    // Emit via Socket.IO if available
    const { app } = require('../index');
    const io = app?.get?.('io');
    if (io) {
      io.to(`workspace:${workspaceId}`).emit('notification', {
        id: result.id,
        event_type: eventType,
        title,
        body,
        resource_type: resourceType,
        resource_id: resourceId,
        created_at: result.created_at,
      });
    }
  } catch (err) {
    results.push({ channel: 'in_app', status: 'failed', error: err.message });
  }

  return results;
}

/**
 * Notify on incident events (PR created, revert triggered, task detected).
 */
async function notifyIncidentEvent(workspaceId, incidentId, eventType) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return;

  const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
  if (!incident) return;

  const config = {
    pr_created: {
      title: `PR Created: ${incident.error_type || 'Incident'}`,
      body: `A fix PR was created for incident ${incidentId.slice(0, 8)}.\nError: ${incident.error_message?.slice(0, 200) || 'N/A'}`,
    },
    revert_triggered: {
      title: `Auto-Revert Triggered`,
      body: `Production rollback triggered for incident ${incidentId.slice(0, 8)}.\nError: ${incident.error_message?.slice(0, 200) || 'N/A'}`,
    },
    fix_generated: {
      title: `Fix Generated: ${incident.error_type || 'Incident'}`,
      body: `AutoFix generated a fix for incident ${incidentId.slice(0, 8)}.\nSeverity: ${incident.severity}`,
    },
    incident_created: {
      title: `New Incident: ${incident.error_type || 'Unknown'}`,
      body: `Severity: ${incident.severity}\nSource: ${incident.source}\nError: ${incident.error_message?.slice(0, 200) || 'N/A'}`,
    },
  };

  const cfg = config[eventType];
  if (!cfg) return;

  const shouldNotify =
    (eventType === 'pr_created' && workspace.notify_on_pr) ||
    (eventType === 'revert_triggered' && workspace.notify_on_revert) ||
    eventType === 'fix_generated' ||
    eventType === 'incident_created';

  if (!shouldNotify) return;

  return broadcastNotification(workspaceId, {
    eventType,
    title: cfg.title,
    body: cfg.body,
    resourceType: 'incident',
    resourceId: incidentId,
  });
}

/**
 * Notify on task events.
 */
async function notifyTaskEvent(workspaceId, taskTitle, eventType) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || !workspace.notify_on_task) return;

  return broadcastNotification(workspaceId, {
    eventType: `task_${eventType}`,
    title: `Task ${eventType}: ${taskTitle}`,
    body: `A new task was detected: ${taskTitle}`,
    resourceType: 'task',
  });
}

/**
 * Get notification history for a workspace.
 */
async function getNotifications(workspaceId, { limit = 50, offset = 0, status } = {}) {
  const where = { workspace_id: workspaceId };
  if (status) where.status = status;

  return prisma.notification.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Get notification stats.
 */
async function getNotificationStats(workspaceId) {
  const [total, sent, failed, pending] = await Promise.all([
    prisma.notification.count({ where: { workspace_id: workspaceId } }),
    prisma.notification.count({ where: { workspace_id: workspaceId, status: 'sent' } }),
    prisma.notification.count({ where: { workspace_id: workspaceId, status: 'failed' } }),
    prisma.notification.count({ where: { workspace_id: workspaceId, status: 'pending' } }),
  ]);

  return { total, sent, failed, pending };
}

module.exports = {
  sendNotification,
  broadcastNotification,
  notifyIncidentEvent,
  notifyTaskEvent,
  getNotifications,
  getNotificationStats,
};
