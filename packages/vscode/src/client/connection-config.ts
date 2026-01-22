/**
 * Connection configuration constants
 * 
 * Single responsibility: Define connection-related constants.
 */

/**
 * Connection configuration
 */
export const CONNECTION_CONFIG = {
  /**
   * Maximum restart attempts before giving up
   */
  maxRestarts: 5,

  /**
   * Base delay between restarts (ms)
   */
  restartDelay: 1000,

  /**
   * Exponential backoff multiplier
   */
  backoffMultiplier: 2,

  /**
   * Maximum backoff delay (ms)
   */
  maxBackoffDelay: 30000,

  /**
   * Health check interval (ms)
   */
  healthCheckInterval: 30000,

  /**
   * Server initialization timeout (ms)
   */
  initializeTimeout: 10000,

  /**
   * Individual request timeout (ms)
   */
  requestTimeout: 5000,

  /**
   * Graceful shutdown timeout (ms)
   */
  shutdownTimeout: 2000,
} as const;

/**
 * Document selectors for the language client
 */
export const DOCUMENT_SELECTORS = [
  { scheme: 'file', language: 'typescript' },
  { scheme: 'file', language: 'typescriptreact' },
  { scheme: 'file', language: 'javascript' },
  { scheme: 'file', language: 'javascriptreact' },
  { scheme: 'file', language: 'python' },
  { scheme: 'file', language: 'csharp' },
  { scheme: 'file', language: 'java' },
  { scheme: 'file', language: 'php' },
];
