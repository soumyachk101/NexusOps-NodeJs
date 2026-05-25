const express = require('express');
const ollamaController = require('../controllers/ollama.controller');
const { verifyAuth } = require('../middleware/auth');
const { asyncHandler } = require('../lib/http');

const router = express.Router();

router.get('/health', asyncHandler(ollamaController.health));
router.post('/pull', verifyAuth, asyncHandler(ollamaController.pullModel));
router.post('/chat', verifyAuth, asyncHandler(ollamaController.chat));

module.exports = router;
