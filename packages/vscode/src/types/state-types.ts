/**
 * State management type definitions
 */

import type { ConnectionState, Severity, PatternStatus } from './extension-types.js';

/**
 * Connection state slice
 */
export interface ConnectionStateSlice {
  status: ConnectionState;
  serverVersion: string | null;
  lastError: string | null;
  restartCount: number;
}

/**
 * Workspace state slice
 */
export interface WorkspaceStateSlice {
  initialized: boolean;
  projectRoot: string | null;
  configPath: string | null;
  lastScanTime: number | null;
  scanning: boolean;
}

/**
 * Pattern summary state slice
 */
export interface PatternStateSlice {
  total: number;
  byCategory: Record<string, number>;
  byStatus: Record<PatternStatus, number>;
  lastUpdated: number | null;
}

/**
 * Violation state slice
 */
export interface ViolationStateSlice {
  total: number;
  bySeverity: Record<Severity, number>;
  activeFile: string | null;
  activeFileCount: number;
}

/**
 * UI state slice
 */
export interface UIStateSlice {
  statusBarVisible: boolean;
  sidebarExpanded: boolean;
  activePanel: string | null;
}

/**
 * User preferences (persisted)
 */
export interface PreferencesSlice {
  autoScan: boolean;
  showInlineHints: boolean;
  severityFilter: Severity[];
  categoryFilter: string[];
}

/**
 * Complete extension state
 */
export interface ExtensionState {
  connection: ConnectionStateSlice;
  workspace: WorkspaceStateSlice;
  patterns: PatternStateSlice;
  violations: ViolationStateSlice;
  ui: UIStateSlice;
  preferences: PreferencesSlice;
}

/**
 * State update function type
 */
export type StateUpdater = (draft: ExtensionState) => void;

/**
 * State selector function type
 */
export type StateSelector<T> = (state: ExtensionState) => T;

/**
 * State subscription callback
 */
export type StateSubscriber<T> = (value: T) => void;
