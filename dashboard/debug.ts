// Debug logger with different log levels
const isBrowser = typeof window !== 'undefined';
const isTTY = process.stdout?.isTTY || false;

const colors = {
  reset: isTTY ? '\x1b[0m' : '',
  bright: isTTY ? '\x1b[1m' : '',
  dim: isTTY ? '\x1b[2m' : '',
  red: isTTY ? '\x1b[31m' : '',
  green: isTTY ? '\x1b[32m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  blue: isTTY ? '\x1b[34m' : '',
  magenta: isTTY ? '\x1b[35m' : '',
  cyan: isTTY ? '\x1b[36m' : '',
};

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private readonly namespace: string;
  protected readonly enabled: boolean;

  constructor(namespace: string, enabled: boolean = true) {
    this.namespace = namespace;
    this.enabled = enabled;
  }

  /**
   * Check if debug logging is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  private format(level: LogLevel, ...args: any[]): string[] {
    if (!this.enabled) return [];
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]${this.namespace ? ` [${this.namespace}]` : ''}`;
    
    // Apply colors in Node.js environment
    if (!isBrowser) {
      const colorMap = {
        debug: colors.cyan,
        info: colors.green,
        warn: colors.yellow,
        error: colors.red,
      };
      
      return [`${colors.blue}${prefix}${colors.reset}`, ...args];
    }
    
    return [prefix, ...args];
  }

  debug(...args: any[]): void {
    if (!this.isEnabled()) return;
    const formatted = this.format('debug', ...args);
    console.debug(...formatted);
  }

  info(...args: any[]): void {
    const formatted = this.format('info', ...args);
    console.info(...formatted);
  }

  warn(...args: any[]): void {
    const formatted = this.format('warn', ...args);
    console.warn(...formatted);
  }

  error(...args: any[]): void {
    const formatted = this.format('error', ...args);
    console.error(...formatted);
  }
}

// Create a default logger instance
export const debug = new Logger(
  'NextJS',
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEBUG === 'true'
);

// Log startup info
if (debug.isEnabled()) {
  debug.info('Debug logging enabled');
  debug.debug('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    DEBUG: process.env.DEBUG,
    NEXT_PUBLIC_DEBUG: process.env.NEXT_PUBLIC_DEBUG,
    NODE_OPTIONS: process.env.NODE_OPTIONS
  });
}

// Create a function to create namespaced loggers
export const createLogger = (namespace: string): Logger => {
  return new Logger(namespace, debug.isEnabled());
};

// Export as default for ESM
export default debug;

// For CommonJS compatibility in Node.js
if (typeof module !== 'undefined' && module.exports) {
  // @ts-ignore - This is for CommonJS compatibility
  module.exports = debug;
  // @ts-ignore
  module.exports.debug = debug;
  // @ts-ignore
  module.exports.createLogger = createLogger;
  // @ts-ignore
  module.exports.default = debug;
}
