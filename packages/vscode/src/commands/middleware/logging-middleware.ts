/**
 * Logging middleware
 * 
 * Single responsibility: Log command execution.
 */

import type { Logger } from '../../infrastructure/index.js';
import type { CommandMiddleware, CommandContext } from '../command-router.js';

/**
 * Create logging middleware
 */
export function createLoggingMiddleware(logger: Logger): CommandMiddleware {
  return async (ctx: CommandContext, next: () => Promise<void>): Promise<void> => {
    logger.debug(`Executing command: ${ctx.command}`, { args: ctx.args });

    try {
      await next();
      
      const duration = performance.now() - ctx.startTime;
      logger.debug(`Command completed: ${ctx.command} (${duration.toFixed(2)}ms)`);
    } catch (error) {
      const duration = performance.now() - ctx.startTime;
      logger.error(`Command failed: ${ctx.command} (${duration.toFixed(2)}ms)`, error);
      throw error;
    }
  };
}
