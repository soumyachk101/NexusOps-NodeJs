const express = require('express');
const notificationController = require('../controllers/notification.controller');
const { verifyAuth, requireWorkspaceAccess } = require('../middleware/auth');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

router.use(verifyAuth);

router.get('/', requireWorkspaceAccess, asyncHandler(notificationController.getNotifications));
router.get('/stats', requireWorkspaceAccess, asyncHandler(notificationController.getStats));
router.post('/broadcast', requireWorkspaceAccess, asyncHandler(notificationController.broadcast));

module.exports = router;
