/**
 * Structured Logging Utility
 *
 * Provides consistent structured logging for the application with proper
 * typing and context support.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogContext {
  [key: string]: any;
}

/**
 * Structured logger that outputs JSON in production and formatted in development
 */
class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, event: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      event,
      ...context
    };

    if (this.isDevelopment) {
      // Formatted output for development
      const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : '';
      return `[${timestamp}] ${level.toUpperCase()} ${event}${contextStr}`;
    }

    // JSON output for production (easier to parse)
    return JSON.stringify(logEntry);
  }

  /**
   * Log informational events (normal operation)
   */
  info(event: string, context?: LogContext): void {
    console.log(this.formatMessage('info', event, context));
  }

  /**
   * Log warnings (something unexpected but not critical)
   */
  warn(event: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', event, context));
  }

  /**
   * Log errors (failures that need attention)
   */
  error(event: string, context?: LogContext): void {
    console.error(this.formatMessage('error', event, context));
  }

  /**
   * Log debug information (verbose, development only)
   */
  debug(event: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', event, context));
    }
  }
}

export const logger = new Logger();
