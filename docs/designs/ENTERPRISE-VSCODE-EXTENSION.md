# Enterprise-Grade VS Code Extension Design for Drift

## Executive Summary

The Drift VS Code extension is not a thin LSP client wrapper - it's the **primary developer interface** for architectural drift detection. While the LSP server handles the heavy lifting, the extension must deliver an enterprise-grade experience: instant feedback, zero-friction workflows, deep IDE integration, and team-scale features.

## Design Principles

1. **Sub-100ms Perceived Latency** - Users should never wait for Drift
2. **Progressive Enhancement** - Core features work offline, advanced features enhance
3. **Zero Configuration** - Works out of the box, customizable for power users
4. **Team-First** - Shared configurations, consistent enforcement across developers
5. **Non-Intrusive** - Enhances workflow without disrupting it
6. **Graceful Degradation** - Partial failures don't break the experience

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VS Code Host                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Extension Host Process                           │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │    │
│  │  │  Activation │  │   Command   │  │    View     │  │  Webview   │  │    │
│  │  │  Controller │  │   Router    │  │  Providers  │  │  Manager   │  │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘  │    │
│  │         │                │                │               │         │    │
│  │         └────────────────┴────────────────┴───────────────┘         │    │
│  │                                   │                                  │    │
│  │                    ┌──────────────┴──────────────┐                   │    │
│  │                    │      Extension Core         │                   │    │
│  │                    │  ┌────────────────────────┐ │                   │    │
│  │                    │  │    State Manager       │ │                   │    │
│  │                    │  │  (Zustand-like store)  │ │                   │    │
│  │                    │  └────────────────────────┘ │                   │    │
│  │                    │  ┌────────────────────────┐ │                   │    │
│  │                    │  │   Telemetry Service    │ │                   │    │
│  │                    │  └────────────────────────┘ │                   │    │
│  │                    │  ┌────────────────────────┐ │                   │    │
│  │                    │  │   Config Manager       │ │                   │    │
│  │                    │  └────────────────────────┘ │                   │    │
│  │                    └──────────────┬──────────────┘                   │    │
│  │                                   │                                  │    │
│  │                    ┌──────────────┴──────────────┐                   │    │
│  │                    │     Language Client         │                   │    │
│  │                    │  ┌────────────────────────┐ │                   │    │
│  │                    │  │   Connection Manager   │ │                   │    │
│  │                    │  │   (reconnect, health)  │ │                   │    │
│  │                    │  └────────────────────────┘ │                   │    │
│  │                    │  ┌────────────────────────┐ │                   │    │
│  │                    │  │   Request Middleware   │ │                   │    │
│  │                    │  │   (retry, timeout)     │ │                   │    │
│  │                    │  └────────────────────────┘ │                   │    │
│  │                    └──────────────┬──────────────┘                   │    │
│  └───────────────────────────────────┼──────────────────────────────────┘    │
│                                      │ stdio/IPC                             │
│  ┌───────────────────────────────────┼──────────────────────────────────┐    │
│  │                    LSP Server Process                                │    │
│  │                    (@drift/lsp)                                      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. Activation Controller

**Responsibility:** Orchestrate extension lifecycle with minimal startup impact.

```typescript
interface ActivationStrategy {
  // Phased activation for fast perceived startup
  phases: {
    immediate: string[];    // <50ms - Status bar, basic commands
    deferred: string[];     // <500ms - LSP client, diagnostics
    lazy: string[];         // On-demand - Webviews, tree views
  };
  
  // Activation triggers
  triggers: {
    onLanguage: string[];   // Activate for these languages
    onWorkspace: string[];  // Activate if these files exist
    onCommand: string[];    // Activate on command invocation
  };
}

class ActivationController {
  private phases = new Map<string, () => Promise<void>>();
  private activated = new Set<string>();
  
  async activate(context: vscode.ExtensionContext): Promise<void> {
    const startTime = performance.now();
    
    // Phase 1: Immediate (blocking) - must complete before activate() returns
    await this.runPhase('immediate', [
      () => this.initializeStatusBar(),
      () => this.registerCriticalCommands(),
      () => this.initializeStateManager(),
    ]);
    
    // Phase 2: Deferred (non-blocking) - runs after activate() returns
    setImmediate(async () => {
      await this.runPhase('deferred', [
        () => this.initializeLanguageClient(),
        () => this.initializeDiagnostics(),
        () => this.initializeCodeActions(),
      ]);
      
      this.telemetry.trackActivation({
        totalTime: performance.now() - startTime,
        phases: this.getPhaseTimings(),
      });
    });
    
    // Phase 3: Lazy - registered but not executed until needed
    this.registerLazyProviders();
  }
  
  private registerLazyProviders(): void {
    // Tree views activate on first expand
    vscode.window.registerTreeDataProvider(
      'drift.patterns',
      new LazyTreeProvider(() => this.createPatternsTreeProvider())
    );
    
    // Webviews activate on first open
    vscode.window.registerWebviewViewProvider(
      'drift.dashboard',
      new LazyWebviewProvider(() => this.createDashboardWebview())
    );
  }
}
```

### 2. Connection Manager

**Responsibility:** Maintain robust LSP connection with automatic recovery.

```typescript
interface ConnectionConfig {
  // Server spawn configuration
  server: {
    module: string;           // Path to server module
    transport: 'stdio' | 'ipc' | 'socket';
    args: string[];
    env: Record<string, string>;
  };
  
  // Resilience configuration
  resilience: {
    maxRestarts: number;      // Max restarts before giving up (default: 5)
    restartDelay: number;     // Base delay between restarts (default: 1000ms)
    backoffMultiplier: number; // Exponential backoff (default: 2)
    healthCheckInterval: number; // Health check frequency (default: 30000ms)
  };
  
  // Timeout configuration
  timeouts: {
    initialize: number;       // Server initialization (default: 10000ms)
    request: number;          // Individual requests (default: 5000ms)
    shutdown: number;         // Graceful shutdown (default: 2000ms)
  };
}

class ConnectionManager {
  private client: LanguageClient | null = null;
  private state: ConnectionState = 'disconnected';
  private restartCount = 0;
  private healthCheckTimer: NodeJS.Timer | null = null;
  
  private readonly stateEmitter = new vscode.EventEmitter<ConnectionState>();
  readonly onStateChange = this.stateEmitter.event;
  
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }
    
    this.setState('connecting');
    
    try {
      this.client = await this.createClient();
      await this.client.start();
      
      // Wait for initialization
      await this.waitForReady();
      
      this.setState('connected');
      this.restartCount = 0;
      this.startHealthCheck();
      
    } catch (error) {
      this.handleConnectionError(error);
    }
  }
  
  private async handleConnectionError(error: unknown): Promise<void> {
    this.setState('error');
    
    if (this.restartCount >= this.config.resilience.maxRestarts) {
      this.setState('failed');
      this.showFatalError(error);
      return;
    }
    
    const delay = this.calculateBackoff();
    this.restartCount++;
    
    this.log.warn(`Connection failed, restarting in ${delay}ms (attempt ${this.restartCount})`);
    
    await this.sleep(delay);
    await this.connect();
  }
  
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(async () => {
      if (!await this.isHealthy()) {
        this.log.warn('Health check failed, reconnecting...');
        await this.reconnect();
      }
    }, this.config.resilience.healthCheckInterval);
  }
  
  private async isHealthy(): Promise<boolean> {
    try {
      // Send a lightweight request to verify server is responsive
      const response = await Promise.race([
        this.client?.sendRequest('drift/health'),
        this.timeout(5000),
      ]);
      return response !== undefined;
    } catch {
      return false;
    }
  }
}
```

### 3. State Manager

**Responsibility:** Centralized, reactive state management with persistence.

```typescript
interface ExtensionState {
  // Connection state
  connection: {
    status: ConnectionState;
    serverVersion: string | null;
    lastError: string | null;
  };
  
  // Workspace state
  workspace: {
    initialized: boolean;
    projectRoot: string | null;
    configPath: string | null;
    lastScanTime: Date | null;
  };
  
  // Pattern state (cached from LSP)
  patterns: {
    total: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    lastUpdated: Date | null;
  };
  
  // Violation state
  violations: {
    total: number;
    bySeverity: Record<string, number>;
    activeFile: string | null;
    activeFileCount: number;
  };
  
  // UI state
  ui: {
    statusBarVisible: boolean;
    sidebarExpanded: boolean;
    activePanel: string | null;
    notifications: Notification[];
  };
  
  // User preferences (persisted)
  preferences: {
    autoScan: boolean;
    showInlineHints: boolean;
    severityFilter: Severity[];
    categoryFilter: string[];
  };
}

class StateManager {
  private state: ExtensionState;
  private subscribers = new Map<string, Set<(state: ExtensionState) => void>>();
  private persistenceKey = 'drift.state';
  
  constructor(private context: vscode.ExtensionContext) {
    this.state = this.loadPersistedState();
  }
  
  // Selector-based subscriptions for efficient updates
  subscribe<T>(
    selector: (state: ExtensionState) => T,
    callback: (value: T) => void
  ): vscode.Disposable {
    let previousValue = selector(this.state);
    
    const listener = (state: ExtensionState) => {
      const newValue = selector(state);
      if (!this.shallowEqual(previousValue, newValue)) {
        previousValue = newValue;
        callback(newValue);
      }
    };
    
    this.addListener(listener);
    return { dispose: () => this.removeListener(listener) };
  }
  
  // Immer-style updates for immutability
  update(updater: (draft: ExtensionState) => void): void {
    const draft = this.createDraft(this.state);
    updater(draft);
    this.state = this.finalizeDraft(draft);
    this.notifySubscribers();
    this.persistState();
  }
  
  // Batch updates for performance
  batch(updates: Array<(draft: ExtensionState) => void>): void {
    const draft = this.createDraft(this.state);
    for (const update of updates) {
      update(draft);
    }
    this.state = this.finalizeDraft(draft);
    this.notifySubscribers();
    this.persistState();
  }
  
  private persistState(): void {
    // Only persist user preferences, not transient state
    const toPersist = {
      preferences: this.state.preferences,
      ui: {
        sidebarExpanded: this.state.ui.sidebarExpanded,
      },
    };
    this.context.globalState.update(this.persistenceKey, toPersist);
  }
}
```

---

## UI Components

### 4. Status Bar

**Responsibility:** Always-visible health indicator with quick actions.

```typescript
interface StatusBarConfig {
  position: 'left' | 'right';
  priority: number;
  
  // Display modes based on state
  modes: {
    initializing: { icon: string; text: string; tooltip: string };
    healthy: { icon: string; text: string; tooltip: string };
    warning: { icon: string; text: string; tooltip: string };
    error: { icon: string; text: string; tooltip: string };
    scanning: { icon: string; text: string; tooltip: string };
  };
  
  // Click behavior
  onClick: 'showMenu' | 'showPanel' | 'runCommand';
  command?: string;
}

class StatusBarController {
  private item: vscode.StatusBarItem;
  private animationFrame = 0;
  private animationTimer: NodeJS.Timer | null = null;
  
  constructor(
    private state: StateManager,
    private config: StatusBarConfig
  ) {
    this.item = vscode.window.createStatusBarItem(
      config.position === 'left' 
        ? vscode.StatusBarAlignment.Left 
        : vscode.StatusBarAlignment.Right,
      config.priority
    );
    
    // React to state changes
    this.state.subscribe(
      s => ({ 
        connection: s.connection.status,
        violations: s.violations.total,
        scanning: s.workspace.lastScanTime,
      }),
      this.updateDisplay.bind(this)
    );
  }
  
  private updateDisplay(data: { connection: string; violations: number; scanning: Date | null }): void {
    const { connection, violations } = data;
    
    if (connection === 'connecting') {
      this.showMode('initializing');
      this.startAnimation();
      return;
    }
    
    this.stopAnimation();
    
    if (connection === 'error' || connection === 'failed') {
      this.showMode('error');
      return;
    }
    
    if (violations > 0) {
      this.item.text = `$(warning) Drift: ${violations}`;
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      this.item.tooltip = this.buildTooltip(violations);
    } else {
      this.showMode('healthy');
    }
  }
  
  private buildTooltip(violations: number): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    
    md.appendMarkdown(`### $(warning) ${violations} Violations\n\n`);
    md.appendMarkdown(`[View All](command:drift.showViolations) | `);
    md.appendMarkdown(`[Rescan](command:drift.rescan) | `);
    md.appendMarkdown(`[Settings](command:drift.openSettings)\n\n`);
    
    // Add breakdown by severity
    const state = this.state.getState();
    for (const [severity, count] of Object.entries(state.violations.bySeverity)) {
      md.appendMarkdown(`- ${this.getSeverityIcon(severity)} ${severity}: ${count}\n`);
    }
    
    return md;
  }
  
  private startAnimation(): void {
    const frames = ['$(sync~spin)', '$(loading~spin)'];
    this.animationTimer = setInterval(() => {
      this.animationFrame = (this.animationFrame + 1) % frames.length;
      this.item.text = `${frames[this.animationFrame]} Drift: Starting...`;
    }, 500);
  }
}
```

### 5. Tree View Providers

**Responsibility:** Hierarchical navigation of patterns, violations, and files.

```typescript
// Pattern Tree Structure
interface PatternTreeItem {
  type: 'category' | 'pattern' | 'location';
  id: string;
  label: string;
  description?: string;
  iconPath?: vscode.ThemeIcon;
  contextValue: string;  // For context menu filtering
  collapsibleState: vscode.TreeItemCollapsibleState;
  command?: vscode.Command;
  
  // For patterns
  pattern?: {
    confidence: number;
    status: 'discovered' | 'approved' | 'ignored';
    locationCount: number;
  };
  
  // For locations
  location?: {
    file: string;
    line: number;
    column: number;
  };
}

class PatternsTreeProvider implements vscode.TreeDataProvider<PatternTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<PatternTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  
  private cache = new Map<string, PatternTreeItem[]>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 30000; // 30 seconds
  
  constructor(
    private client: LanguageClient,
    private state: StateManager
  ) {
    // Refresh on pattern changes
    this.state.subscribe(
      s => s.patterns.lastUpdated,
      () => this.invalidateCache()
    );
  }
  
  async getChildren(element?: PatternTreeItem): Promise<PatternTreeItem[]> {
    if (!element) {
      return this.getCategories();
    }
    
    switch (element.type) {
      case 'category':
        return this.getPatternsInCategory(element.id);
      case 'pattern':
        return this.getPatternLocations(element.id);
      default:
        return [];
    }
  }
  
  private async getCategories(): Promise<PatternTreeItem[]> {
    const cacheKey = 'categories';
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    const response = await this.client.sendRequest('drift/patterns/categories');
    
    const items: PatternTreeItem[] = response.categories.map((cat: any) => ({
      type: 'category',
      id: cat.name,
      label: cat.name,
      description: `${cat.count} patterns`,
      iconPath: this.getCategoryIcon(cat.name),
      contextValue: 'category',
      collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
    }));
    
    this.setCache(cacheKey, items);
    return items;
  }
  
  // Drag and drop support for pattern organization
  readonly dragMimeTypes = ['application/vnd.drift.pattern'];
  readonly dropMimeTypes = ['application/vnd.drift.pattern'];
  
  handleDrag(source: PatternTreeItem[], dataTransfer: vscode.DataTransfer): void {
    dataTransfer.set(
      'application/vnd.drift.pattern',
      new vscode.DataTransferItem(source.map(s => s.id))
    );
  }
  
  async handleDrop(target: PatternTreeItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> {
    const patternIds = dataTransfer.get('application/vnd.drift.pattern')?.value;
    if (!patternIds || !target || target.type !== 'category') {
      return;
    }
    
    // Move patterns to new category (if supported)
    await this.client.sendRequest('drift/patterns/move', {
      patternIds,
      targetCategory: target.id,
    });
    
    this.invalidateCache();
  }
}
```


### 6. Inline Decorations

**Responsibility:** Non-intrusive visual indicators in the editor.

```typescript
interface DecorationConfig {
  // Gutter icons
  gutter: {
    enabled: boolean;
    icons: Record<Severity, string>;
  };
  
  // Inline hints (like TypeScript inlay hints)
  inlineHints: {
    enabled: boolean;
    position: 'before' | 'after' | 'eol';
    maxLength: number;
  };
  
  // Background highlighting
  background: {
    enabled: boolean;
    colors: Record<Severity, string>;
    opacity: number;
  };
  
  // Underlines (in addition to LSP diagnostics)
  underline: {
    enabled: boolean;
    style: 'solid' | 'wavy' | 'dashed' | 'dotted';
  };
}

class DecorationController {
  private decorationTypes = new Map<string, vscode.TextEditorDecorationType>();
  private activeDecorations = new Map<string, vscode.DecorationOptions[]>();
  
  constructor(
    private config: DecorationConfig,
    private state: StateManager
  ) {
    this.createDecorationTypes();
    
    // Update decorations when active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        this.updateDecorations(editor);
      }
    });
    
    // Update decorations when diagnostics change
    vscode.languages.onDidChangeDiagnostics(event => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.uris.some(uri => uri.toString() === editor.document.uri.toString())) {
        this.updateDecorations(editor);
      }
    });
  }
  
  private createDecorationTypes(): void {
    // Gutter decorations
    for (const [severity, icon] of Object.entries(this.config.gutter.icons)) {
      this.decorationTypes.set(`gutter-${severity}`, vscode.window.createTextEditorDecorationType({
        gutterIconPath: this.getIconPath(icon),
        gutterIconSize: 'contain',
      }));
    }
    
    // Inline hint decorations
    this.decorationTypes.set('inline-hint', vscode.window.createTextEditorDecorationType({
      after: {
        margin: '0 0 0 1em',
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
        fontStyle: 'italic',
      },
    }));
    
    // Background decorations
    for (const [severity, color] of Object.entries(this.config.background.colors)) {
      this.decorationTypes.set(`background-${severity}`, vscode.window.createTextEditorDecorationType({
        backgroundColor: `${color}${Math.round(this.config.background.opacity * 255).toString(16)}`,
        isWholeLine: true,
      }));
    }
  }
  
  private async updateDecorations(editor: vscode.TextEditor): Promise<void> {
    const uri = editor.document.uri;
    const diagnostics = vscode.languages.getDiagnostics(uri);
    
    // Filter to Drift diagnostics only
    const driftDiagnostics = diagnostics.filter(d => d.source === 'drift');
    
    // Group by severity for gutter icons
    const bySeverity = this.groupBySeverity(driftDiagnostics);
    
    for (const [severity, diags] of bySeverity) {
      const decorationType = this.decorationTypes.get(`gutter-${severity}`);
      if (decorationType && this.config.gutter.enabled) {
        const decorations = diags.map(d => ({
          range: d.range,
          hoverMessage: this.buildHoverMessage(d),
        }));
        editor.setDecorations(decorationType, decorations);
      }
    }
    
    // Inline hints
    if (this.config.inlineHints.enabled) {
      const hints = await this.buildInlineHints(driftDiagnostics);
      const hintType = this.decorationTypes.get('inline-hint');
      if (hintType) {
        editor.setDecorations(hintType, hints);
      }
    }
  }
  
  private buildHoverMessage(diagnostic: vscode.Diagnostic): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;
    
    md.appendMarkdown(`**${this.getSeverityEmoji(diagnostic.severity)} ${diagnostic.message}**\n\n`);
    
    if (diagnostic.code) {
      md.appendMarkdown(`Pattern: \`${diagnostic.code}\`\n\n`);
    }
    
    md.appendMarkdown('---\n\n');
    md.appendMarkdown(`[Quick Fix](command:drift.quickFix?${encodeURIComponent(JSON.stringify({ uri: diagnostic.source, range: diagnostic.range }))}) | `);
    md.appendMarkdown(`[Ignore](command:drift.ignoreOnce) | `);
    md.appendMarkdown(`[Explain](command:drift.explainWithAI)\n`);
    
    return md;
  }
}
```

### 7. Webview Panels

**Responsibility:** Rich, interactive UI for complex workflows.

```typescript
interface WebviewPanelConfig {
  viewType: string;
  title: string;
  
  // Resource loading
  localResourceRoots: string[];
  enableScripts: boolean;
  
  // State persistence
  retainContextWhenHidden: boolean;
  
  // Communication
  messageHandlers: Record<string, (data: any) => Promise<any>>;
}

class WebviewManager {
  private panels = new Map<string, vscode.WebviewPanel>();
  private messageQueue = new Map<string, Array<{ type: string; data: any }>>();
  
  constructor(
    private context: vscode.ExtensionContext,
    private state: StateManager
  ) {}
  
  async showPanel(config: WebviewPanelConfig): Promise<vscode.WebviewPanel> {
    // Reuse existing panel if available
    const existing = this.panels.get(config.viewType);
    if (existing) {
      existing.reveal();
      return existing;
    }
    
    const panel = vscode.window.createWebviewPanel(
      config.viewType,
      config.title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: config.enableScripts,
        retainContextWhenHidden: config.retainContextWhenHidden,
        localResourceRoots: config.localResourceRoots.map(
          root => vscode.Uri.joinPath(this.context.extensionUri, root)
        ),
      }
    );
    
    // Set up message handling
    panel.webview.onDidReceiveMessage(async message => {
      const handler = config.messageHandlers[message.type];
      if (handler) {
        try {
          const response = await handler(message.data);
          panel.webview.postMessage({ 
            type: `${message.type}:response`,
            requestId: message.requestId,
            data: response,
          });
        } catch (error) {
          panel.webview.postMessage({
            type: `${message.type}:error`,
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
    
    // Handle panel disposal
    panel.onDidDispose(() => {
      this.panels.delete(config.viewType);
    });
    
    // Load content
    panel.webview.html = await this.buildWebviewHtml(panel.webview, config);
    
    this.panels.set(config.viewType, panel);
    
    // Flush any queued messages
    const queued = this.messageQueue.get(config.viewType) || [];
    for (const msg of queued) {
      panel.webview.postMessage(msg);
    }
    this.messageQueue.delete(config.viewType);
    
    return panel;
  }
  
  private async buildWebviewHtml(webview: vscode.Webview, config: WebviewPanelConfig): Promise<string> {
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
    window.initialState = ${JSON.stringify(this.getInitialState(config.viewType))};
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
```

---

## Command System

### 8. Command Router

**Responsibility:** Centralized command handling with middleware support.

```typescript
interface CommandDefinition {
  id: string;
  title: string;
  category: 'Drift';
  
  // Execution
  handler: (args: any) => Promise<void>;
  
  // Enablement
  when?: string;  // VS Code when clause
  enablement?: (state: ExtensionState) => boolean;
  
  // UI
  icon?: string;
  keybinding?: string;
  menu?: Array<{
    group: string;
    when?: string;
    order?: number;
  }>;
}

class CommandRouter {
  private commands = new Map<string, CommandDefinition>();
  private middleware: CommandMiddleware[] = [];
  
  constructor(
    private context: vscode.ExtensionContext,
    private state: StateManager,
    private telemetry: TelemetryService
  ) {}
  
  register(definition: CommandDefinition): vscode.Disposable {
    this.commands.set(definition.id, definition);
    
    const disposable = vscode.commands.registerCommand(
      definition.id,
      async (...args: any[]) => {
        await this.execute(definition, args);
      }
    );
    
    this.context.subscriptions.push(disposable);
    return disposable;
  }
  
  use(middleware: CommandMiddleware): void {
    this.middleware.push(middleware);
  }
  
  private async execute(definition: CommandDefinition, args: any[]): Promise<void> {
    const startTime = performance.now();
    const context: CommandContext = {
      command: definition.id,
      args,
      state: this.state.getState(),
      startTime,
    };
    
    try {
      // Run middleware chain
      let index = 0;
      const next = async (): Promise<void> => {
        if (index < this.middleware.length) {
          const mw = this.middleware[index++];
          await mw(context, next);
        } else {
          await definition.handler(args[0]);
        }
      };
      
      await next();
      
      // Track success
      this.telemetry.trackCommand({
        command: definition.id,
        duration: performance.now() - startTime,
        success: true,
      });
      
    } catch (error) {
      // Track failure
      this.telemetry.trackCommand({
        command: definition.id,
        duration: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Show user-friendly error
      this.showCommandError(definition, error);
    }
  }
  
  private showCommandError(definition: CommandDefinition, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    
    vscode.window.showErrorMessage(
      `Drift: ${definition.title} failed - ${message}`,
      'Retry',
      'Report Issue'
    ).then(action => {
      if (action === 'Retry') {
        vscode.commands.executeCommand(definition.id);
      } else if (action === 'Report Issue') {
        vscode.commands.executeCommand('drift.reportIssue', { error, command: definition.id });
      }
    });
  }
}

// Middleware examples
const loggingMiddleware: CommandMiddleware = async (ctx, next) => {
  console.log(`[Drift] Executing command: ${ctx.command}`);
  await next();
  console.log(`[Drift] Command completed: ${ctx.command} (${performance.now() - ctx.startTime}ms)`);
};

const connectionCheckMiddleware: CommandMiddleware = async (ctx, next) => {
  if (ctx.state.connection.status !== 'connected') {
    throw new Error('Drift server is not connected. Please wait for initialization.');
  }
  await next();
};

const progressMiddleware: CommandMiddleware = async (ctx, next) => {
  // Only show progress for long-running commands
  const longRunning = ['drift.rescan', 'drift.exportPatterns', 'drift.generateReport'];
  
  if (longRunning.includes(ctx.command)) {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Drift: ${ctx.command.replace('drift.', '')}`,
        cancellable: true,
      },
      async (progress, token) => {
        ctx.progress = progress;
        ctx.cancellationToken = token;
        await next();
      }
    );
  } else {
    await next();
  }
};
```

---

## Telemetry & Observability

### 9. Telemetry Service

**Responsibility:** Privacy-respecting usage analytics and error reporting.

```typescript
interface TelemetryConfig {
  // User consent
  enabled: boolean;
  level: 'off' | 'errors' | 'usage' | 'all';
  
  // Data handling
  anonymize: boolean;
  batchSize: number;
  flushInterval: number;
  
  // Endpoints
  endpoint?: string;
  errorEndpoint?: string;
}

interface TelemetryEvent {
  type: 'activation' | 'command' | 'error' | 'feature' | 'performance';
  timestamp: number;
  sessionId: string;
  
  // Common properties (anonymized)
  properties: {
    extensionVersion: string;
    vscodeVersion: string;
    platform: string;
    locale: string;
  };
  
  // Event-specific data
  data: Record<string, unknown>;
}

class TelemetryService {
  private sessionId: string;
  private eventQueue: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timer | null = null;
  
  constructor(
    private config: TelemetryConfig,
    private context: vscode.ExtensionContext
  ) {
    this.sessionId = this.generateSessionId();
    
    if (this.isEnabled()) {
      this.startFlushTimer();
    }
    
    // Respect VS Code telemetry settings
    vscode.env.onDidChangeTelemetryEnabled(enabled => {
      if (!enabled) {
        this.config.enabled = false;
        this.stopFlushTimer();
      }
    });
  }
  
  private isEnabled(): boolean {
    return this.config.enabled && 
           vscode.env.isTelemetryEnabled && 
           this.config.level !== 'off';
  }
  
  trackActivation(data: { totalTime: number; phases: Record<string, number> }): void {
    if (!this.isEnabled()) return;
    
    this.enqueue({
      type: 'activation',
      data: {
        totalTime: data.totalTime,
        phases: data.phases,
        workspaceType: this.getWorkspaceType(),
        hasConfig: this.hasConfig(),
      },
    });
  }
  
  trackCommand(data: { command: string; duration: number; success: boolean; error?: string }): void {
    if (!this.isEnabled() || this.config.level === 'errors') return;
    
    this.enqueue({
      type: 'command',
      data: {
        command: data.command,
        duration: Math.round(data.duration),
        success: data.success,
        // Only include error type, not message (privacy)
        errorType: data.error ? this.classifyError(data.error) : undefined,
      },
    });
  }
  
  trackError(error: Error, context?: Record<string, unknown>): void {
    if (!this.isEnabled()) return;
    
    this.enqueue({
      type: 'error',
      data: {
        errorType: error.name,
        errorMessage: this.config.anonymize ? this.anonymizeMessage(error.message) : error.message,
        stack: this.config.anonymize ? this.anonymizeStack(error.stack) : error.stack,
        context: this.sanitizeContext(context),
      },
    });
    
    // Errors flush immediately
    this.flush();
  }
  
  trackPerformance(metric: string, value: number, tags?: Record<string, string>): void {
    if (!this.isEnabled() || this.config.level !== 'all') return;
    
    this.enqueue({
      type: 'performance',
      data: { metric, value, tags },
    });
  }
  
  private enqueue(partial: Omit<TelemetryEvent, 'timestamp' | 'sessionId' | 'properties'>): void {
    this.eventQueue.push({
      ...partial,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      properties: this.getCommonProperties(),
    });
    
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }
  
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;
    
    const events = [...this.eventQueue];
    this.eventQueue = [];
    
    try {
      // Use VS Code's built-in telemetry if available
      const reporter = this.context.extension.packageJSON.telemetryReporter;
      if (reporter) {
        for (const event of events) {
          reporter.sendTelemetryEvent(event.type, event.data);
        }
      }
    } catch {
      // Silently fail - telemetry should never break the extension
    }
  }
  
  private anonymizeMessage(message: string): string {
    // Remove file paths, usernames, etc.
    return message
      .replace(/\/Users\/[^\/]+/g, '/Users/[redacted]')
      .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[redacted]')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]');
  }
}
```

---

## Configuration System

### 10. Configuration Manager

**Responsibility:** Type-safe, reactive configuration with validation.

```typescript
interface DriftConfiguration {
  // Server settings
  server: {
    path: string;
    args: string[];
    trace: 'off' | 'messages' | 'verbose';
  };
  
  // Scanning settings
  scan: {
    onSave: boolean;
    onOpen: boolean;
    debounceMs: number;
    excludePatterns: string[];
  };
  
  // Display settings
  display: {
    showStatusBar: boolean;
    showInlineHints: boolean;
    showGutterIcons: boolean;
    severityFilter: Severity[];
  };
  
  // AI settings
  ai: {
    enabled: boolean;
    provider: 'openai' | 'anthropic' | 'ollama' | 'none';
    model: string;
    apiKey?: string;  // Stored in secrets, not config
  };
  
  // Team settings (from .drift/config.json)
  team: {
    enforceApproved: boolean;
    requiredCategories: string[];
    customRules: string[];
  };
}

class ConfigurationManager {
  private config: DriftConfiguration;
  private watchers: vscode.Disposable[] = [];
  private readonly configEmitter = new vscode.EventEmitter<ConfigChangeEvent>();
  readonly onConfigChange = this.configEmitter.event;
  
  constructor(private context: vscode.ExtensionContext) {
    this.config = this.loadConfiguration();
    this.watchConfiguration();
  }
  
  get<K extends keyof DriftConfiguration>(section: K): DriftConfiguration[K] {
    return this.config[section];
  }
  
  async update<K extends keyof DriftConfiguration>(
    section: K,
    value: Partial<DriftConfiguration[K]>,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const vsConfig = vscode.workspace.getConfiguration('drift');
    
    // Merge with existing values
    const current = vsConfig.get<DriftConfiguration[K]>(section);
    const merged = { ...current, ...value };
    
    await vsConfig.update(section, merged, target);
  }
  
  private loadConfiguration(): DriftConfiguration {
    const vsConfig = vscode.workspace.getConfiguration('drift');
    
    // Load with defaults
    return {
      server: {
        path: vsConfig.get('server.path', ''),
        args: vsConfig.get('server.args', []),
        trace: vsConfig.get('server.trace', 'off'),
      },
      scan: {
        onSave: vsConfig.get('scan.onSave', true),
        onOpen: vsConfig.get('scan.onOpen', true),
        debounceMs: vsConfig.get('scan.debounceMs', 200),
        excludePatterns: vsConfig.get('scan.excludePatterns', ['**/node_modules/**']),
      },
      display: {
        showStatusBar: vsConfig.get('display.showStatusBar', true),
        showInlineHints: vsConfig.get('display.showInlineHints', true),
        showGutterIcons: vsConfig.get('display.showGutterIcons', true),
        severityFilter: vsConfig.get('display.severityFilter', ['error', 'warning']),
      },
      ai: {
        enabled: vsConfig.get('ai.enabled', false),
        provider: vsConfig.get('ai.provider', 'none'),
        model: vsConfig.get('ai.model', ''),
      },
      team: this.loadTeamConfig(),
    };
  }
  
  private loadTeamConfig(): DriftConfiguration['team'] {
    // Load from .drift/config.json in workspace
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return { enforceApproved: false, requiredCategories: [], customRules: [] };
    }
    
    const configPath = vscode.Uri.joinPath(workspaceFolder.uri, '.drift', 'config.json');
    
    try {
      const content = fs.readFileSync(configPath.fsPath, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        enforceApproved: parsed.enforceApproved ?? false,
        requiredCategories: parsed.requiredCategories ?? [],
        customRules: parsed.customRules ?? [],
      };
    } catch {
      return { enforceApproved: false, requiredCategories: [], customRules: [] };
    }
  }
  
  private watchConfiguration(): void {
    // Watch VS Code settings
    this.watchers.push(
      vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('drift')) {
          const oldConfig = this.config;
          this.config = this.loadConfiguration();
          this.emitChanges(oldConfig, this.config);
        }
      })
    );
    
    // Watch .drift/config.json
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const pattern = new vscode.RelativePattern(workspaceFolder, '.drift/config.json');
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      
      watcher.onDidChange(() => this.reloadTeamConfig());
      watcher.onDidCreate(() => this.reloadTeamConfig());
      watcher.onDidDelete(() => this.reloadTeamConfig());
      
      this.watchers.push(watcher);
    }
  }
}
```

---

## Package.json Contributions

### 11. Full Package.json Structure

```json
{
  "name": "@drift/vscode",
  "displayName": "Drift - Architectural Drift Detection",
  "description": "Detect and prevent architectural drift in your codebase",
  "version": "0.1.0",
  "publisher": "drift",
  "icon": "resources/icon.png",
  "galleryBanner": {
    "color": "#1e1e1e",
    "theme": "dark"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/drift/drift"
  },
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": [
    "Linters",
    "Programming Languages",
    "Other"
  ],
  "keywords": [
    "drift",
    "architecture",
    "patterns",
    "linting",
    "code quality"
  ],
  "activationEvents": [
    "onStartupFinished"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "drift.rescan",
        "title": "Rescan Workspace",
        "category": "Drift",
        "icon": "$(refresh)"
      },
      {
        "command": "drift.showPatterns",
        "title": "Show All Patterns",
        "category": "Drift",
        "icon": "$(list-tree)"
      },
      {
        "command": "drift.showViolations",
        "title": "Show All Violations",
        "category": "Drift",
        "icon": "$(warning)"
      },
      {
        "command": "drift.approvePattern",
        "title": "Approve Pattern",
        "category": "Drift",
        "icon": "$(check)"
      },
      {
        "command": "drift.ignorePattern",
        "title": "Ignore Pattern",
        "category": "Drift",
        "icon": "$(x)"
      },
      {
        "command": "drift.ignoreOnce",
        "title": "Ignore This Occurrence",
        "category": "Drift"
      },
      {
        "command": "drift.createVariant",
        "title": "Create Variant",
        "category": "Drift",
        "icon": "$(git-branch)"
      },
      {
        "command": "drift.explainWithAI",
        "title": "Explain with AI",
        "category": "Drift",
        "icon": "$(sparkle)"
      },
      {
        "command": "drift.fixWithAI",
        "title": "Fix with AI",
        "category": "Drift",
        "icon": "$(wand)"
      },
      {
        "command": "drift.openDashboard",
        "title": "Open Dashboard",
        "category": "Drift",
        "icon": "$(dashboard)"
      },
      {
        "command": "drift.openSettings",
        "title": "Open Settings",
        "category": "Drift",
        "icon": "$(gear)"
      },
      {
        "command": "drift.exportPatterns",
        "title": "Export Patterns",
        "category": "Drift"
      },
      {
        "command": "drift.generateReport",
        "title": "Generate Report",
        "category": "Drift"
      }
    ],
    "configuration": {
      "title": "Drift",
      "properties": {
        "drift.server.path": {
          "type": "string",
          "default": "",
          "description": "Path to Drift LSP server (leave empty to use bundled server)"
        },
        "drift.server.trace": {
          "type": "string",
          "enum": ["off", "messages", "verbose"],
          "default": "off",
          "description": "Trace communication with the Drift server"
        },
        "drift.scan.onSave": {
          "type": "boolean",
          "default": true,
          "description": "Scan files when saved"
        },
        "drift.scan.onOpen": {
          "type": "boolean",
          "default": true,
          "description": "Scan files when opened"
        },
        "drift.scan.debounceMs": {
          "type": "number",
          "default": 200,
          "description": "Debounce delay for scanning (ms)"
        },
        "drift.scan.excludePatterns": {
          "type": "array",
          "items": { "type": "string" },
          "default": ["**/node_modules/**", "**/dist/**", "**/.git/**"],
          "description": "Glob patterns to exclude from scanning"
        },
        "drift.display.showStatusBar": {
          "type": "boolean",
          "default": true,
          "description": "Show Drift status in the status bar"
        },
        "drift.display.showInlineHints": {
          "type": "boolean",
          "default": true,
          "description": "Show inline hints for violations"
        },
        "drift.display.showGutterIcons": {
          "type": "boolean",
          "default": true,
          "description": "Show gutter icons for violations"
        },
        "drift.display.severityFilter": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["error", "warning", "info", "hint"]
          },
          "default": ["error", "warning"],
          "description": "Severity levels to display"
        },
        "drift.ai.enabled": {
          "type": "boolean",
          "default": false,
          "description": "Enable AI-powered features"
        },
        "drift.ai.provider": {
          "type": "string",
          "enum": ["openai", "anthropic", "ollama", "none"],
          "default": "none",
          "description": "AI provider for explanations and fixes"
        },
        "drift.ai.model": {
          "type": "string",
          "default": "",
          "description": "AI model to use"
        }
      }
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "drift",
          "title": "Drift",
          "icon": "resources/drift-icon.svg"
        }
      ]
    },
    "views": {
      "drift": [
        {
          "id": "drift.patterns",
          "name": "Patterns",
          "icon": "$(list-tree)",
          "contextualTitle": "Drift Patterns"
        },
        {
          "id": "drift.violations",
          "name": "Violations",
          "icon": "$(warning)",
          "contextualTitle": "Drift Violations"
        },
        {
          "id": "drift.files",
          "name": "Files",
          "icon": "$(file-code)",
          "contextualTitle": "Files with Patterns"
        }
      ]
    },
    "viewsWelcome": [
      {
        "view": "drift.patterns",
        "contents": "No patterns detected yet.\n[Scan Workspace](command:drift.rescan)"
      },
      {
        "view": "drift.violations",
        "contents": "No violations found. Your code follows all detected patterns! 🎉"
      }
    ],
    "menus": {
      "view/title": [
        {
          "command": "drift.rescan",
          "when": "view =~ /^drift\\./",
          "group": "navigation"
        }
      ],
      "view/item/context": [
        {
          "command": "drift.approvePattern",
          "when": "view == drift.patterns && viewItem == pattern",
          "group": "inline"
        },
        {
          "command": "drift.ignorePattern",
          "when": "view == drift.patterns && viewItem == pattern",
          "group": "inline"
        }
      ],
      "editor/context": [
        {
          "command": "drift.explainWithAI",
          "when": "editorHasSelection && drift.aiEnabled",
          "group": "drift@1"
        },
        {
          "command": "drift.fixWithAI",
          "when": "editorHasSelection && drift.aiEnabled",
          "group": "drift@2"
        }
      ],
      "commandPalette": [
        {
          "command": "drift.approvePattern",
          "when": "drift.hasPatterns"
        },
        {
          "command": "drift.ignorePattern",
          "when": "drift.hasPatterns"
        }
      ]
    },
    "keybindings": [
      {
        "command": "drift.rescan",
        "key": "ctrl+shift+d r",
        "mac": "cmd+shift+d r"
      },
      {
        "command": "drift.showViolations",
        "key": "ctrl+shift+d v",
        "mac": "cmd+shift+d v"
      },
      {
        "command": "drift.showPatterns",
        "key": "ctrl+shift+d p",
        "mac": "cmd+shift+d p"
      }
    ],
    "colors": [
      {
        "id": "drift.violationBackground",
        "description": "Background color for violation highlights",
        "defaults": {
          "dark": "#ff000020",
          "light": "#ff000010"
        }
      },
      {
        "id": "drift.patternBackground",
        "description": "Background color for pattern highlights",
        "defaults": {
          "dark": "#00ff0020",
          "light": "#00ff0010"
        }
      }
    ],
    "icons": {
      "drift-logo": {
        "description": "Drift logo",
        "default": {
          "fontPath": "resources/drift-icons.woff",
          "fontCharacter": "\\E001"
        }
      }
    }
  }
}
```


---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

| Component | File | Priority |
|-----------|------|----------|
| Activation Controller | `src/activation/controller.ts` | P0 |
| Connection Manager | `src/client/connection-manager.ts` | P0 |
| Language Client | `src/client/language-client.ts` | P0 |
| State Manager | `src/state/state-manager.ts` | P0 |
| Status Bar | `src/ui/status-bar.ts` | P0 |
| Basic Commands | `src/commands/core-commands.ts` | P0 |

**Deliverable:** Extension activates, connects to LSP, shows status bar, basic commands work.

### Phase 2: Core UI (Week 3-4)

| Component | File | Priority |
|-----------|------|----------|
| Patterns Tree View | `src/views/patterns-tree.ts` | P0 |
| Violations Tree View | `src/views/violations-tree.ts` | P0 |
| Files Tree View | `src/views/files-tree.ts` | P1 |
| Inline Decorations | `src/ui/decorations.ts` | P1 |
| Configuration Manager | `src/config/config-manager.ts` | P0 |

**Deliverable:** Full tree view navigation, inline decorations, configuration UI.

### Phase 3: Advanced Features (Week 5-6)

| Component | File | Priority |
|-----------|------|----------|
| Webview Manager | `src/webview/webview-manager.ts` | P1 |
| Dashboard Panel | `src/webview/panels/dashboard.tsx` | P1 |
| Pattern Detail Panel | `src/webview/panels/pattern-detail.tsx` | P1 |
| Command Router | `src/commands/command-router.ts` | P1 |
| Telemetry Service | `src/telemetry/telemetry-service.ts` | P2 |

**Deliverable:** Rich webview panels, full command system, telemetry.

### Phase 4: AI Integration (Week 7)

| Component | File | Priority |
|-----------|------|----------|
| AI Service | `src/ai/ai-service.ts` | P1 |
| Explain Command | `src/commands/ai/explain.ts` | P1 |
| Fix Command | `src/commands/ai/fix.ts` | P1 |
| Secret Storage | `src/ai/secret-storage.ts` | P1 |

**Deliverable:** AI-powered explanations and fixes.

### Phase 5: Polish & Performance (Week 8)

| Task | Priority |
|------|----------|
| Performance profiling | P0 |
| Memory leak detection | P0 |
| Error boundary implementation | P1 |
| Accessibility audit | P1 |
| Documentation | P1 |
| Marketplace assets | P1 |

**Deliverable:** Production-ready extension.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Activation time | < 100ms | Telemetry |
| Time to first diagnostic | < 500ms | Telemetry |
| Memory usage | < 100MB | VS Code profiler |
| LSP reconnection success | > 99% | Telemetry |
| Command success rate | > 99% | Telemetry |
| User satisfaction | > 4.5 stars | Marketplace |

---

## Security Considerations

### Secret Management

```typescript
class SecretStorage {
  constructor(private secrets: vscode.SecretStorage) {}
  
  async getApiKey(provider: string): Promise<string | undefined> {
    return this.secrets.get(`drift.ai.${provider}.apiKey`);
  }
  
  async setApiKey(provider: string, key: string): Promise<void> {
    await this.secrets.store(`drift.ai.${provider}.apiKey`, key);
  }
  
  async deleteApiKey(provider: string): Promise<void> {
    await this.secrets.delete(`drift.ai.${provider}.apiKey`);
  }
}
```

### Content Security Policy

All webviews use strict CSP:
- No inline scripts (nonce required)
- No external resources
- Limited to extension resources

### Input Validation

All user input is validated before sending to LSP:
- File paths are normalized and checked for traversal
- Pattern IDs are validated against known patterns
- Command arguments are type-checked

---

## Testing Strategy

### Unit Tests

```typescript
// Example: State Manager tests
describe('StateManager', () => {
  it('should notify subscribers on state change', () => {
    const manager = new StateManager(mockContext);
    const callback = vi.fn();
    
    manager.subscribe(s => s.violations.total, callback);
    manager.update(draft => { draft.violations.total = 5; });
    
    expect(callback).toHaveBeenCalledWith(5);
  });
  
  it('should not notify if selected value unchanged', () => {
    const manager = new StateManager(mockContext);
    const callback = vi.fn();
    
    manager.subscribe(s => s.violations.total, callback);
    manager.update(draft => { draft.patterns.total = 10; });
    
    expect(callback).not.toHaveBeenCalled();
  });
});
```

### Integration Tests

```typescript
// Example: Extension activation test
describe('Extension Activation', () => {
  it('should activate within 100ms', async () => {
    const start = performance.now();
    await vscode.extensions.getExtension('drift.drift')?.activate();
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
  
  it('should connect to LSP server', async () => {
    const extension = vscode.extensions.getExtension('drift.drift');
    await extension?.activate();
    
    // Wait for connection
    await waitFor(() => {
      const state = extension?.exports.getState();
      return state.connection.status === 'connected';
    });
  });
});
```

### E2E Tests

Using VS Code's test runner:
- Open workspace with known patterns
- Verify diagnostics appear
- Test code actions
- Test tree view navigation
- Test webview panels

---

## File Structure

```
drift/packages/vscode/
├── src/
│   ├── activation/
│   │   ├── controller.ts
│   │   └── phases.ts
│   ├── client/
│   │   ├── connection-manager.ts
│   │   ├── language-client.ts
│   │   └── middleware.ts
│   ├── commands/
│   │   ├── command-router.ts
│   │   ├── core-commands.ts
│   │   ├── pattern-commands.ts
│   │   └── ai/
│   │       ├── explain.ts
│   │       └── fix.ts
│   ├── config/
│   │   ├── config-manager.ts
│   │   └── schema.ts
│   ├── state/
│   │   ├── state-manager.ts
│   │   └── selectors.ts
│   ├── ui/
│   │   ├── status-bar.ts
│   │   ├── decorations.ts
│   │   └── notifications.ts
│   ├── views/
│   │   ├── patterns-tree.ts
│   │   ├── violations-tree.ts
│   │   ├── files-tree.ts
│   │   └── lazy-provider.ts
│   ├── webview/
│   │   ├── webview-manager.ts
│   │   └── panels/
│   │       ├── dashboard.tsx
│   │       └── pattern-detail.tsx
│   ├── telemetry/
│   │   └── telemetry-service.ts
│   ├── ai/
│   │   ├── ai-service.ts
│   │   └── secret-storage.ts
│   ├── types/
│   │   └── index.ts
│   └── extension.ts
├── resources/
│   ├── icon.png
│   ├── drift-icon.svg
│   └── drift-icons.woff
├── test/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
├── tsconfig.json
└── webpack.config.js
```

---

## References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

---

**End of Design Document**
