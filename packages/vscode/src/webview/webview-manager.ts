/**
 * WebviewManager - Webview panel management
 * 
 * Single responsibility: Create and manage webview panels.
 */

import * as vscode from 'vscode';

import type { Logger } from '../infrastructure/index.js';

/**
 * Webview panel configuration
 */
export interface WebviewPanelConfig {
  viewType: string;
  title: string;
  localResourceRoots?: string[];
  enableScripts?: boolean;
  retainContextWhenHidden?: boolean;
}

/**
 * Message handler type
 */
export type MessageHandler = (data: unknown) => Promise<unknown>;

/**
 * Webview manager for creating and managing panels
 */
export class WebviewManager implements vscode.Disposable {
  private readonly panels = new Map<string, vscode.WebviewPanel>();
  private readonly messageHandlers = new Map<string, Map<string, MessageHandler>>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {}

  /**
   * Show or create a webview panel
   */
  async showPanel(
    config: WebviewPanelConfig,
    handlers?: Record<string, MessageHandler>
  ): Promise<vscode.WebviewPanel> {
    // Reuse existing panel if available
    const existing = this.panels.get(config.viewType);
    if (existing) {
      existing.reveal();
      return existing;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      config.viewType,
      config.title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: config.enableScripts ?? true,
        retainContextWhenHidden: config.retainContextWhenHidden ?? false,
        localResourceRoots: this.getLocalResourceRoots(config),
      }
    );

    // Set up message handling
    if (handlers) {
      this.messageHandlers.set(config.viewType, new Map(Object.entries(handlers)));
    }

    panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(config.viewType, panel, message),
      undefined,
      this.disposables
    );

    // Handle disposal
    panel.onDidDispose(
      () => {
        this.panels.delete(config.viewType);
        this.messageHandlers.delete(config.viewType);
      },
      undefined,
      this.disposables
    );

    // Set content
    panel.webview.html = await this.getWebviewContent(panel.webview, config);

    this.panels.set(config.viewType, panel);
    return panel;
  }

  /**
   * Send a message to a webview
   */
  postMessage(viewType: string, message: unknown): boolean {
    const panel = this.panels.get(viewType);
    if (panel) {
      panel.webview.postMessage(message);
      return true;
    }
    return false;
  }

  /**
   * Close a webview panel
   */
  closePanel(viewType: string): void {
    const panel = this.panels.get(viewType);
    if (panel) {
      panel.dispose();
    }
  }

  /**
   * Dispose all panels
   */
  dispose(): void {
    for (const panel of this.panels.values()) {
      panel.dispose();
    }
    this.panels.clear();
    this.messageHandlers.clear();

    for (const d of this.disposables) {
      d.dispose();
    }
  }

  private getLocalResourceRoots(config: WebviewPanelConfig): vscode.Uri[] {
    const roots = [
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
      vscode.Uri.joinPath(this.context.extensionUri, 'resources'),
    ];

    if (config.localResourceRoots) {
      for (const root of config.localResourceRoots) {
        roots.push(vscode.Uri.joinPath(this.context.extensionUri, root));
      }
    }

    return roots;
  }

  private async handleMessage(
    viewType: string,
    panel: vscode.WebviewPanel,
    message: { type: string; requestId?: string; data?: unknown }
  ): Promise<void> {
    const handlers = this.messageHandlers.get(viewType);
    const handler = handlers?.get(message.type);

    if (!handler) {
      this.logger.warn(`No handler for message type: ${message.type}`);
      return;
    }

    try {
      const result = await handler(message.data);

      if (message.requestId) {
        panel.webview.postMessage({
          type: `${message.type}:response`,
          requestId: message.requestId,
          data: result,
        });
      }
    } catch (error) {
      this.logger.error(`Error handling message ${message.type}:`, error);

      if (message.requestId) {
        panel.webview.postMessage({
          type: `${message.type}:error`,
          requestId: message.requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async getWebviewContent(
    webview: vscode.Webview,
    config: WebviewPanelConfig
  ): Promise<string> {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', `${config.viewType}.js`)
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', `${config.viewType}.css`)
    );

    const nonce = this.generateNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}';
    img-src ${webview.cspSource} https: data:;
    font-src ${webview.cspSource};
  ">
  <link href="${styleUri}" rel="stylesheet">
  <title>${config.title}</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    window.vscode = acquireVsCodeApi();
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }
}

/**
 * Factory function for creating webview manager
 */
export function createWebviewManager(
  context: vscode.ExtensionContext,
  logger: Logger
): WebviewManager {
  return new WebviewManager(context, logger);
}
