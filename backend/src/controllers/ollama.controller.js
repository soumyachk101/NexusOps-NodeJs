const { AppError } = require('../lib/http');
const ollamaService = require('../services/ollama.service');

exports.health = async (req, res) => {
  const result = await ollamaService.checkHealth();
  res.json(result);
};

exports.pullModel = async (req, res) => {
  const { model } = req.body;
  if (!model) throw new AppError(400, 'model is required');
  const result = await ollamaService.pullModel(model);
  res.json(result);
};

exports.chat = async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) throw new AppError(400, 'messages array is required');
  const result = await ollamaService.chatCompletion(messages);
  res.json({ content: result });
};
