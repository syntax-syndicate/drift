/**
 * ViolationsTreeProvider - Violations tree view
 * 
 * Single responsibility: Display violations in a tree view.
 */

import * as vscode from 'vscode';

import { BaseTreeProvider, type BaseTreeItem } from './base-tree-provider.js';

import type { ViolationData, Severity } from '../types/index.js';
import type { LanguageClient } from 'vscode-languageclient/node';

/**
 * Tree item types
 */
type ViolationTreeItemType = 'severity' | 'file' | 'violation';

/**
 * Violation tree item
 */
export interface ViolationTreeItem extends BaseTreeItem {
  type: ViolationTreeItemType;
  data?: ViolationData | { severity: Severity; count: number } | { file: string; count: number };
}

/**
 * Violations tree provider
 */
export class ViolationsTreeProvider extends BaseTreeProvider<ViolationTreeItem> {
  constructor(client: LanguageClient | null) {
    super(client);
  }

  async getChildren(element?: ViolationTreeItem): Promise<ViolationTreeItem[]> {
    if (!this.client) {
      return [];
    }

    const cacheKey = this.getCacheKey(element);
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    let items: ViolationTreeItem[];

    if (!element) {
      // Root level: show by severity
      items = await this.getSeverityGroups();
    } else if (element.type === 'severity') {
      // Severity level: show files
      items = await this.getFilesBySeverity(element.label as Severity);
    } else if (element.type === 'file') {
      // File level: show violations
      const data = element.data as { file: string };
      items = await this.getViolationsInFile(data.file);
    } else {
      items = [];
    }

    this.setCache(cacheKey, items);
    return items;
  }

  private async getSeverityGroups(): Promise<ViolationTreeItem[]> {
    try {
      const response = await this.sendRequest<{
        bySeverity: Record<Severity, number>;
      }>('drift/violations/summary');

      const severities: Severity[] = ['error', 'warning', 'info', 'hint'];
      
      return severities
        .filter((s) => response.bySeverity[s] > 0)
        .map((severity) =>
          this.createSeverityItem(severity, response.bySeverity[severity])
        );
    } catch {
      return [];
    }
  }

  private async getFilesBySeverity(severity: Severity): Promise<ViolationTreeItem[]> {
    try {
      const response = await this.sendRequest<{
        files: Array<{ file: string; count: number }>;
      }>('drift/violations/byFile', { severity });

      return response.files.map((f) => this.createFileItem(f.file, f.count));
    } catch {
      return [];
    }
  }

  private async getViolationsInFile(file: string): Promise<ViolationTreeItem[]> {
    try {
      const response = await this.sendRequest<{ violations: ViolationData[] }>(
        'drift/violations/list',
        { file }
      );

      return response.violations.map((v) => this.createViolationItem(v));
    } catch {
      return [];
    }
  }

  private createSeverityItem(severity: Severity, count: number): ViolationTreeItem {
    return {
      type: 'severity',
      label: severity.charAt(0).toUpperCase() + severity.slice(1),
      description: `${count} violation${count === 1 ? '' : 's'}`,
      iconPath: this.getSeverityIcon(severity),
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: 'severity',
      data: { severity, count },
    };
  }

  private createFileItem(file: string, count: number): ViolationTreeItem {
    const fileName = file.split('/').pop() || file;
    
    return {
      type: 'file',
      label: fileName,
      description: `${count} violation${count === 1 ? '' : 's'}`,
      iconPath: vscode.ThemeIcon.File,
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
      contextValue: 'file',
      resourceUri: vscode.Uri.file(file),
      data: { file, count },
    };
  }

  private createViolationItem(violation: ViolationData): ViolationTreeItem {
    const line = violation.range.start.line + 1;
    
    return {
      type: 'violation',
      id: violation.id,
      label: violation.message,
      description: `Line ${line}`,
      iconPath: this.getSeverityIcon(violation.severity),
      collapsibleState: vscode.TreeItemCollapsibleState.None,
      contextValue: 'violation',
      tooltip: this.createViolationTooltip(violation),
      command: {
        command: 'vscode.open',
        title: 'Go to Violation',
        arguments: [
          vscode.Uri.file(violation.file),
          {
            selection: new vscode.Range(
              violation.range.start.line,
              violation.range.start.character,
              violation.range.end.line,
              violation.range.end.character
            ),
          },
        ],
      },
      data: violation,
    };
  }

  private getSeverityIcon(severity: Severity): vscode.ThemeIcon {
    switch (severity) {
      case 'error':
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
      case 'warning':
        return new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
      case 'info':
        return new vscode.ThemeIcon('info', new vscode.ThemeColor('editorInfo.foreground'));
      case 'hint':
        return new vscode.ThemeIcon('lightbulb', new vscode.ThemeColor('editorHint.foreground'));
    }
  }

  private createViolationTooltip(violation: ViolationData): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    md.appendMarkdown(`### ${violation.message}\n\n`);
    md.appendMarkdown(`**Pattern:** \`${violation.patternId}\`\n\n`);
    md.appendMarkdown(`**Severity:** ${violation.severity}\n\n`);
    md.appendMarkdown(`**File:** ${violation.file}\n\n`);
    md.appendMarkdown(`**Line:** ${violation.range.start.line + 1}\n\n`);

    md.appendMarkdown(`---\n\n`);
    
    if (violation.hasQuickFix) {
      md.appendMarkdown(`$(lightbulb) Quick fix available\n\n`);
    }
    if (violation.aiExplainAvailable) {
      md.appendMarkdown(`$(sparkle) AI explanation available\n\n`);
    }

    return md;
  }
}

/**
 * Factory function for creating violations tree provider
 */
export function createViolationsTreeProvider(
  client: LanguageClient | null
): ViolationsTreeProvider {
  return new ViolationsTreeProvider(client);
}
