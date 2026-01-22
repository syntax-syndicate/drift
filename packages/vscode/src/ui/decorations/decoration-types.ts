/**
 * Decoration type definitions
 * 
 * Single responsibility: Create VS Code decoration types.
 */

import * as vscode from 'vscode';

import type { Severity } from '../../types/index.js';

/**
 * Decoration type keys
 */
export type DecorationTypeKey = 
  | `gutter-${Severity}`
  | 'inline-hint'
  | `background-${Severity}`;

/**
 * Decoration types container
 */
export type DecorationTypes = Map<DecorationTypeKey, vscode.TextEditorDecorationType>;

/**
 * Gutter icon colors by severity
 */
const GUTTER_COLORS: Record<Severity, string> = {
  error: '#f44336',
  warning: '#ff9800',
  info: '#2196f3',
  hint: '#4caf50',
};

/**
 * Background colors by severity (with alpha)
 */
const BACKGROUND_COLORS: Record<Severity, string> = {
  error: 'rgba(244, 67, 54, 0.1)',
  warning: 'rgba(255, 152, 0, 0.1)',
  info: 'rgba(33, 150, 243, 0.1)',
  hint: 'rgba(76, 175, 80, 0.1)',
};

/**
 * Create all decoration types
 */
export function createDecorationTypes(
  context: vscode.ExtensionContext
): DecorationTypes {
  const types = new Map<DecorationTypeKey, vscode.TextEditorDecorationType>();
  const severities: Severity[] = ['error', 'warning', 'info', 'hint'];

  // Create gutter decorations
  for (const severity of severities) {
    const type = vscode.window.createTextEditorDecorationType({
      gutterIconPath: createGutterIcon(context, severity),
      gutterIconSize: 'contain',
    });
    types.set(`gutter-${severity}`, type);
    context.subscriptions.push(type);
  }

  // Create inline hint decoration
  const inlineHint = vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 1em',
      color: new vscode.ThemeColor('editorCodeLens.foreground'),
      fontStyle: 'italic',
      fontWeight: 'normal',
    },
  });
  types.set('inline-hint', inlineHint);
  context.subscriptions.push(inlineHint);

  // Create background decorations
  for (const severity of severities) {
    const type = vscode.window.createTextEditorDecorationType({
      backgroundColor: BACKGROUND_COLORS[severity],
      isWholeLine: true,
    });
    types.set(`background-${severity}`, type);
    context.subscriptions.push(type);
  }

  return types;
}

/**
 * Create a gutter icon for a severity
 */
function createGutterIcon(
  context: vscode.ExtensionContext,
  severity: Severity
): vscode.Uri {
  // Use built-in icons via ThemeIcon
  // For custom icons, you'd create SVGs in resources/
  const iconName = getIconName(severity);
  return vscode.Uri.joinPath(context.extensionUri, 'resources', 'icons', `${iconName}.svg`);
}

/**
 * Get icon name for severity
 */
function getIconName(severity: Severity): string {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    case 'hint':
      return 'lightbulb';
  }
}

/**
 * Get gutter color for severity
 */
export function getGutterColor(severity: Severity): string {
  return GUTTER_COLORS[severity];
}

/**
 * Get background color for severity
 */
export function getBackgroundColor(severity: Severity): string {
  return BACKGROUND_COLORS[severity];
}
