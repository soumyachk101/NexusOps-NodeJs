const { WebClient } = require('@slack/web-api');
const { prisma } = require('../lib/prisma');
const { config } = require('../lib/config');
const memoryService = require('./memory.service');

let slackClient;

function getClient() {
  if (!slackClient && config.SLACK_BOT_TOKEN) {
    slackClient = new WebClient(config.SLACK_BOT_TOKEN);
  }
  return slackClient;
}

/**
 * Verify Slack webhook signature (HMAC-SHA256).
 */
function verifySlackSignature(req) {
  if (!config.SLACK_SIGNING_SECRET) return true;

  const timestamp = req.headers['x-slack-request-timestamp'];
  const signature = req.headers['x-slack-signature'];
  if (!timestamp || !signature) return false;

  const fiveMinAgo = Math.floor(Date.now() / 1000) - 300;
  if (parseInt(timestamp, 10) < fiveMinAgo) return false;

  const crypto = require('crypto');
  const baseString = `v0:${timestamp}:${JSON.stringify(req.body)}`;
  const expected = `v0=${crypto.createHmac('sha256', config.SLACK_SIGNING_SECRET).update(baseString).digest('hex')}`;

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

/**
 * Parse a Slack event and extract message text.
 */
function extractSlackText(event) {
  if (!event) return '';
  const text = event.text || '';
  return text.replace(/<@[A-Z0-9]+>/g, '').trim();
}

/**
 * Resolve workspace from Slack channel ID.
 */
async function findWorkspaceBySlackChannel(channelId) {
  if (!channelId) return null;
  return prisma.workspace.findFirst({
    where: { slack_channel_id: channelId },
  });
}

/**
 * Handle incoming Slack events (message events).
 */
async function handleSlackEvent(payload) {
  const event = payload.event || payload;
  const eventType = event.type;

  if (eventType !== 'message' && eventType !== 'app_mention') {
    return { handled: false, reason: `unsupported_event_type: ${eventType}` };
  }

  const channelId = event.channel;
  const workspace = await findWorkspaceBySlackChannel(channelId);

  if (!workspace) {
    return { handled: false, reason: 'no_workspace_for_channel' };
  }

  const text = extractSlackText(event);
  if (!text) {
    return { handled: false, reason: 'empty_message' };
  }

  const sender = event.user || event.bot_id || 'slack_user';
  const channelName = channelId;

  await memoryService.ingestText(workspace.id, text, {
    sourceType: 'slack',
    sender,
    channelName,
    timestamp: new Date((parseFloat(event.ts) || Date.now() / 1000) * 1000),
  });

  return { handled: true, ingested: true, workspace_id: workspace.id };
}

/**
 * Send a Slack notification via webhook URL.
 */
async function sendSlackNotification(workspaceId, { title, body, eventType, resourceType, resourceId }) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new Error('Workspace not found');

  const notification = await prisma.notification.create({
    data: {
      workspace_id: workspaceId,
      channel: 'slack',
      event_type: eventType || 'info',
      title: title || 'NexusOps Alert',
      body: body || '',
      resource_type: resourceType,
      resource_id: resourceId,
      status: 'sending',
    },
  });

  try {
    const client = getClient();
    if (client && workspace.slack_channel_id) {
      await client.chat.postMessage({
        channel: workspace.slack_channel_id,
        text: `${title}\n${body}`,
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: title } },
          { type: 'section', text: { type: 'mrkdwn', text: body } },
        ],
      });
    } else if (workspace.slack_webhook_url) {
      const https = require('https');
      const url = new URL(workspace.slack_webhook_url);
      const payload = JSON.stringify({ text: `${title}\n${body}` });
      await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: url.hostname,
          path: url.pathname,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        }, (res) => { res.resume(); res.on('end', resolve); });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    } else {
      throw new Error('No Slack channel or webhook configured');
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

module.exports = {
  verifySlackSignature,
  handleSlackEvent,
  sendSlackNotification,
  findWorkspaceBySlackChannel,
};
