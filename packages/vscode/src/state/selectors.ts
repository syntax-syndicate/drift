/**
 * State selectors - Reusable state accessors
 * 
 * Single responsibility: Provide typed access to state slices.
 */

import type { StateSelector } from '../types/index.js';

// ============================================================================
// Connection Selectors
// ============================================================================

export const selectConnectionStatus: StateSelector<string> = 
  (state) => state.connection.status;

export const selectIsConnected: StateSelector<boolean> = 
  (state) => state.connection.status === 'connected';

export const selectConnectionError: StateSelector<string | null> = 
  (state) => state.connection.lastError;

export const selectServerVersion: StateSelector<string | null> = 
  (state) => state.connection.serverVersion;

// ============================================================================
// Workspace Selectors
// ============================================================================

export const selectIsInitialized: StateSelector<boolean> = 
  (state) => state.workspace.initialized;

export const selectProjectRoot: StateSelector<string | null> = 
  (state) => state.workspace.projectRoot;

export const selectIsScanning: StateSelector<boolean> = 
  (state) => state.workspace.scanning;

export const selectLastScanTime: StateSelector<number | null> = 
  (state) => state.workspace.lastScanTime;

// ============================================================================
// Pattern Selectors
// ============================================================================

export const selectPatternTotal: StateSelector<number> = 
  (state) => state.patterns.total;

export const selectPatternsByCategory: StateSelector<Record<string, number>> = 
  (state) => state.patterns.byCategory;

export const selectPatternsByStatus: StateSelector<Record<string, number>> = 
  (state) => state.patterns.byStatus;

export const selectPatternsLastUpdated: StateSelector<number | null> = 
  (state) => state.patterns.lastUpdated;

// ============================================================================
// Violation Selectors
// ============================================================================

export const selectViolationTotal: StateSelector<number> = 
  (state) => state.violations.total;

export const selectViolationsBySeverity: StateSelector<Record<string, number>> = 
  (state) => state.violations.bySeverity;

export const selectActiveFileViolations: StateSelector<number> = 
  (state) => state.violations.activeFileCount;

export const selectActiveFile: StateSelector<string | null> = 
  (state) => state.violations.activeFile;

// ============================================================================
// UI Selectors
// ============================================================================

export const selectStatusBarVisible: StateSelector<boolean> = 
  (state) => state.ui.statusBarVisible;

export const selectSidebarExpanded: StateSelector<boolean> = 
  (state) => state.ui.sidebarExpanded;

export const selectActivePanel: StateSelector<string | null> = 
  (state) => state.ui.activePanel;

// ============================================================================
// Preferences Selectors
// ============================================================================

export const selectAutoScan: StateSelector<boolean> = 
  (state) => state.preferences.autoScan;

export const selectShowInlineHints: StateSelector<boolean> = 
  (state) => state.preferences.showInlineHints;

export const selectSeverityFilter: StateSelector<string[]> = 
  (state) => state.preferences.severityFilter;

export const selectCategoryFilter: StateSelector<string[]> = 
  (state) => state.preferences.categoryFilter;

// ============================================================================
// Composite Selectors
// ============================================================================

export const selectStatusBarData: StateSelector<{
  status: string;
  violations: number;
  scanning: boolean;
}> = (state) => ({
  status: state.connection.status,
  violations: state.violations.total,
  scanning: state.workspace.scanning,
});

export const selectHealthSummary: StateSelector<{
  connected: boolean;
  patterns: number;
  violations: number;
  lastScan: number | null;
}> = (state) => ({
  connected: state.connection.status === 'connected',
  patterns: state.patterns.total,
  violations: state.violations.total,
  lastScan: state.workspace.lastScanTime,
});
