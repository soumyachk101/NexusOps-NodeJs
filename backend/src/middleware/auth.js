const { prisma } = require('../lib/prisma');
const { AppError, asyncHandler } = require('../lib/http');
const { verifyToken } = require('../lib/tokens');

const verifyAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token) {
    throw new AppError(401, 'Unauthorized: bearer token required');
  }

  let payload;
  try {
    // 1. Try local JWT verification (HS256)
    payload = verifyToken(token);
  } catch (err) {
    // 2. If local fails, try Firebase verification
    try {
      const { verifyFirebaseIdToken } = require('../services/auth.service');
      const decoded = await verifyFirebaseIdToken(token);
      
      // Map Firebase user to local user
      const { prisma } = require('../lib/prisma');
      const user = await prisma.user.findUnique({ where: { email: decoded.email } });
      
      if (user) {
        req.user = user;
        return next();
      }
      
      console.warn(`Auth failed: Firebase token verified but user ${decoded.email} not found in DB`);
      throw new AppError(401, 'Unauthorized: user not synced');
    } catch (firebaseErr) {
      console.warn(`Auth failed: Both local and Firebase verification failed. Local: ${err.message}, Firebase: ${firebaseErr.message}`);
      throw new AppError(401, 'Unauthorized: invalid token');
    }
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.is_active) {
    throw new AppError(401, 'Unauthorized: user not found');
  }

  req.user = user;
  next();
});

const optionalAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token) return next();

  try {
    const payload = verifyToken(token);
    req.user = await prisma.user.findUnique({ where: { id: payload.sub } });
  } catch (_err) {
    try {
      const { verifyFirebaseIdToken } = require('../services/auth.service');
      const decoded = await verifyFirebaseIdToken(token);
      const { prisma } = require('../lib/prisma');
      req.user = await prisma.user.findUnique({ where: { email: decoded.email } });
    } catch (_firebaseErr) {
      req.user = null;
    }
  }

  next();
});

const requireWorkspaceAccess = asyncHandler(async (req, _res, next) => {
  const workspaceId = req.params.workspaceId || req.params.id || req.query.workspace_id || req.body.workspace_id;
  if (!workspaceId) {
    throw new AppError(400, 'workspace_id is required');
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspace_id_user_id: {
        workspace_id: workspaceId,
        user_id: req.user.id,
      },
    },
  });

  if (!membership) {
    throw new AppError(403, 'Forbidden: workspace access required');
  }

  req.workspace_id = workspaceId;
  req.workspaceRole = membership.role;
  next();
});

/**
 * Require specific workspace roles. Must be used after requireWorkspaceAccess.
 * @param  {...string} roles - Allowed roles (e.g., 'admin', 'member', 'viewer')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = req.workspaceRole;
    if (!userRole) {
      return next(new AppError(403, 'Forbidden: workspace role not determined'));
    }
    if (!roles.includes(userRole)) {
      return next(new AppError(403, `Forbidden: requires one of [${roles.join(', ')}] role. Your role: ${userRole}`));
    }
    next();
  };
}

module.exports = {
  verifyAuth,
  verifyFirebaseAuth: verifyAuth,
  optionalAuth,
  requireWorkspaceAccess,
  requireRole,
};
