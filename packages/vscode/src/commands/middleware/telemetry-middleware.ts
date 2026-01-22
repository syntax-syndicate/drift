/**
 * Telemetry middleware
 * 
 * Single responsibility: Track command usage for analytics.
 */

import type { CommandMiddleware, CommandContext } from '../command-router.js';

/**
 * Telemetry tracker interface
 */
export interface TelemetryTracker {
  trackCommand(data: {
    command: string;
    duration: number;
    success: boolean;
    error?: string;
  }): void;
}

/**
 * Create telemetry middleware
 */
export function createTelemetryMiddleware(
  tracker: TelemetryTracker
): CommandMiddleware {
  return async (ctx: CommandContext, next: () => Promise<void>): Promise<void> => {
    try {
      await next();

      tracker.trackCommand({
        command: ctx.command,
        duration: performance.now() - ctx.startTime,
        success: true,
      });
    } catch (error) {
      tracker.trackCommand({
        command: ctx.command,
        duration: performance.now() - ctx.startTime,
        success: false,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      throw error;
    }
  };
}
