/**
 * Structured Logging Utility
 *
 * Provides consistent structured logging for the application with proper
 * typing and context support.
 *
 * Features:
 * - Toggle individual log levels on/off via environment variables or runtime API
 * - Persist settings in localStorage (browser only)
 * - Namespaced loggers for component-specific control
 *
 * Configuration:
 * - Environment: NEXT_PUBLIC_LOG_LEVELS=error,warn,info (comma-separated)
 * - Runtime: logger.enable('debug') / logger.disable('info')
 * - Browser console: window.__LOGGER__.enable('debug')
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

/** Log level priority (lower = more verbose) */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** All available log levels */
const ALL_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

/** localStorage key for persisted settings */
const STORAGE_KEY = 'scottish_ai_log_config';

/** Default enabled levels by environment */
const DEFAULT_LEVELS: Record<string, LogLevel[]> = {
  development: ['debug', 'info', 'warn', 'error'],
  production: ['warn', 'error'],
  test: ['error'],
};

/**
 * Parse log levels from environment variable or string
 * @param value - Comma-separated log levels (e.g., "error,warn,info")
 */
function parseLogLevels(value: string | undefined): LogLevel[] | null {
  if (!value) return null;

  const levels = value
    .split(',')
    .map(l => l.trim().toLowerCase())
    .filter((l): l is LogLevel => ALL_LEVELS.includes(l as LogLevel));

  return levels.length > 0 ? levels : null;
}

/**
 * Load persisted log configuration from localStorage (browser only)
 */
function loadPersistedConfig(): { enabled: LogLevel[] } | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const config = JSON.parse(stored);
    if (config.enabled && Array.isArray(config.enabled)) {
      return { enabled: config.enabled.filter((l: string) => ALL_LEVELS.includes(l as LogLevel)) };
    }
  } catch {
    // localStorage not available or corrupted - ignore
  }
  return null;
}

/**
 * Save log configuration to localStorage (browser only)
 */
function savePersistedConfig(enabled: LogLevel[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled }));
  } catch {
    // localStorage not available - ignore
  }
}

/**
 * Structured logger with configurable log levels
 */
class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private enabledLevels: Set<LogLevel>;
  private namespace: string | null = null;

  constructor(namespace?: string) {
    this.namespace = namespace || null;
    this.enabledLevels = new Set(this.initializeEnabledLevels());

    // Expose logger API on window for browser debugging
    if (typeof window !== 'undefined' && !namespace) {
      (window as any).__LOGGER__ = this;
    }
  }

  /**
   * Initialize enabled levels with priority:
   * 1. localStorage (persisted user preference)
   * 2. Environment variable NEXT_PUBLIC_LOG_LEVELS
   * 3. Default based on NODE_ENV
   */
  private initializeEnabledLevels(): LogLevel[] {
    // Priority 1: Persisted user preference
    const persisted = loadPersistedConfig();
    if (persisted) {
      return persisted.enabled;
    }

    // Priority 2: Environment variable
    const envLevels = parseLogLevels(process.env.NEXT_PUBLIC_LOG_LEVELS);
    if (envLevels) {
      return envLevels;
    }

    // Priority 3: Default by environment
    const env = process.env.NODE_ENV || 'development';
    return DEFAULT_LEVELS[env] || DEFAULT_LEVELS.development;
  }

  /**
   * Check if a log level is currently enabled
   */
  isEnabled(level: LogLevel): boolean {
    return this.enabledLevels.has(level);
  }

  /**
   * Enable a specific log level
   * @param level - Log level to enable
   * @param persist - Save to localStorage (default: true)
   */
  enable(level: LogLevel, persist = true): void {
    this.enabledLevels.add(level);
    if (persist) {
      savePersistedConfig(Array.from(this.enabledLevels));
    }
  }

  /**
   * Disable a specific log level
   * @param level - Log level to disable
   * @param persist - Save to localStorage (default: true)
   */
  disable(level: LogLevel, persist = true): void {
    this.enabledLevels.delete(level);
    if (persist) {
      savePersistedConfig(Array.from(this.enabledLevels));
    }
  }

  /**
   * Set minimum log level (enables this level and all more severe levels)
   * @param minLevel - Minimum level to enable
   * @param persist - Save to localStorage (default: true)
   */
  setMinLevel(minLevel: LogLevel, persist = true): void {
    const minPriority = LOG_LEVEL_PRIORITY[minLevel];
    const newEnabled = ALL_LEVELS.filter(l => LOG_LEVEL_PRIORITY[l] >= minPriority);
    this.enabledLevels = new Set(newEnabled);
    if (persist) {
      savePersistedConfig(newEnabled);
    }
  }

  /**
   * Set specific enabled levels (replaces current configuration)
   * @param levels - Array of levels to enable
   * @param persist - Save to localStorage (default: true)
   */
  setLevels(levels: LogLevel[], persist = true): void {
    this.enabledLevels = new Set(levels);
    if (persist) {
      savePersistedConfig(levels);
    }
  }

  /**
   * Get currently enabled log levels
   */
  getEnabledLevels(): LogLevel[] {
    return Array.from(this.enabledLevels);
  }

  /**
   * Reset to default configuration (clears localStorage)
   */
  reset(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    this.enabledLevels = new Set(this.initializeEnabledLevels());
  }

  /**
   * Create a namespaced logger for a specific component/module
   * Inherits enabled levels from parent logger
   */
  createNamespace(namespace: string): Logger {
    const child = new Logger(namespace);
    child.enabledLevels = this.enabledLevels;
    return child;
  }

  private formatMessage(level: LogLevel, event: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = this.namespace ? `[${this.namespace}]` : '';
    const logEntry = {
      timestamp,
      level,
      ...(this.namespace && { namespace: this.namespace }),
      event,
      ...context
    };

    if (this.isDevelopment) {
      // Formatted output for development
      const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}${prefix} ${event}${contextStr}`;
    }

    // JSON output for production (easier to parse)
    return JSON.stringify(logEntry);
  }

  /**
   * Log debug information (verbose, for development debugging)
   */
  debug(event: string, context?: LogContext): void {
    if (this.enabledLevels.has('debug')) {
      console.debug(this.formatMessage('debug', event, context));
    }
  }

  /**
   * Log informational events (normal operation)
   */
  info(event: string, context?: LogContext): void {
    if (this.enabledLevels.has('info')) {
      console.log(this.formatMessage('info', event, context));
    }
  }

  /**
   * Log warnings (something unexpected but not critical)
   */
  warn(event: string, context?: LogContext): void {
    if (this.enabledLevels.has('warn')) {
      console.warn(this.formatMessage('warn', event, context));
    }
  }

  /**
   * Log errors (failures that need attention)
   */
  error(event: string, context?: LogContext): void {
    if (this.enabledLevels.has('error')) {
      console.error(this.formatMessage('error', event, context));
    }
  }
}

export const logger = new Logger();

/**
 * Convenience function to create namespaced loggers
 * @example
 * const log = createLogger('PracticeWizard');
 * log.info('Session started', { lessonId: '123' });
 */
export function createLogger(namespace: string): Logger {
  return logger.createNamespace(namespace);
}
