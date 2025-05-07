import { diag, DiagLogLevel, DiagConsoleLogger, trace, context } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import * as resources from '@opentelemetry/resources';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// Switch from HTTP to gRPC exporter for traces
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
// Import the default exports for instrumentation
import HttpInstrumentationModule from '@opentelemetry/instrumentation-http';
import ExpressInstrumentationModule from '@opentelemetry/instrumentation-express';
import PgInstrumentationModule from '@opentelemetry/instrumentation-pg';
import { 
  BatchLogRecordProcessor, 
  ConsoleLogRecordExporter, 
  LoggerProvider, 
  LogRecordExporter,
  SimpleLogRecordProcessor
} from '@opentelemetry/sdk-logs';
import { register } from './metrics';
import * as metrics from './metrics';
import express from 'express';
import { requestTrackingMiddleware } from './middleware';
import { createLogger } from './logging';

// Create a logger for observability setup
const setupLogger = createLogger('otel-setup');

// Configure OpenTelemetry diagnostic logging
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// Initialize OpenTelemetry
export function initOpenTelemetry() {
  try {
    setupLogger.info('Initializing OpenTelemetry', {
      nodeEnv: process.env.NODE_ENV || 'development',
      tempoEndpoint: process.env.TEMPO_ENDPOINT || 'http://localhost:4317'
    });
    
    // Create application resource with detailed attributes
    const resource = createResource();
    
    // Set up logging first
    const loggerProvider = setupLogging(resource);
    
    // Create instrumentation instances with options for better coverage
    const instrumentations = createInstrumentations();
    
    // Create and configure OpenTelemetry SDK
    const sdk = createSDK(resource, instrumentations);
    
    // Start metrics server for custom application metrics
    const metricsApp = createMetricsEndpoint();
    
    setupLogger.info('OpenTelemetry initialization complete');
    
    return {
      sdk,
      trace,
      context,
      metrics,
      loggerProvider
    };
  } catch (error: unknown) {
    console.error('Failed to initialize OpenTelemetry:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    
    // Return minimal objects to prevent application crashes on telemetry failure
    return {
      sdk: null,
      trace,
      context,
      metrics,
      loggerProvider: null
    };
  }
}

// Create application resource with detailed attributes
function createResource() {
  const serviceNameAttr = SemanticResourceAttributes.SERVICE_NAME;
  const serviceVersionAttr = SemanticResourceAttributes.SERVICE_VERSION;
  const deploymentEnvAttr = SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT;
  
  const resourceAttributes = {
    [serviceNameAttr]: 'mission-brief',
    [serviceVersionAttr]: '1.0.0',
    [deploymentEnvAttr]: process.env.NODE_ENV || 'development',
    'custom.service.name': 'mission-brief-custom',
    'service.instance.id': `${process.pid}-${Date.now()}`,
    'application.name': 'Mission Brief API',
    'host.region': process.env.REGION || 'local'
  };
  
  // Create the resource using the resourceFromAttributes function
  return resources.resourceFromAttributes(resourceAttributes);
}

// Setup logging with OpenTelemetry
function setupLogging(resource: resources.Resource) {
  // Create the exporter for logs with proper type casting to resolve version conflicts
  const logExporter = new OTLPLogExporter({
    url: process.env.LOKI_ENDPOINT || 'http://localhost:3100/loki/api/v1/push',
  }) as unknown as LogRecordExporter;

  // Set up the logger provider with resource context
  const loggerProvider = new LoggerProvider({
    resource: resource,
  });
  
  // Add batched processor for production to optimize performance
  const batchProcessor = new BatchLogRecordProcessor(logExporter, {
    // Configure batch size and scheduling for optimal performance
    maxExportBatchSize: 100,
    scheduledDelayMillis: 1000,
  });
  loggerProvider.addLogRecordProcessor(batchProcessor);
  
  // For development, also log to console without batching for immediate feedback
  if (process.env.NODE_ENV !== 'production') {
    const consoleExporter = new ConsoleLogRecordExporter();
    loggerProvider.addLogRecordProcessor(new SimpleLogRecordProcessor(consoleExporter));
  }
  
  // Register the logger provider
  logs.setGlobalLoggerProvider(loggerProvider);
  
  return loggerProvider;
}

// Create instrumentation instances with optimized configurations
function createInstrumentations() {
  // Configure HTTP instrumentation with detailed options
  const httpInstrumentation = new HttpInstrumentationModule.HttpInstrumentation({
    ignoreOutgoingRequestHook: (request) => {
      // Ignore health check requests to reduce noise
      return request.path?.includes('/health') || false;
    },
    headersToSpanAttributes: {
      server: {
        requestHeaders: ['x-request-id', 'user-agent'],
        responseHeaders: ['content-length', 'content-type']
      },
      client: {
        requestHeaders: ['x-request-id'],
        responseHeaders: ['content-length']
      }
    }
  });

  // Express instrumentation with advanced options - fixed type error
  const expressInstrumentation = new ExpressInstrumentationModule.ExpressInstrumentation({
    ignoreLayers: [
      (name) => name === 'query' || name === 'expressInit',
      // Fixed: Properly type the ignore matcher function
      (name) => name.includes('favicon')
    ]
  });

  // PostgreSQL instrumentation with detailed options - removed unsupported property
  const pgInstrumentation = new PgInstrumentationModule.PgInstrumentation({
    enhancedDatabaseReporting: true,
    // Removed addSqlCommenterCommentToQueries as it's not in PgInstrumentationConfig
    responseHook: (span, responseInfo) => {
      if (responseInfo.data && responseInfo.data.rowCount !== undefined) {
        span.setAttribute('db.rows_affected', responseInfo.data.rowCount);
      }
    }
  });

  return [
    httpInstrumentation,
    expressInstrumentation,
    pgInstrumentation,
    // Add other instrumentation with optimized settings
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: true },
      '@opentelemetry/instrumentation-net': { enabled: true },
      '@opentelemetry/instrumentation-winston': { enabled: true },
    }),
  ];
}

// Create and configure OpenTelemetry SDK
function createSDK(resource: resources.Resource, instrumentations: any[]) {
  // Create SDK with optimized configuration
  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({
      url: process.env.TEMPO_ENDPOINT || 'http://localhost:4317',
      timeoutMillis: 15000,  // Increased timeout for reliability
    }),
    metricReader: new PrometheusExporter({
      port: process.env.PROMETHEUS_PORT ? parseInt(process.env.PROMETHEUS_PORT) : 9464,
      endpoint: '/metrics',
      host: '0.0.0.0', // Listening on all interfaces
    }),
    instrumentations,
    // Sampler configuration to avoid overwhelming the backend
    // samplingRatio: 1.0, // Sample 100% of requests in development
  });

  // Start SDK with error handling
  try {
    sdk.start();
    setupLogger.info('OpenTelemetry SDK started successfully');
  } catch (error: unknown) {
    setupLogger.error('Error starting OpenTelemetry SDK', 
      error instanceof Error ? error : new Error(String(error)));
  }

  return sdk;
}

// Create a middleware for exposing custom Prometheus metrics
export function createMetricsEndpoint() {
  const app = express();

  // Add basic request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      setupLogger.debug(`Metrics endpoint ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // Expose metrics endpoint
  app.get('/custom-metrics', async (_req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err: unknown) {
      setupLogger.error('Error serving metrics', err instanceof Error ? err : new Error(String(err)));
      res.status(500).end(String(err));
    }
  });

  // Add a health check endpoint
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get port from environment or use default
  const port = parseInt(process.env.CUSTOM_METRICS_PORT || '9465');
  
  try {
    app.listen(port, '0.0.0.0', () => {
      setupLogger.info(`Custom metrics endpoint available at http://localhost:${port}/custom-metrics`);
    });
  } catch (err: unknown) {
    setupLogger.error(`Failed to start metrics server on port ${port}`, 
      err instanceof Error ? err : new Error(String(err)));
    // Try a fallback port if the main one fails
    const fallbackPort = port + 1;
    try {
      app.listen(fallbackPort, '0.0.0.0', () => {
        setupLogger.info(`Custom metrics endpoint available at http://localhost:${fallbackPort}/custom-metrics (fallback port)`);
      });
    } catch (fallbackErr) {
      setupLogger.error(`Failed to start metrics server on fallback port ${fallbackPort}`, 
        fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr)));
    }
  }

  return app;
}

// Export all middleware and metrics
export { requestTrackingMiddleware } from './middleware';
export * from './metrics';