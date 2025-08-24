/**
 * Comprehensive logging utility that respects environment variables
 * and provides different log levels for development and production
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  enableDebugger: boolean;
  enableTimestamps: boolean;
  enableColors: boolean;
  prefix?: string;
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    this.config = this.initializeConfig();
  }

  private initializeConfig(): LoggerConfig {
    // Get environment variables with fallbacks
    const isDevelopment = import.meta.env.MODE === 'development';
    const isProduction = import.meta.env.MODE === 'production';

    // Environment variable controls
    const logEnabled = import.meta.env.VITE_LOGGING_ENABLED !== 'false'; // Default to true
    const logLevel = this.parseLogLevel(import.meta.env.VITE_LOG_LEVEL);
    const debuggerEnabled = import.meta.env.VITE_ENABLE_DEBUGGER === 'true' || isDevelopment;
    const timestampsEnabled = import.meta.env.VITE_LOG_TIMESTAMPS !== 'false'; // Default to true
    const colorsEnabled = import.meta.env.VITE_LOG_COLORS !== 'false' && !isProduction; // Default to true in dev
    const logPrefix = import.meta.env.VITE_LOG_PREFIX || '[QBO]';

    return {
      enabled: logEnabled && (isDevelopment || import.meta.env.VITE_PROD_LOGGING === 'true'),
      level: logLevel,
      enableDebugger: debuggerEnabled,
      enableTimestamps: timestampsEnabled,
      enableColors: colorsEnabled,
      prefix: logPrefix
    };
  }

  private parseLogLevel(levelStr?: string): LogLevel {
    if (!levelStr) {
      return import.meta.env.MODE === 'development' ? LogLevel.DEBUG : LogLevel.WARN;
    }

    switch (levelStr.toUpperCase()) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      case 'TRACE': return LogLevel.TRACE;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.config.enabled && level <= this.config.level;
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): [string, ...any[]] {
    const parts: string[] = [];

    if (this.config.enableTimestamps) {
      parts.push(new Date().toISOString());
    }

    if (this.config.prefix) {
      parts.push(this.config.prefix);
    }

    const levelName = LogLevel[level];
    if (this.config.enableColors && typeof window !== 'undefined') {
      // Browser console styling
      parts.push(`%c[${levelName}]`);
    } else {
      parts.push(`[${levelName}]`);
    }

    const prefix = parts.join(' ');
    
    if (this.config.enableColors && typeof window !== 'undefined') {
      const color = this.getLevelColor(level);
      return [`${prefix} ${message}`, `color: ${color}; font-weight: bold`, ...args];
    }
    
    return [`${prefix} ${message}`, ...args];
  }

  private getLevelColor(level: LogLevel): string {
    const colors = {
      [LogLevel.ERROR]: '#ff0000',
      [LogLevel.WARN]: '#ffaa00',
      [LogLevel.INFO]: '#0099ff',
      [LogLevel.DEBUG]: '#9900ff',
      [LogLevel.TRACE]: '#666666'
    };
    return colors[level];
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const [formattedMsg, ...formattedArgs] = this.formatMessage(LogLevel.ERROR, message, ...args);
      console.error(formattedMsg, ...formattedArgs);
      
      // Also log errors to a service in production if needed
      if (import.meta.env.MODE === 'production' && args[0] instanceof Error) {
        this.logErrorToService(args[0]);
      }
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const [formattedMsg, ...formattedArgs] = this.formatMessage(LogLevel.WARN, message, ...args);
      console.warn(formattedMsg, ...formattedArgs);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const [formattedMsg, ...formattedArgs] = this.formatMessage(LogLevel.INFO, message, ...args);
      console.log(formattedMsg, ...formattedArgs);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const [formattedMsg, ...formattedArgs] = this.formatMessage(LogLevel.DEBUG, message, ...args);
      console.log(formattedMsg, ...formattedArgs);
    }
  }

  trace(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      const [formattedMsg, ...formattedArgs] = this.formatMessage(LogLevel.TRACE, message, ...args);
      console.log(formattedMsg, ...formattedArgs);
    }
  }

  /**
   * Debugger breakpoint that only triggers in development when enabled
   */
  debugBreak(message?: string): void {
    if (this.config.enableDebugger) {
      if (message) {
        this.debug(`DEBUGGER: ${message}`);
      }
      // eslint-disable-next-line no-debugger
      debugger;
    }
  }

  /**
   * Group logging for better organization
   */
  group(label: string): void {
    if (this.config.enabled) {
      console.group(label);
    }
  }

  groupEnd(): void {
    if (this.config.enabled) {
      console.groupEnd();
    }
  }

  /**
   * Table logging for structured data
   */
  table(data: any): void {
    if (this.config.enabled && this.shouldLog(LogLevel.DEBUG)) {
      console.table(data);
    }
  }

  /**
   * Time measurement utilities
   */
  time(label: string): void {
    if (this.config.enabled && this.shouldLog(LogLevel.DEBUG)) {
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (this.config.enabled && this.shouldLog(LogLevel.DEBUG)) {
      console.timeEnd(label);
    }
  }

  /**
   * Log to external service (implement as needed)
   */
  private logErrorToService(error: Error): void {
    // Implement external error logging service integration here
    // e.g., Sentry, LogRocket, etc.
  }

  /**
   * Create a child logger with a specific prefix
   */
  child(prefix: string): Logger {
    const childLogger = new Logger();
    childLogger.config = {
      ...this.config,
      prefix: `${this.config.prefix} [${prefix}]`
    };
    return childLogger;
  }
}

// Create singleton instance
const logger = new Logger();

// Export both the instance and the class for flexibility
export { logger, Logger };
export default logger;