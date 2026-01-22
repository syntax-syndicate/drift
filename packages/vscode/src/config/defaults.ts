/**
 * Default configuration values
 * 
 * Single responsibility: Provide default config values.
 */

import type { DriftConfig } from '../types/index.js';

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: DriftConfig = {
  server: {
    path: '',
    args: [],
    trace: 'off',
  },
  scan: {
    onSave: true,
    onOpen: true,
    debounceMs: 200,
    excludePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/coverage/**',
    ],
  },
  display: {
    showStatusBar: true,
    showInlineHints: true,
    showGutterIcons: true,
    severityFilter: ['error', 'warning'],
  },
  ai: {
    enabled: false,
    provider: 'none',
    model: '',
  },
  team: {
    enforceApproved: false,
    requiredCategories: [],
    customRules: [],
  },
};
