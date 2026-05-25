const notificationService = require('../services/notification.service');

exports.getNotifications = async (req, res) => {
  const { limit, offset, status } = req.query;
  const result = await notificationService.getNotifications(req.workspace_id, {
    limit: limit ? parseInt(limit) : 50,
    offset: offset ? parseInt(offset) : 0,
    status,
  });
  res.json(result);
};

exports.getStats = async (req, res) => {
  const result = await notificationService.getNotificationStats(req.workspace_id);
  res.json(result);
};

exports.broadcast = async (req, res) => {
  const { event_type, title, body, resource_type, resource_id } = req.body;
  const result = await notificationService.broadcastNotification(req.workspace_id, {
    eventType: event_type, title, body, resourceType: resource_type, resourceId: resource_id,
  });
  res.json(result);
};
