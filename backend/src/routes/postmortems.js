const express = require('express');
const postmortemController = require('../controllers/postmortem.controller');
const { verifyAuth, requireWorkspaceAccess } = require('../middleware/auth');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

router.use(verifyAuth);

router.post('/generate', requireWorkspaceAccess, asyncHandler(postmortemController.generate));
router.get('/', requireWorkspaceAccess, asyncHandler(postmortemController.list));
router.get('/:id', asyncHandler(postmortemController.getById));
router.post('/:id/pdf', asyncHandler(postmortemController.generatePDF));

module.exports = router;
