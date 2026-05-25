const { prisma } = require('../lib/prisma');
const { config } = require('../lib/config');
const notificationService = require('./notification.service');

/**
 * Triggers a rollback on Vercel or Railway.
 * This is a P1 feature for the hackathon.
 */
async function triggerRevert(workspaceId, { incidentId, reason, platform, deployId }) {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new Error('Workspace not found');

  const selectedPlatform = platform || (config.VERCEL_TOKEN ? 'vercel' : config.RAILWAY_TOKEN ? 'railway' : null);
  if (!selectedPlatform) throw new Error('No deployment platform configured (VERCEL_TOKEN or RAILWAY_TOKEN)');

  const event = await prisma.revertEvent.create({
    data: {
      workspace_id: workspaceId,
      incident_id: incidentId || null,
      trigger_type: incidentId ? 'auto' : 'manual',
      reason: reason || 'Detected error spike or manual trigger',
      platform: selectedPlatform,
      status: 'triggered',
    },
  });

  await prisma.activityLog.create({
    data: {
      workspace_id: workspaceId,
      module: 'autofix',
      action: 'revert_triggered',
      resource_type: 'deployment',
      resource_id: deployId || event.id,
      metadata: { reason, platform: selectedPlatform },
    },
  }).catch((err) => console.warn('Activity log failed for revert:', err.message));

  try {
    if (selectedPlatform === 'vercel') {
      await rollbackVercel(workspace, deployId);
    } else if (selectedPlatform === 'railway') {
      await rollbackRailway(workspace, deployId);
    }

    return prisma.revertEvent.update({
      where: { id: event.id },
      data: { status: 'completed', completed_at: new Date() },
    });
  } catch (error) {
    console.error(`Revert failed for workspace ${workspaceId}:`, error.message);
    return prisma.revertEvent.update({
      where: { id: event.id },
      data: { status: 'failed', error_message: error.message },
    });
  }
}

async function rollbackVercel(workspace, deployId) {
  const token = config.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN missing');

  // For the hackathon, we simulate or use a generic "rollback to previous" call
  // Vercel API: POST /v1/projects/:id/rollback/:deployId
  console.log(`[Revert] Rolling back Vercel deployment for project ${workspace.slug}`);
  
  const projectId = workspace.settings?.vercel_project_id || workspace.slug;
  const url = `https://api.vercel.com/v1/projects/${projectId}/rollback/${deployId}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Vercel API error (${res.status}): ${errorData.error?.message || res.statusText}`);
  }
}

async function rollbackRailway(workspace, deployId) {
  const token = config.RAILWAY_TOKEN;
  if (!token) throw new Error('RAILWAY_TOKEN missing');

  console.log(`[Revert] Rolling back Railway deployment for project ${workspace.slug}`);
  
  const serviceId = workspace.settings?.railway_service_id;
  if (!serviceId) throw new Error('RAILWAY_SERVICE_ID missing in workspace settings');

  // Railway GQL or Webhook trigger would go here. For now, we simulate a redeploy.
  const res = await fetch(`https://backboard.railway.app/graphql/v2`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `mutation serviceInstanceRedeploy($serviceId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId)
      }`,
      variables: { serviceId },
    }),
  });

  if (!res.ok) throw new Error(`Railway API error: ${res.statusText}`);
}

async function getRevertHistory(workspaceId) {
  return prisma.revertEvent.findMany({
    where: { workspace_id: workspaceId },
    orderBy: { triggered_at: 'desc' },
  });
}

module.exports = {
  triggerRevert,
  getRevertHistory,
};
