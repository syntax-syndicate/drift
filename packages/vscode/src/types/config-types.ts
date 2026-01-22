/**
 * Configuration type definitions
 */

import type { Severity } from './extension-types.js';

/**
 * Server configuration
 */
export interface ServerConfig {
  path: string;
  args: string[];
  trace: 'off' | 'messages' | 'verbose';
}

/**
 * Scan configuration
 */
export interface ScanConfig {
  onSave: boolean;
  onOpen: boolean;
  debounceMs: number;
  excludePatterns: string[];
}

/**
 * Display configuration
 */
export interface DisplayConfig {
  showStatusBar: boolean;
  showInlineHints: boolean;
  showGutterIcons: boolean;
  severityFilter: Severity[];
}

/**
 * AI provider types
 */
export type AIProvider = 'openai' | 'anthropic' | 'ollama' | 'none';

/**
 * AI configuration
 */
export interface AIConfig {
  enabled: boolean;
  provider: AIProvider;
  model: string;
}

/**
 * Team configuration (from .drift/config.json)
 */
export interface TeamConfig {
  enforceApproved: boolean;
  requiredCategories: string[];
  customRules: string[];
}

/**
 * Complete extension configuration
 */
export interface DriftConfig {
  server: ServerConfig;
  scan: ScanConfig;
  display: DisplayConfig;
  ai: AIConfig;
  team: TeamConfig;
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
  section: keyof DriftConfig;
  oldValue: unknown;
  newValue: unknown;
}
