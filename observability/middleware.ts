import { trace, context, SpanStatusCode, SpanKind, Span } from '@opentelemetry/api';
import { recordHttpRequest, recordError, recordDbOperation, recordWorkerProcessing } from './metrics';
import { createLogger } from './logging';

// Create a tracer
const tracer = trace.getTracer('mission-brief-tracer');
const logger = createLogger('middleware');

/**
 * Middleware for HTTP request monitoring
 * This middleware tracks HTTP requests, captures response time, and records errors
 */
export function requestTrackingMiddleware(req: any, res: any, next: Function) {
  const startTime = Date.now();
  const reqPath = req.path || req.url || '/unknown';
  const method = req.method || 'UNKNOWN';
  
  // Create a span representing this request
  const span = tracer.startSpan(`HTTP ${method} ${reqPath}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'http.method': method,
      'http.url': req.url,
      'http.path': reqPath,
      'http.host': req.headers.host,
      'http.user_agent': req.headers['user-agent'],
      'http.request_id': req.headers['x-request-id'] || generateRequestId(),
    },
  });
  
  // Add user and workspace context if available
  if (req.user) {
    span.setAttribute('user.id', req.user.userID || 'unknown');
    span.setAttribute('workspace.id', req.user.workspaceID || 'unknown');
  }

  // Store the span in the request context for child spans to access
  req.span = span;
  
  // Track original end function
  const originalEnd = res.end;
  
  // Override end function to capture response data
  res.end = function(chunk: any, encoding: string, callback: Function) {
    // Get response time in milliseconds
    const duration = Date.now() - startTime;
    
    // Record metrics
    recordHttpRequest(
      method,
      reqPath,
      res.statusCode,
      duration / 1000 // Convert to seconds
    );
    
    // Set span attributes for the response
    span.setAttribute('http.status_code', res.statusCode);
    span.setAttribute('http.response_duration_ms', duration);
    
    // Mark errors
    if (res.statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${res.statusCode} returned`,
      });
      
      // Record error metric
      recordError('http', `${method}_${res.statusCode}`);
      
      // Add error details to span
      span.setAttribute('error', true);
      span.setAttribute('error.type', 'http');
      span.setAttribute('error.status', res.statusCode);
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }
    
    // End the span
    span.end();
    
    // Log the request summary
    logger.info(`${method} ${reqPath} ${res.statusCode} ${duration}ms`, {
      method,
      path: reqPath,
      statusCode: res.statusCode,
      durationMs: duration
    });
    
    // Call original end
    return originalEnd.call(this, chunk, encoding, callback);
  };
  
  // Continue with next middleware
  next();
}

/**
 * Observability middleware for creating spans and traces
 */

/**
 * Creates a database operation span for tracing purposes
 * @param operation The database operation (e.g., SELECT, INSERT, etc.)
 * @param table The database table being operated on
 * @param query The SQL query being executed
 * @returns An object with an end method to complete the span
 */
export function createDatabaseSpan(operation: string, table: string, query?: string) {
  // Simple implementation that just logs information
  console.debug(`[DB SPAN] ${operation} on ${table}${query ? ': ' + query : ''}`);
  
  return {
    end: (status: 'success' | 'error') => {
      console.debug(`[DB SPAN] ${operation} on ${table} completed with status: ${status}`);
    }
  };
}

/**
 * Utility for wrapping worker functions with tracing
 * Generic type T ensures the function signature is preserved
 */
export function wrapWorkerWithTracing<T extends (...args: any[]) => Promise<any>>(worker: string, handler: T): T {
  return (async function(this: any, ...args: any[]) {
    const eventType = args[0]?.eventType || 'unknown';
    const startTime = Date.now();
    
    const span = tracer.startSpan(`Worker ${worker} processing ${eventType}`, {
      kind: SpanKind.CONSUMER,
      attributes: {
        'worker.name': worker,
        'event.type': eventType,
      },
    });
    
    try {
      // Set the active span for this operation
      return await context.with(trace.setSpan(context.active(), span), async () => {
        const result = await handler.apply(this, args);
        const duration = Date.now() - startTime;
        
        // Record worker processing metrics
        recordWorkerProcessing(worker, eventType, 'success', duration / 1000);
        
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        
        return result;
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record error metrics
      recordWorkerProcessing(worker, eventType, 'error', duration / 1000);
      recordError('worker', worker);
      
      // Update span with error information
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      
      if (error instanceof Error) {
        span.recordException(error);
      } else {
        span.recordException(new Error(String(error)));
      }
      span.end();
      
      throw error;
    }
  }) as T;
}

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}