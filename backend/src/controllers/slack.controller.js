const slackService = require('../services/slack.service');
const memoryService = require('../services/memory.service');

exports.handleSlackEvent = async (req, res) => {
  // Handle Slack URL verification challenge
  if (req.body.type === 'url_verification') {
    return res.json({ challenge: req.body.challenge });
  }

  // Handle event callback
  const result = await slackService.handleSlackEvent(req.body);
  res.json({ ok: true, ...result });
};

exports.sendNotification = async (req, res) => {
  const { workspace_id, title, body, event_type, resource_type, resource_id } = req.body;
  const result = await slackService.sendSlackNotification(workspace_id || req.workspace_id, {
    title, body, eventType: event_type, resourceType: resource_type, resourceId: resource_id,
  });
  res.status(201).json(result);
};
