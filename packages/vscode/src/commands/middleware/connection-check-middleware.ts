/**
 * Connection check middleware
 * 
 * Single responsibility: Verify connection before command execution.
 */

import { DRIFT_COMMANDS, type DriftCommand } from '../command-definitions.js';

import type { StateManager } from '../../state/index.js';
import type { CommandMiddleware, CommandContext } from '../command-router.js';

/**
 * Commands that don't require connection
 */
const CONNECTION_EXEMPT_COMMANDS = new Set<DriftCommand>([
  DRIFT_COMMANDS.reconnect,
  DRIFT_COMMANDS.showStatus,
  DRIFT_COMMANDS.showError,
  DRIFT_COMMANDS.openSettings,
  DRIFT_COMMANDS.openDashboard,
]);

/**
 * Create connection check middleware
 */
export function createConnectionCheckMiddleware(
  stateManager: StateManager
): CommandMiddleware {
  return async (ctx: CommandContext, next: () => Promise<void>): Promise<void> => {
    // Skip check for exempt commands
    if (CONNECTION_EXEMPT_COMMANDS.has(ctx.command)) {
      await next();
      return;
    }

    const state = stateManager.getState();
    
    if (state.connection.status !== 'connected') {
      throw new Error(
        'Drift server is not connected. Please wait for initialization or run "Drift: Reconnect".'
      );
    }

    await next();
  };
}
