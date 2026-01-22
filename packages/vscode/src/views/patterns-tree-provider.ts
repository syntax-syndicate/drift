/**
 * PatternsTreeProvider - Pattern tree view
 * 
 * Single responsibility: Display patterns in a tree view.
 */

import * as vscode from 'vscode';

import { BaseTreeProvider, type BaseTreeItem } from './base-tree-provider.js';

import type { PatternData, CategoryData } from '../types/index.js';
import type { LanguageClient } from 'vscode-languageclient/node';

/**
 * Tree item types
 */
type PatternTreeItemType = 'category' | 'pattern' | 'location';

/**
 * Pattern tree item
 */
export interface PatternTreeItem extends BaseTreeItem {
  type: PatternTreeItemType;
  data?: PatternData | CategoryData;
}

/**
 * Patterns tree provider
 */
export class PatternsTreeProvider extends BaseTreeProvider<PatternTreeItem> {
  constructor(client: LanguageClient | null) {
    super(client);
  }

  async getChildren(element?: PatternTreeItem): Promise<PatternTreeItem[]> {
    if (!this.client) {
      return [];
    }

    const cacheKey = this.getCacheKey(element);
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    let items: PatternTreeItem[];

    if (!element) {
      // Root level: show categories
      items = await this.getCategories();
    } else if (element.type === 'category') {
      // Category level: show patterns
      items = await this.getPatterns(element.label as string);
    } else {
      // Pattern level: no children for now
      items = [];
    }

    this.setCache(cacheKey, items);
    return items;
  }

  private async getCategories(): Promise<PatternTreeItem[]> {
    try {
      const response = await this.sendRequest<{ categories: CategoryData[] }>(
        'drift/patterns/categories'
      );

      return response.categories.map((cat) => this.createCategoryItem(cat));
    } catch {
      return [];
    }
  }

  private async getPatterns(category: string): Promise<PatternTreeItem[]> {
    try {
      const response = await this.sendRequest<{ patterns: PatternData[] }>(
        'drift/patterns/list',
        { categories: [category] }
      );

      return response.patterns.map((pattern) => this.createPatternItem(pattern));
    } catch {
      return [];
    }
  }

  private createCategoryItem(category: CategoryData): PatternTreeItem {
    const item: PatternTreeItem = {
      type: 'category',
      label: category.name,
      description: `${category.count} patterns`,
      iconPath: this.getCategoryIcon(category.name),
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: 'category',
      data: category,
    };
    return item;
  }

  private createPatternItem(pattern: PatternData): PatternTreeItem {
    const item: PatternTreeItem = {
      type: 'pattern',
      id: pattern.id,
      label: pattern.name,
      description: `${pattern.locationCount} locations • ${Math.round(pattern.confidence * 100)}%`,
      iconPath: this.getStatusIcon(pattern.status),
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: 'pattern',
      tooltip: this.createPatternTooltip(pattern),
      command: {
        command: 'drift.showPatternDetail',
        title: 'Show Pattern Details',
        arguments: [pattern.id],
      },
      data: pattern,
    };
    return item;
  }

  private getCategoryIcon(category: string): vscode.ThemeIcon {
    const iconMap: Record<string, string> = {
      api: 'globe',
      auth: 'lock',
      security: 'shield',
      errors: 'error',
      logging: 'output',
      'data-access': 'database',
      config: 'gear',
      testing: 'beaker',
      performance: 'dashboard',
      components: 'symbol-class',
      styling: 'paintcan',
      structural: 'folder',
      types: 'symbol-interface',
      accessibility: 'accessibility',
      documentation: 'book',
    };

    return new vscode.ThemeIcon(iconMap[category] || 'symbol-misc');
  }

  private getStatusIcon(status: string): vscode.ThemeIcon {
    switch (status) {
      case 'approved':
        return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
      case 'ignored':
        return new vscode.ThemeIcon('x', new vscode.ThemeColor('charts.gray'));
      default:
        return new vscode.ThemeIcon('circle-outline');
    }
  }

  private createPatternTooltip(pattern: PatternData): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    md.appendMarkdown(`### ${pattern.name}\n\n`);
    md.appendMarkdown(`**Category:** ${pattern.category}\n\n`);
    md.appendMarkdown(`**Status:** ${pattern.status}\n\n`);
    md.appendMarkdown(`**Confidence:** ${Math.round(pattern.confidence * 100)}%\n\n`);
    md.appendMarkdown(`**Locations:** ${pattern.locationCount}\n\n`);

    if (pattern.description) {
      md.appendMarkdown(`---\n\n${pattern.description}\n`);
    }

    return md;
  }
}

/**
 * Factory function for creating patterns tree provider
 */
export function createPatternsTreeProvider(
  client: LanguageClient | null
): PatternsTreeProvider {
  return new PatternsTreeProvider(client);
}
