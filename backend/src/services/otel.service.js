const { config } = require('../lib/config');

let traceProvider;
let tracer;
let initialized = false;

/**
 * Initialize OpenTelemetry tracing.
 * Sets up OTLP exporter and auto-instrumentation for Express/HTTP.
 */
function initTracing() {
  if (initialized) return traceProvider;
  if (!config.OTLP_ENDPOINT) {
    console.log('[OTEL] No OTLP_ENDPOINT configured. Tracing disabled.');
    return null;
  }

  try {
    const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
    const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { Resource } = require('@opentelemetry/resources');
    const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');
    const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
    const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

    const resource = new Resource({
      [ATTR_SERVICE_NAME]: config.OTLP_SERVICE_NAME || 'nexusops-backend',
    });

    const exporter = new OTLPTraceExporter({
      url: `${config.OTLP_ENDPOINT}/v1/traces`,
    });

    traceProvider = new NodeTracerProvider({ resource });
    traceProvider.addSpanProcessor(new BatchSpanProcessor(exporter));

    // Register auto-instrumentation
    const { registerInstrumentations } = require('@opentelemetry/instrumentation');
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation(),
        new ExpressInstrumentation(),
      ],
    });

    traceProvider.register();
    tracer = traceProvider.getTracer('nexusops');
    initialized = true;

    console.log(`[OTEL] Tracing initialized. Endpoint: ${config.OTLP_ENDPOINT}`);
    return traceProvider;
  } catch (err) {
    console.warn(`[OTEL] Failed to initialize tracing: ${err.message}`);
    return null;
  }
}

/**
 * Get the tracer instance. Returns a no-op tracer if OTEL is not configured.
 */
function getTracer() {
  if (!initialized) initTracing();
  if (tracer) return tracer;

  // Return no-op tracer
  return {
    startSpan: () => ({
      setAttribute: () => {},
      setStatus: () => {},
      addEvent: () => {},
      recordException: () => {},
      end: () => {},
      spanContext: () => ({ traceId: '', spanId: '' }),
    }),
  };
}

/**
 * Create a traced span for incident processing pipeline.
 */
async function traceIncidentPipeline(incidentId, fn) {
  const activeTracer = getTracer();
  const span = activeTracer.startSpan('autofix.pipeline', {
    attributes: { 'incident.id': incidentId },
  });

  try {
    const result = await fn(span);
    span.setStatus({ code: 1 }); // OK
    return result;
  } catch (err) {
    span.setStatus({ code: 2, message: err.message }); // ERROR
    span.recordException(err);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Trace a memory/RAG query.
 */
async function traceMemoryQuery(workspaceId, query, fn) {
  const activeTracer = getTracer();
  const span = activeTracer.startSpan('memory.query', {
    attributes: { 'workspace.id': workspaceId, 'memory.query': query.slice(0, 200) },
  });

  try {
    const result = await fn(span);
    span.setStatus({ code: 1 });
    return result;
  } catch (err) {
    span.setStatus({ code: 2, message: err.message });
    span.recordException(err);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Trace a document ingestion.
 */
async function traceIngestion(workspaceId, sourceType, fn) {
  const activeTracer = getTracer();
  const span = activeTracer.startSpan('memory.ingestion', {
    attributes: { 'workspace.id': workspaceId, 'source.type': sourceType },
  });

  try {
    const result = await fn(span);
    span.setStatus({ code: 1 });
    return result;
  } catch (err) {
    span.setStatus({ code: 2, message: err.message });
    span.recordException(err);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Get current trace ID from context (for correlation).
 */
function getCurrentTraceId() {
  const api = require('@opentelemetry/api');
  const span = api.trace.getActiveSpan();
  if (span) {
    const ctx = span.spanContext();
    return ctx.traceId || null;
  }
  return null;
}

/**
 * Express middleware to inject trace context into responses.
 */
function traceMiddleware(req, res, next) {
  const traceId = getCurrentTraceId();
  if (traceId) {
    res.setHeader('X-Trace-Id', traceId);
    req.traceId = traceId;
  }
  next();
}

/**
 * Get tracing health/status.
 */
function getTraceStatus() {
  return {
    initialized,
    endpoint: config.OTLP_ENDPOINT || null,
    serviceName: config.OTLP_SERVICE_NAME,
  };
}

module.exports = {
  initTracing,
  getTracer,
  traceIncidentPipeline,
  traceMemoryQuery,
  traceIngestion,
  getCurrentTraceId,
  traceMiddleware,
  getTraceStatus,
};
