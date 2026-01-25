/**
 * Command definitions
 * 
 * Single responsibility: Define all extension commands.
 */

/**
 * All Drift command IDs
 */
export const DRIFT_COMMANDS = {
  // Connection commands
  reconnect: 'drift.reconnect',
  showStatus: 'drift.showStatus',
  showError: 'drift.showError',

  // Scan commands
  rescan: 'drift.rescan',
  scanFile: 'drift.scanFile',

  // Pattern commands
  showPatterns: 'drift.showPatterns',
  approvePattern: 'drift.approvePattern',
  ignorePattern: 'drift.ignorePattern',
  createVariant: 'drift.createVariant',

  // Violation commands
  showViolations: 'drift.showViolations',
  ignoreOnce: 'drift.ignoreOnce',
  quickFix: 'drift.quickFix',

  // AI commands
  explainWithAI: 'drift.explainWithAI',
  fixWithAI: 'drift.fixWithAI',

  // UI commands
  openDashboard: 'drift.openDashboard',
  openSettings: 'drift.openSettings',

  // Export commands
  exportPatterns: 'drift.exportPatterns',
  generateReport: 'drift.generateReport',

  // Constants commands
  showConstants: 'drift.showConstants',
  showConstantsByCategory: 'drift.showConstantsByCategory',
  showConstantsByLanguage: 'drift.showConstantsByLanguage',
  showConstantIssues: 'drift.showConstantIssues',
  goToConstant: 'drift.goToConstant',
  findConstantUsages: 'drift.findConstantUsages',
} as const;

/**
 * Command type
 */
export type DriftCommand = typeof DRIFT_COMMANDS[keyof typeof DRIFT_COMMANDS];

/**
 * Command metadata
 */
export interface CommandDefinition {
  id: DriftCommand;
  title: string;
  category: 'Drift';
  icon?: string;
  enablement?: string;
}

/**
 * All command definitions
 */
export const CommandDefinitions: CommandDefinition[] = [
  // Connection
  {
    id: DRIFT_COMMANDS.reconnect,
    title: 'Reconnect to Server',
    category: 'Drift',
    icon: '$(refresh)',
  },
  {
    id: DRIFT_COMMANDS.showStatus,
    title: 'Show Status',
    category: 'Drift',
    icon: '$(info)',
  },
  {
    id: DRIFT_COMMANDS.showError,
    title: 'Show Error Details',
    category: 'Drift',
    icon: '$(error)',
  },

  // Scan
  {
    id: DRIFT_COMMANDS.rescan,
    title: 'Rescan Workspace',
    category: 'Drift',
    icon: '$(sync)',
    enablement: 'drift.connected',
  },
  {
    id: DRIFT_COMMANDS.scanFile,
    title: 'Scan Current File',
    category: 'Drift',
    icon: '$(file-code)',
    enablement: 'drift.connected && editorIsOpen',
  },

  // Patterns
  {
    id: DRIFT_COMMANDS.showPatterns,
    title: 'Show All Patterns',
    category: 'Drift',
    icon: '$(list-tree)',
    enablement: 'drift.connected',
  },
  {
    id: DRIFT_COMMANDS.approvePattern,
    title: 'Approve Pattern',
    category: 'Drift',
    icon: '$(check)',
    enablement: 'drift.connected',
  },
  {
    id: DRIFT_COMMANDS.ignorePattern,
    title: 'Ignore Pattern',
    category: 'Drift',
    icon: '$(x)',
    enablement: 'drift.connected',
  },
  {
    id: DRIFT_COMMANDS.createVariant,
    title: 'Create Variant',
    category: 'Drift',
    icon: '$(git-branch)',
    enablement: 'drift.connected',
  },

  // Violations
  {
    id: DRIFT_COMMANDS.showViolations,
    title: 'Show All Violations',
    category: 'Drift',
    icon: '$(warning)',
    enablement: 'drift.connected',
  },
  {
    id: DRIFT_COMMANDS.ignoreOnce,
    title: 'Ignore This Occurrence',
    category: 'Drift',
    enablement: 'drift.connected',
  },
  {
    id: DRIFT_COMMANDS.quickFix,
    title: 'Apply Quick Fix',
    category: 'Drift',
    icon: '$(lightbulb)',
    enablement: 'drift.connected',
  },

  // AI
  {
    id: DRIFT_COMMANDS.explainWithAI,
    title: 'Explain with AI',
    category: 'Drift',
    icon: '$(sparkle)',
    enablement: 'drift.connected && drift.aiEnabled',
  },
  {
    id: DRIFT_COMMANDS.fixWithAI,
    title: 'Fix with AI',
    category: 'Drift',
    icon: '$(wand)',
    enablement: 'drift.connected && drift.aiEnabled',
  },

  // UI
  {
    id: DRIFT_COMMANDS.openDashboard,
    title: 'Open Dashboard',
    category: 'Drift',
    icon: '$(dashboard)',
  },
  {
    id: DRIFT_COMMANDS.openSettings,
    title: 'Open Settings',
    category: 'Drift',
    icon: '$(gear)',
  },

  // Export
  {
    id: DRIFT_COMMANDS.exportPatterns,
    title: 'Export Patterns',
    category: 'Drift',
    enablement: 'drift.connected',
  },
  {
    id: DRIFT_COMMANDS.generateReport,
    title: 'Generate Report',
    category: 'Drift',
    enablement: 'drift.connected',
  },

  // Constants
  {
    id: DRIFT_COMMANDS.showConstants,
    title: 'Show Constants',
    category: 'Drift',
    icon: '$(symbol-constant)',
    enablement: 'drift.connected',
  },
  {
    id: DRIFT_COMMANDS.showConstantsByCategory,
    title: 'View Constants by Category',
    category: 'Drift',
    enablement: 'drift.connected',
  },
  {
    id: DRIFT_COMMANDS.showConstantsByLanguage,
    title: 'View Constants by Language',
    category: 'Drift',
    enablement: 'drift.connected',
  },
  {
    id: DRIFT_COMMANDS.showConstantIssues,
    title: 'View Constant Issues',
    category: 'Drift',
    icon: '$(warning)',
    enablement: 'drift.connected',
  },
  {
    id: DRIFT_COMMANDS.goToConstant,
    title: 'Go to Constant Definition',
    category: 'Drift',
    enablement: 'drift.connected',
  },
  {
    id: DRIFT_COMMANDS.findConstantUsages,
    title: 'Find Constant Usages',
    category: 'Drift',
    enablement: 'drift.connected',
  },
];
