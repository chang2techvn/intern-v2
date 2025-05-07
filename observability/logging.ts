import { SeverityNumber, logs } from '@opentelemetry/api-logs';
import * as fs from 'fs';
import * as path from 'path';

// Create logs directory if it doesn't exist
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Log file path
const logFile = path.join(logDir, 'application.log');

// Function to write log to file
function writeToLogFile(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} ${message}\n`;
  
  fs.appendFile(logFile, logMessage, (err) => {
    if (err) {
      console.error('Failed to write to log file:', err);
    }
  });
}

/**
 * Logger class that integrates with OpenTelemetry and writes to file
 */
export class Logger {
  private logger: any;
  private name: string;
  
  constructor(name: string) {
    this.logger = logs.getLogger(name);
    this.name = name;
  }

  /**
   * Log an informational message
   */
  info(message: string, attributes: Record<string, any> = {}) {
    this.logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: message,
      attributes
    });
    
    const logMessage = `[INFO] [${this.name}] ${message} ${JSON.stringify(attributes)}`;
    console.log(logMessage);
    writeToLogFile(logMessage);
  }

  /**
   * Log a warning message
   */
  warn(message: string, attributes: Record<string, any> = {}) {
    this.logger.emit({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body: message,
      attributes
    });
    
    const logMessage = `[WARN] [${this.name}] ${message} ${JSON.stringify(attributes)}`;
    console.warn(logMessage);
    writeToLogFile(logMessage);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, attributes: Record<string, any> = {}) {
    const enhancedAttributes = { ...attributes };
    
    if (error) {
      enhancedAttributes.error = error.message;
      enhancedAttributes.stack = error.stack;
    }
    
    this.logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: message,
      attributes: enhancedAttributes
    });
    
    const logMessage = `[ERROR] [${this.name}] ${message} ${error ? (error.stack || error.message) : ''} ${JSON.stringify(enhancedAttributes)}`;
    console.error(logMessage);
    writeToLogFile(logMessage);
  }

  /**
   * Log a debug message
   */
  debug(message: string, attributes: Record<string, any> = {}) {
    this.logger.emit({
      severityNumber: SeverityNumber.DEBUG,
      severityText: 'DEBUG',
      body: message,
      attributes
    });
    
    const logMessage = `[DEBUG] [${this.name}] ${message} ${JSON.stringify(attributes)}`;
    console.debug(logMessage);
    writeToLogFile(logMessage);
  }
}

// Factory function to create logger instances
export function createLogger(name: string): Logger {
  return new Logger(name);
}

// Default logger instance
export const logger = createLogger('mission-brief');