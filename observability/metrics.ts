import * as prom from 'prom-client';
import { metrics } from '@opentelemetry/api';

// Create Prometheus registry
export const register = new prom.Registry();

// Add default metrics
prom.collectDefaultMetrics({ register });

// Create a meter to record metrics
const meter = metrics.getMeter('mission-brief');

// HTTP metrics
export const httpRequestCounter = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests',
});

export const httpResponseTimeHistogram = meter.createHistogram('http_response_time_seconds', {
  description: 'HTTP response time in seconds',
});

export const httpErrorCounter = meter.createCounter('http_error_total', {
  description: 'Total number of HTTP errors',
});

// Add detailed API endpoint metrics
export const apiEndpointCounter = meter.createCounter('api_endpoint_calls_total', {
  description: 'Total number of API endpoint calls',
});

export const apiEndpointHistogram = meter.createHistogram('api_endpoint_duration_seconds', {
  description: 'API endpoint execution time in seconds',
});

export const apiErrorCounter = meter.createCounter('api_errors_total', {
  description: 'Total number of API errors by endpoint',
});

// Database metrics
export const dbQueryCounter = meter.createCounter('db_queries_total', {
  description: 'Total number of database queries',
});

export const dbQueryTimeHistogram = meter.createHistogram('db_query_time_seconds', {
  description: 'Database query execution time in seconds',
});

export const dbErrorCounter = meter.createCounter('db_error_total', {
  description: 'Total number of database errors',
});

export const dbConnectionGauge = new prom.Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

// Worker metrics
export const workerExecutionCounter = meter.createCounter('worker_executions_total', {
  description: 'Total number of worker executions',
});

export const workerExecutionTimeHistogram = meter.createHistogram('worker_execution_time_seconds', {
  description: 'Worker execution time in seconds',
});

export const workerErrorCounter = meter.createCounter('worker_error_total', {
  description: 'Total number of worker errors',
});

export const queueSizeGauge = new prom.Gauge({
  name: 'queue_size_current',
  help: 'Current size of the worker queue',
  labelNames: ['queue_name'],
  registers: [register],
});

// Worker processing metrics by task type
export const workerProcessingCounter = meter.createCounter('worker_processing_total', {
  description: 'Total number of worker tasks processed by type',
});

export const workerProcessingTimeHistogram = meter.createHistogram('worker_processing_time_seconds', {
  description: 'Worker processing time by task type in seconds',
});

// Business metrics
export const leadCreationCounter = meter.createCounter('lead_creation_total', {
  description: 'Total number of leads created',
});

export const offerCreationCounter = meter.createCounter('offer_creation_total', {
  description: 'Total number of offers created',
});

export const quoteConversionCounter = meter.createCounter('quote_conversion_total', {
  description: 'Total number of quotes that converted to sales',
});

export const conversionRateGauge = new prom.Gauge({
  name: 'quote_conversion_rate',
  help: 'Rate of quotes that convert to sales',
  registers: [register],
});

// Application health metrics
export const appInfoGauge = new prom.Gauge({
  name: 'app_info',
  help: 'Information about the application version and environment',
  labelNames: ['version', 'environment'],
  registers: [register],
});

export const lastErrorTimestamp = new prom.Gauge({
  name: 'last_error_timestamp',
  help: 'Unix timestamp of the last error by type',
  labelNames: ['error_type'],
  registers: [register],
});

// Track JWT token errors
export const authErrorCounter = meter.createCounter('auth_error_total', {
  description: 'Total number of authentication/authorization errors',
});

// Memory usage metrics
export const memoryUsage = new prom.Gauge({
  name: 'process_memory_usage_bytes',
  help: 'Memory usage of the Node.js process',
  labelNames: ['type'],
  registers: [register],
});

// General error tracking
export const errorCounter = meter.createCounter('errors_total', {
  description: 'Total number of errors by category and type',
});

// Helper functions to record metrics

/**
 * Records an HTTP request with its metrics
 * @param method The HTTP method (e.g., GET, POST)
 * @param path The request path or route
 * @param statusCode The HTTP status code
 * @param duration The duration of the request in seconds
 */
export function recordHttpRequest(method: string, path: string, statusCode: number, duration: number) {
  // Log information
  console.debug(`[HTTP METRIC] ${method} ${path} ${statusCode} ${duration}s`);
  
  // Record metrics if in production
  if (process.env.NODE_ENV === 'production') {
    httpRequestCounter.add(1, { method, route: path });
    httpResponseTimeHistogram.record(duration, { method, route: path });
    
    if (statusCode >= 400) {
      httpErrorCounter.add(1, { method, route: path, statusCode: statusCode.toString() });
    }
  }
}

/**
 * Records API endpoint metrics
 */
export function recordApiCall(endpoint: string, method: string, statusCode: number, duration: number) {
  apiEndpointCounter.add(1, { endpoint, method });
  apiEndpointHistogram.record(duration, { endpoint, method });
  
  if (statusCode >= 400) {
    apiErrorCounter.add(1, { endpoint, method, statusCode: statusCode.toString() });
  }
}

/**
 * Records database operation metrics
 * @param operation The database operation (e.g., SELECT, INSERT)
 * @param table The database table
 * @param success Whether the operation was successful
 * @param duration The duration of the operation in seconds
 */
export function recordDbOperation(operation: string, table: string, success: boolean, duration: number) {
  // Log information
  console.debug(`[DB METRIC] ${operation} on ${table} - Success: ${success}, Duration: ${duration}s`);
  
  // Record metrics if in production
  if (process.env.NODE_ENV === 'production') {
    dbQueryCounter.add(1, { operation, table });
    dbQueryTimeHistogram.record(duration, { operation, table });
    
    if (!success) {
      dbErrorCounter.add(1, { operation, table });
    }
  }
}

/**
 * Records worker execution metrics
 */
export function recordWorkerExecution(workerName: string, success: boolean, duration: number) {
  workerExecutionCounter.add(1, { worker: workerName });
  workerExecutionTimeHistogram.record(duration, { worker: workerName });
  
  if (!success) {
    workerErrorCounter.add(1, { worker: workerName });
  }
}

/**
 * Records worker processing metrics
 * @param worker The worker name
 * @param eventType The type of event being processed
 * @param result The result of processing (success or error)
 * @param duration The duration of processing in seconds
 */
export function recordWorkerProcessing(worker: string, eventType: string, result: 'success' | 'error', duration: number) {
  // Log information
  console.debug(`[WORKER METRIC] ${worker} processing ${eventType} - Result: ${result}, Duration: ${duration}s`);
  
  // Record metrics if in production
  if (process.env.NODE_ENV === 'production') {
    workerProcessingCounter.add(1, { worker, task_type: eventType, status: result });
    workerProcessingTimeHistogram.record(duration, { worker, task_type: eventType });
  }
}

/**
 * Updates the queue size metric
 */
export function updateQueueSize(queueName: string, size: number) {
  queueSizeGauge.set({ queue_name: queueName }, size);
}

/**
 * Records lead creation metrics
 */
export function recordLeadCreation(source: string) {
  leadCreationCounter.add(1, { source });
}

/**
 * Records offer creation metrics
 */
export function recordOfferCreation(productType: string) {
  offerCreationCounter.add(1, { product_type: productType });
}

/**
 * Records quote conversion metrics
 */
export function recordQuoteConversion(productType: string) {
  quoteConversionCounter.add(1, { product_type: productType });
}

/**
 * Updates the conversion rate metric
 */
export function updateConversionRate(rate: number) {
  conversionRateGauge.set(rate);
}

/**
 * Records authentication error metrics
 */
export function recordAuthError(errorType: string) {
  authErrorCounter.add(1, { error_type: errorType });
  lastErrorTimestamp.set({ error_type: `auth_${errorType}` }, Date.now() / 1000);
}

/**
 * Records general error metrics
 * @param source The source of the error (e.g., 'database', 'api', 'worker')
 * @param type The type or category of the error
 */
export function recordError(source: string, type: string) {
  // Log information
  console.warn(`[ERROR METRIC] Source: ${source}, Type: ${type}`);
  
  // Record metrics if in production
  if (process.env.NODE_ENV === 'production') {
    errorCounter.add(1, { category: source, type });
    lastErrorTimestamp.set({ error_type: `${source}_${type}` }, Date.now() / 1000);
  }
}

/**
 * Records application info metrics
 */
export function recordAppInfo(version: string, environment: string) {
  appInfoGauge.set({ version, environment }, 1);
}

/**
 * Records current memory usage metrics
 */
export function recordMemoryUsage() {
  const memUsage = process.memoryUsage();
  memoryUsage.set({ type: 'rss' }, memUsage.rss);
  memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
  memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
  memoryUsage.set({ type: 'external' }, memUsage.external);
  
  return memUsage;
}