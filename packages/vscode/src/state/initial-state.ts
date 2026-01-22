/**
 * Initial state factory
 * 
 * Single responsibility: Provide default state values.
 */

import type { ExtensionState } from '../types/index.js';

/**
 * Create the initial extension state
 */
export function createInitialState(): ExtensionState {
  return {
    connection: {
      status: 'disconnected',
      serverVersion: null,
      lastError: null,
      restartCount: 0,
    },
    workspace: {
      initialized: false,
      projectRoot: null,
      configPath: null,
      lastScanTime: null,
      scanning: false,
    },
    patterns: {
      total: 0,
      byCategory: {},
      byStatus: {
        discovered: 0,
        approved: 0,
        ignored: 0,
      },
      lastUpdated: null,
    },
    violations: {
      total: 0,
      bySeverity: {
        error: 0,
        warning: 0,
        info: 0,
        hint: 0,
      },
      activeFile: null,
      activeFileCount: 0,
    },
    ui: {
      statusBarVisible: true,
      sidebarExpanded: false,
      activePanel: null,
    },
    preferences: {
      autoScan: true,
      showInlineHints: true,
      severityFilter: ['error', 'warning'],
      categoryFilter: [],
    },
  };
}
