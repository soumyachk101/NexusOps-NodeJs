const { AppError } = require('../lib/http');
const postmortemService = require('../services/postmortem.service');

exports.generate = async (req, res) => {
  const { incident_id } = req.body;
  if (!incident_id) throw new AppError(400, 'incident_id is required');
  const result = await postmortemService.generatePostMortem(incident_id);
  res.status(201).json(result);
};

exports.generatePDF = async (req, res) => {
  const result = await postmortemService.generatePDF(req.params.id);
  res.json(result);
};

exports.list = async (req, res) => {
  const { limit, offset } = req.query;
  const result = await postmortemService.getPostMortems(req.workspace_id, {
    limit: limit ? parseInt(limit) : 20,
    offset: offset ? parseInt(offset) : 0,
  });
  res.json(result);
};

exports.getById = async (req, res) => {
  const result = await postmortemService.getPostMortemById(req.params.id);
  if (!result) throw new AppError(404, 'Post-mortem not found');
  res.json(result);
};
