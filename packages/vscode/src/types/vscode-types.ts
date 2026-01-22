/**
 * VS Code-specific type definitions
 * 
 * Re-exports and extensions of VS Code types.
 */

import type * as vscode from 'vscode';

/**
 * Extended quick pick item with additional data
 */
export interface ExtendedQuickPickItem<T = unknown> extends vscode.QuickPickItem {
  data?: T;
}

/**
 * Tree item with generic data
 */
export interface DataTreeItem<T = unknown> extends vscode.TreeItem {
  data?: T;
}

/**
 * Webview message types
 */
export interface WebviewMessage<T = unknown> {
  type: string;
  requestId?: string;
  data?: T;
}

/**
 * Webview response types
 */
export interface WebviewResponse<T = unknown> {
  type: string;
  requestId: string;
  data?: T;
  error?: string;
}
