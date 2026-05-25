const express = require('express');
const slackController = require('../controllers/slack.controller');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

// Slack events endpoint (no auth - Slack sends directly)
router.post('/events', asyncHandler(slackController.handleSlackEvent));

// Send notification (auth required)
const { verifyAuth, requireWorkspaceAccess } = require('../middleware/auth');
router.post('/notify', verifyAuth, requireWorkspaceAccess, asyncHandler(slackController.sendNotification));

module.exports = router;
