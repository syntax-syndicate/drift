/**
 * LanguageClientFactory - Creates configured LSP clients
 * 
 * Single responsibility: Create and configure LanguageClient instances.
 */

import * as path from 'node:path';

import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

import { DOCUMENT_SELECTORS } from './connection-config.js';

import type { Logger } from '../infrastructure/index.js';
import type { ServerConfig } from '../types/index.js';

/**
 * Factory for creating language clients
 */
export class LanguageClientFactory {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {}

  /**
   * Create a new language client
   */
  create(config: ServerConfig): LanguageClient {
    const serverOptions = this.createServerOptions(config);
    const clientOptions = this.createClientOptions(config);

    const client = new LanguageClient(
      'drift',
      'Drift Language Server',
      serverOptions,
      clientOptions
    );

    return client;
  }

  private createServerOptions(config: ServerConfig): ServerOptions {
    // Use custom path if provided, otherwise use bundled server
    const serverModule = config.path || this.getBundledServerPath();

    this.logger.debug(`Server module: ${serverModule}`);

    return {
      run: {
        module: serverModule,
        transport: TransportKind.ipc,
        args: config.args,
      },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
        args: [...config.args, '--debug'],
        options: {
          execArgv: ['--nolazy', '--inspect=6009'],
        },
      },
    };
  }

  private createClientOptions(config: ServerConfig): LanguageClientOptions {
    return {
      documentSelector: DOCUMENT_SELECTORS,
      synchronize: {
        // Watch .drift directory for config changes
        fileEvents: vscode.workspace.createFileSystemWatcher('**/.drift/**'),
      },
      outputChannel: vscode.window.createOutputChannel('Drift LSP'),
      traceOutputChannel: vscode.window.createOutputChannel('Drift LSP Trace'),
      initializationOptions: {
        trace: config.trace,
      },
    };
  }

  private getBundledServerPath(): string {
    // Look for the LSP server in the extension's dependencies
    const serverPath = path.join(
      this.context.extensionPath,
      'node_modules',
      'driftdetect-lsp',
      'dist',
      'bin',
      'server.js'
    );

    return serverPath;
  }
}

/**
 * Factory function for creating language client factory
 */
export function createLanguageClient(
  context: vscode.ExtensionContext,
  logger: Logger,
  config: ServerConfig
): LanguageClient {
  const factory = new LanguageClientFactory(context, logger);
  return factory.create(config);
}
