const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { config } = require('./lib/config');
const { prisma } = require('./lib/prisma');
const authRoutes = require('./routes/auth');
const workspaceRoutes = require('./routes/workspace');
const memoryRoutes = require('./routes/memory');
const autofixRoutes = require('./routes/autofix');
const dashboardRoutes = require('./routes/dashboard');
const webhookRoutes = require('./routes/webhooks');
const slackRoutes = require('./routes/slack');
const notificationRoutes = require('./routes/notifications');
const ollamaRoutes = require('./routes/ollama');
const postmortemRoutes = require('./routes/postmortems');
const { errorMiddleware } = require('./middleware/error');
const { startWorkers } = require('./workers/queue');
const { startBot } = require('./bot');
const otelService = require('./services/otel.service');

const app = express();
const corsOrigin = config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(',').map((origin) => origin.trim());

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

// OpenTelemetry tracing middleware
otelService.initTracing();
app.use(otelService.traceMiddleware);

app.get('/', (_req, res) => {
  res.json({
    message: 'NexusOps API is running',
    docs: '/api/v1/health',
    frontend: 'http://localhost:3000'
  });
});

app.get('/health', async (_req, res) => {
  let database = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    database = `error: ${error.message}`;
  }

  res.json({
    status: database === 'ok' ? 'ok' : 'degraded',
    version: '1.0.0',
    database,
  });
});

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/workspace', workspaceRoutes);
app.use('/api/v1/memory', memoryRoutes);
app.use('/api/v1/autofix', autofixRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/ollama', ollamaRoutes);
app.use('/api/v1/postmortems', postmortemRoutes);
app.use('/webhook', webhookRoutes);
app.use('/api/v1/slack', slackRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorMiddleware);

function attachSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('workspace:join', (workspaceId) => {
      if (workspaceId) socket.join(`workspace:${workspaceId}`);
    });

    socket.on('workspace:leave', (workspaceId) => {
      if (workspaceId) socket.leave(`workspace:${workspaceId}`);
    });

    socket.emit('nexus:connected', { status: 'ok' });
  });

  app.set('io', io);
  return io;
}

if (require.main === module) {
  const server = http.createServer(app);
  attachSocket(server);

  server.listen(config.PORT, '0.0.0.0', () => {
    console.log(`NexusOps API running on http://127.0.0.1:${config.PORT}`);
    console.log(`NexusOps WebSocket running on ws://127.0.0.1:${config.PORT}`);
  });

  if (process.env.START_WORKERS !== 'false') {
    startWorkers().catch((err) => {
      console.warn('Worker startup error:', err.message);
    });
  }

  if (process.env.START_BOT !== 'false') {
    startBot();
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    await otelService.shutdown().catch(() => {});
    server.close(() => process.exit(0));
  });
}

app.attachSocket = attachSocket;
module.exports = app;
