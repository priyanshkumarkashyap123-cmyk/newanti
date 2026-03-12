/**
 * Production-safe logger utility
 * 
 * Wraps console methods to only output in development mode.
 * In production builds, all log/debug/info calls are silently dropped.
 * Warnings and errors are always logged.
 */

const isDev = import.meta.env.DEV;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  /** Debug-level log — stripped in production */
  debug: (...args: unknown[]) => void;
  /** Info-level log — stripped in production */
  log: (...args: unknown[]) => void;
  /** Info-level log — stripped in production */
  info: (...args: unknown[]) => void;
  /** Warning — always logged */
  warn: (...args: unknown[]) => void;
  /** Error — always logged */
  error: (...args: unknown[]) => void;
  /** Create a prefixed sub-logger */
  create: (prefix: string) => Logger;
  /** Measure execution time (dev only) */
  time: (label: string) => void;
  /** End time measurement (dev only) */
  timeEnd: (label: string) => void;
  /** Group logs (dev only) */
  group: (label: string) => void;
  /** End group (dev only) */
  groupEnd: () => void;
}

 
const noop = () => {};

function createLogger(prefix?: string): Logger {
  const fmt = prefix ? `[${prefix}]` : '';

  return {
    debug: isDev
      ? (...args: unknown[]) => console.debug(fmt, ...args)
      : noop,
    log: isDev
      ? (...args: unknown[]) => console.log(fmt, ...args)
      : noop,
    info: isDev
      ? (...args: unknown[]) => console.info(fmt, ...args)
      : noop,
    warn: (...args: unknown[]) => console.warn(fmt, ...args),
    error: (...args: unknown[]) => console.error(fmt, ...args),
    create: (childPrefix: string) =>
      createLogger(prefix ? `${prefix}:${childPrefix}` : childPrefix),
    time: isDev ? (label: string) => console.time(`${fmt} ${label}`) : noop,
    timeEnd: isDev ? (label: string) => console.timeEnd(`${fmt} ${label}`) : noop,
    group: isDev ? (label: string) => console.group(`${fmt} ${label}`) : noop,
    groupEnd: isDev ? () => console.groupEnd() : noop,
  };
}

/** Root application logger */
export const logger = createLogger('BeamLab');

/** Pre-configured sub-loggers for common modules */
export const solverLogger = logger.create('Solver');
export const authLogger = logger.create('Auth');
export const aiLogger = logger.create('AI');
export const wasmLogger = logger.create('WASM');
export const networkLogger = logger.create('Network');

export default logger;
