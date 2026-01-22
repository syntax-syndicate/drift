/**
 * BaseTreeProvider - Abstract base for tree view providers
 * 
 * Single responsibility: Provide common tree view functionality.
 */

import * as vscode from 'vscode';

import type { LanguageClient } from 'vscode-languageclient/node';

/**
 * Base tree item with common properties
 */
export interface BaseTreeItem extends vscode.TreeItem {
  contextValue: string;
}

/**
 * Cache entry with expiry
 */
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

/**
 * Abstract base class for tree providers
 */
export abstract class BaseTreeProvider<T extends BaseTreeItem>
  implements vscode.TreeDataProvider<T>, vscode.Disposable
{
  protected readonly cache = new Map<string, CacheEntry<T[]>>();
  protected readonly disposables: vscode.Disposable[] = [];
  protected readonly cacheTTL = 30000; // 30 seconds

  protected readonly _onDidChangeTreeData = new vscode.EventEmitter<T | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(protected readonly client: LanguageClient | null) {}

  /**
   * Refresh the tree view
   */
  refresh(item?: T): void {
    if (item) {
      this.invalidateCache(this.getCacheKey(item));
    } else {
      this.invalidateAllCache();
    }
    this._onDidChangeTreeData.fire(item);
  }

  /**
   * Get tree item representation
   */
  getTreeItem(element: T): vscode.TreeItem {
    return element;
  }

  /**
   * Get children of an element
   */
  abstract getChildren(element?: T): Promise<T[]>;

  /**
   * Dispose resources
   */
  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.cache.clear();
    for (const d of this.disposables) {
      d.dispose();
    }
  }

  /**
   * Get cache key for an item
   */
  protected getCacheKey(item?: T): string {
    return item?.id?.toString() ?? 'root';
  }

  /**
   * Get cached data if valid
   */
  protected getCached(key: string): T[] | undefined {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.data;
    }
    return undefined;
  }

  /**
   * Set cache data
   */
  protected setCache(key: string, data: T[]): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.cacheTTL,
    });
  }

  /**
   * Invalidate specific cache entry
   */
  protected invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries
   */
  protected invalidateAllCache(): void {
    this.cache.clear();
  }

  /**
   * Send request to LSP server
   */
  protected async sendRequest<R>(method: string, params?: unknown): Promise<R> {
    if (!this.client) {
      throw new Error('Not connected to server');
    }
    return this.client.sendRequest<R>(method, params);
  }
}
