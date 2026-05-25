const PDFDocument = require('pdfkit');
const { prisma } = require('../lib/prisma');
const { config } = require('../lib/config');
const storageService = require('./storage.service');
const { ChatPromptTemplate } = require('@langchain/core/prompts');

/**
 * Generate a post-mortem document for an incident.
 */
async function generatePostMortem(incidentId, options = {}) {
  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    include: {
      repository: true,
      fixes: { orderBy: { created_at: 'asc' } },
    },
  });

  if (!incident) throw new Error('Incident not found');

  // Generate narrative using LLM
  const narrative = await generateNarrative(incident);

  // Build timeline from activity logs
  const timeline = await buildTimeline(incidentId);

  const postMortem = await prisma.postMortem.create({
    data: {
      workspace_id: incident.workspace_id,
      incident_id: incidentId,
      title: options.title || `Post-Mortem: ${incident.error_type || 'Incident'} - ${new Date(incident.created_at).toISOString().split('T')[0]}`,
      summary: narrative.summary,
      root_cause: narrative.root_cause || incident.root_cause,
      timeline,
      impact: narrative.impact,
      remediation: narrative.remediation,
      prevention: narrative.prevention,
    },
  });

  return postMortem;
}

/**
 * Generate narrative sections using LLM.
 */
async function generateNarrative(incident) {
  const { ChatGroq } = require('@langchain/groq');
  const llm = new ChatGroq({
    apiKey: config.GROQ_API_KEY,
    model: config.GROQ_MODEL,
    temperature: 0.3,
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', `You are an SRE expert writing a post-mortem report. Given incident details, produce a JSON response with these fields:
- summary: 2-3 sentence executive summary
- root_cause: detailed root cause analysis
- impact: who/what was affected
- remediation: how it was fixed
- prevention: how to prevent recurrence

Respond ONLY with valid JSON.`],
    ['human', `Error Type: {error_type}
Error Message: {error_message}
Severity: {severity}
Stack Trace: {stack_trace}
Root Cause (from analysis): {root_cause}
Fix Proposals: {fix_count} fixes generated
PR URL: {pr_url}`],
  ]);

  const chain = prompt.pipe(llm);
  const result = await chain.invoke({
    error_type: incident.error_type || 'Unknown',
    error_message: incident.error_message || 'N/A',
    severity: incident.severity || 'medium',
    stack_trace: (incident.stack_trace || '').slice(0, 1000),
    root_cause: incident.root_cause || 'Not yet determined',
    fix_count: String(incident.fixes?.length || 0),
    pr_url: incident.pr_url || 'None',
  });

  try {
    const text = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      summary: `Incident involving ${incident.error_type || 'an error'} was detected and processed.`,
      root_cause: incident.root_cause || 'Under investigation',
      impact: `${incident.severity} severity incident in ${incident.environment} environment`,
      remediation: incident.fixes?.length > 0 ? 'Fix proposals were generated' : 'No automated fix available',
      prevention: 'Recommend enhanced monitoring and testing',
    };
  }
}

/**
 * Build timeline from activity logs.
 */
async function buildTimeline(incidentId) {
  const logs = await prisma.activityLog.findMany({
    where: {
      resource_type: 'incident',
      resource_id: incidentId,
    },
    orderBy: { created_at: 'asc' },
  });

  return logs.map((log) => ({
    time: log.created_at,
    action: log.action,
    module: log.module,
    details: log.metadata,
  }));
}

/**
 * Generate PDF for a post-mortem.
 */
async function generatePDF(postMortemId) {
  const pm = await prisma.postMortem.findUnique({
    where: { id: postMortemId },
    include: { incident: true },
  });
  if (!pm) throw new Error('Post-mortem not found');

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', async () => {
      const pdfBuffer = Buffer.concat(chunks);
      const fileName = `postmortem-${pm.id.slice(0, 8)}.pdf`;
      const filePath = `/tmp/${fileName}`;

      const fs = require('fs');
      fs.writeFileSync(filePath, pdfBuffer);

      try {
        const fileUrl = await storageService.uploadFile(filePath, `post-mortems/${fileName}`, 'application/pdf');
        await prisma.postMortem.update({
          where: { id: postMortemId },
          data: { pdf_url: fileUrl },
        });
        resolve({ url: fileUrl, path: filePath });
      } catch (err) {
        resolve({ path: filePath, error: err.message });
      }
    });
    doc.on('error', reject);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Incident Post-Mortem', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(pm.title, { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Metadata
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Generated: ${new Date(pm.generated_at).toLocaleString()}`);
    if (pm.incident) {
      doc.text(`Severity: ${pm.incident.severity}`);
      doc.text(`Environment: ${pm.incident.environment}`);
      doc.text(`Error Type: ${pm.incident.error_type || 'N/A'}`);
      doc.text(`Source: ${pm.incident.source}`);
    }
    doc.moveDown();

    // Summary
    doc.fontSize(14).font('Helvetica-Bold').text('Executive Summary');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').text(pm.summary || 'No summary available', { align: 'left' });
    doc.moveDown();

    // Root Cause
    doc.fontSize(14).font('Helvetica-Bold').text('Root Cause Analysis');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').text(pm.root_cause || 'Under investigation', { align: 'left' });
    doc.moveDown();

    // Impact
    if (pm.impact) {
      doc.fontSize(14).font('Helvetica-Bold').text('Impact');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').text(pm.impact, { align: 'left' });
      doc.moveDown();
    }

    // Remediation
    if (pm.remediation) {
      doc.fontSize(14).font('Helvetica-Bold').text('Remediation');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').text(pm.remediation, { align: 'left' });
      doc.moveDown();
    }

    // Prevention
    if (pm.prevention) {
      doc.fontSize(14).font('Helvetica-Bold').text('Prevention Measures');
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica').text(pm.prevention, { align: 'left' });
      doc.moveDown();
    }

    // Timeline
    const timeline = Array.isArray(pm.timeline) ? pm.timeline : [];
    if (timeline.length > 0) {
      doc.fontSize(14).font('Helvetica-Bold').text('Timeline');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica');

      for (const event of timeline.slice(0, 20)) {
        const time = new Date(event.time).toLocaleTimeString();
        doc.text(`[${time}] ${event.action} (${event.module})`);
      }
      doc.moveDown();
    }

    // Footer
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica').text('Generated by NexusOps AutoFix Engine', { align: 'center' });

    doc.end();
  });
}

/**
 * Get all post-mortems for a workspace.
 */
async function getPostMortems(workspaceId, { limit = 20, offset = 0 } = {}) {
  return prisma.postMortem.findMany({
    where: { workspace_id: workspaceId },
    orderBy: { generated_at: 'desc' },
    take: limit,
    skip: offset,
    include: {
      incident: {
        select: { id: true, error_type: true, severity: true, status: true },
      },
    },
  });
}

/**
 * Get a single post-mortem by ID.
 */
async function getPostMortemById(id) {
  return prisma.postMortem.findUnique({
    where: { id },
    include: { incident: true },
  });
}

module.exports = {
  generatePostMortem,
  generatePDF,
  getPostMortems,
  getPostMortemById,
};
