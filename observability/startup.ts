// Re-exporting functions needed for application startup/shutdown
import { initOpenTelemetry } from './index';
import { createLogger } from './logging';
import { recordAppInfo, recordMemoryUsage } from './metrics';

const logger = createLogger('observability-startup');

// Function to initialize observability - should be called as early as possible
export function initializeObservability() {
  console.log('Starting observability initialization...');
  
  try {
    // Initialize OpenTelemetry
    const telemetry = initOpenTelemetry();
    
    // Record application info metrics
    recordAppInfo('1.0.0', process.env.NODE_ENV || 'development');
    
    // Start periodic memory usage recording
    const memoryInterval = setInterval(() => {
      recordMemoryUsage();
    }, 60000); // Record every minute
    
    // Store interval for cleanup
    if (typeof global !== 'undefined') {
      (global as any).__memoryMetricsInterval = memoryInterval;
    }
    
    console.log('Observability initialization completed.');
    
    return {
      ...telemetry,
      cleanup: () => cleanupObservability(memoryInterval)
    };
  } catch (error) {
    console.error('Failed to initialize observability:', error);
    // Return stub implementation to avoid crashes
    return {
      sdk: null,
      trace: null,
      context: null,
      metrics: null,
      cleanup: () => {}
    };
  }
}

// Function to clean up observability resources
export function cleanupObservability(memoryInterval?: NodeJS.Timeout) {
  logger.info('Cleaning up observability resources');
  
  // Clear memory metrics interval if it exists
  if (memoryInterval) {
    clearInterval(memoryInterval);
  } else if (typeof global !== 'undefined' && (global as any).__memoryMetricsInterval) {
    clearInterval((global as any).__memoryMetricsInterval);
    delete (global as any).__memoryMetricsInterval;
  }
  
  // Add any additional cleanup logic here
}