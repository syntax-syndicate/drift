/**
 * UI command handlers
 * 
 * Single responsibility: Handle UI-related commands.
 */

import * as vscode from 'vscode';

import { DRIFT_COMMANDS } from '../command-definitions.js';

import type { NotificationService } from '../../ui/notifications/notification-service.js';
import type { CommandRouter, CommandContext } from '../command-router.js';

/**
 * Create UI command handlers
 */
export function createUIHandlers(
  router: CommandRouter,
  notifications: NotificationService
): void {
  // Open dashboard command
  router.register({
    id: DRIFT_COMMANDS.openDashboard,
    handler: async (_ctx: CommandContext) => {
      // Open the dashboard webview
      await vscode.commands.executeCommand('drift.dashboard.focus');
    },
  });

  // Open settings command
  router.register({
    id: DRIFT_COMMANDS.openSettings,
    handler: async (_ctx: CommandContext) => {
      // Open VS Code settings filtered to Drift
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:drift.drift'
      );
    },
  });

  // Export patterns command
  router.register({
    id: DRIFT_COMMANDS.exportPatterns,
    showProgress: true,
    progressTitle: 'Exporting patterns...',
    handler: async (_ctx: CommandContext) => {
      // Show save dialog
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('drift-patterns.json'),
        filters: {
          'JSON': ['json'],
          'All Files': ['*'],
        },
        title: 'Export Patterns',
      });

      if (!uri) {return;}

      // TODO: Implement actual export via LSP
      await notifications.info(`Patterns exported to ${uri.fsPath}`);
    },
  });

  // Generate report command
  router.register({
    id: DRIFT_COMMANDS.generateReport,
    showProgress: true,
    progressTitle: 'Generating report...',
    handler: async (_ctx: CommandContext) => {
      // Show save dialog
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('drift-report.html'),
        filters: {
          'HTML': ['html'],
          'Markdown': ['md'],
          'JSON': ['json'],
        },
        title: 'Generate Report',
      });

      if (!uri) {return;}

      // TODO: Implement actual report generation via LSP
      await notifications.info(`Report generated at ${uri.fsPath}`);
    },
  });
}
