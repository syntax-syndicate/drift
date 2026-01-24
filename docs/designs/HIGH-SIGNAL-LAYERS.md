# High-Signal Codebase Layers Design

> Three new analysis layers to maximize Drift's intelligence about codebases.

## Implementation Status

| Layer | Status | Files |
|-------|--------|-------|
| L5: Test Topology | ✅ Implemented | `packages/core/src/test-topology/` |
| L6: Module Coupling | ✅ Implemented | `packages/core/src/module-coupling/` |
| L7: Error Handling | ✅ Implemented | `packages/core/src/error-handling/` |

### L5 Implementation Details

**Core Files:**
- `types.ts` - Type definitions for test topology
- `extractors/base-test-extractor.ts` - Abstract base class
- `extractors/typescript-test-extractor.ts` - Jest/Vitest/Mocha support
- `extractors/python-test-extractor.ts` - pytest/unittest support
- `extractors/java-test-extractor.ts` - JUnit 4/5/TestNG/Mockito support
- `extractors/csharp-test-extractor.ts` - xUnit/NUnit/MSTest/Moq support
- `extractors/php-test-extractor.ts` - PHPUnit/Pest support
- `test-topology-analyzer.ts` - Main analyzer orchestrating extraction

**CLI Commands:**
- `drift test-topology build` - Build test topology
- `drift test-topology status` - Show overview
- `drift test-topology uncovered` - Find untested functions
- `drift test-topology mocks` - Analyze mock patterns
- `drift test-topology affected <files...>` - Get minimum test set

**MCP Tool:**
- `drift_test_topology` with actions: status, coverage, uncovered, mocks, affected, quality

### L6 Implementation Details

**Core Files:**
- `types.ts` - Type definitions (ModuleNode, ImportEdge, DependencyCycle, CouplingMetrics, etc.)
- `coupling-analyzer.ts` - Main analyzer with Tarjan's algorithm for cycle detection, Robert C. Martin metrics

**CLI Commands:**
- `drift coupling build` - Build module coupling graph
- `drift coupling status` - Show coupling overview
- `drift coupling cycles` - List dependency cycles
- `drift coupling hotspots` - Find highly coupled modules
- `drift coupling analyze <module>` - Analyze specific module
- `drift coupling refactor-impact <module>` - Analyze refactor impact
- `drift coupling unused-exports` - Find unused exports

**MCP Tool:**
- `drift_coupling` with actions: status, cycles, hotspots, analyze, refactor-impact, unused-exports

### L7 Implementation Details

**Core Files:**
- `types.ts` - Type definitions (ErrorHandlingProfile, ErrorBoundary, UnhandledErrorPath, etc.)
- `error-handling-analyzer.ts` - Main analyzer for error handling patterns and gaps

**CLI Commands:**
- `drift error-handling build` - Build error handling analysis
- `drift error-handling status` - Show error handling overview
- `drift error-handling gaps` - Find error handling gaps
- `drift error-handling boundaries` - List error boundaries
- `drift error-handling unhandled` - Find unhandled error paths
- `drift error-handling analyze <function>` - Analyze specific function

**MCP Tool:**
- `drift_error_handling` with actions: status, gaps, boundaries, unhandled, analyze

---

## Overview

Building on existing layers:
- L0: Syntax (file structure, naming)
- L1: Patterns (code style, API structure)
- L2: Data Flow (call graphs, reachability, boundaries)
- L3: Wrappers (abstraction layers, custom hooks)
- L4: Styling DNA (component patterns, design tokens)

This document proposes three new high-value layers:
- **L5: Test Topology** - "What tests should I run?"
- **L6: Module Coupling** - "How risky is this refactor?"
- **L7: Error Handling Coverage** - "Will this fail gracefully?"

---

## L5: Test Topology

### Problem Statement

Current coverage analysis focuses on sensitive data paths. But developers need:
1. "I changed `auth/login.ts` - which tests should I run?"
2. "This function has 0 test coverage - is that intentional?"
3. "Are we mocking too much? What's actually being tested?"

### Core Questions Answered

| Question | Current State | With Test Topology |
|----------|--------------|-------------------|
| Which tests cover this file? | ❌ Unknown | ✅ Direct mapping |
| What's the minimum test set for a change? | ❌ Run all | ✅ Affected tests only |
| Is this test actually testing real code? | ❌ Unknown | ✅ Mock depth analysis |
| Which code has no test coverage? | Partial (sensitive only) | ✅ Full coverage map |

### Data Model

```typescript
interface TestTopology {
  /** Map from source file → tests that cover it */
  coverageMap: Map<string, TestCoverage[]>;
  
  /** Map from test file → what it actually tests */
  testTargets: Map<string, TestTarget>;
  
  /** Functions with zero test coverage */
  uncoveredFunctions: UncoveredFunction[];
  
  /** Mock analysis per test */
  mockAnalysis: Map<string, MockProfile>;
}

interface TestCoverage {
  testFile: string;
  testName: string;
  /** How the test reaches this code: direct call, transitive, or via mock */
  reachType: 'direct' | 'transitive' | 'mocked';
  /** Call depth from test to this code */
  depth: number;
  /** Confidence this test actually exercises this code */
  confidence: number;
}

interface TestTarget {
  testFile: string;
  /** Functions directly called by this test */
  directCalls: string[];
  /** Functions transitively reachable */
  transitiveCalls: string[];
  /** What's being mocked */
  mocks: MockedDependency[];
  /** Test quality signals */
  quality: TestQualitySignals;
}

interface MockedDependency {
  /** What's being mocked (module path or function) */
  target: string;
  /** Mock type: jest.mock, sinon, manual stub, etc. */
  mockType: string;
  /** Is this mocking external deps (good) or internal code (suspicious)? */
  isExternal: boolean;
}

interface TestQualitySignals {
  /** Number of assertions */
  assertionCount: number;
  /** Does it test error cases? */
  hasErrorCases: boolean;
  /** Does it test edge cases (null, empty, boundary)? */
  hasEdgeCases: boolean;
  /** Mock-to-real ratio (high = potentially brittle) */
  mockRatio: number;
  /** Lines of setup vs actual test */
  setupRatio: number;
}

interface UncoveredFunction {
  functionId: string;
  file: string;
  name: string;
  /** Why it might be intentionally uncovered */
  possibleReasons: ('dead-code' | 'framework-hook' | 'generated' | 'trivial')[];
  /** Risk if this breaks */
  riskScore: number;
}
```

### Extraction Strategy

**Phase 1: Identify Test Files**
- Use existing `getDefaultTestPatterns()` from coverage-analyzer
- Parse test framework imports (jest, vitest, pytest, etc.)

**Phase 2: Extract Test Structure**
```typescript
// For each test file, extract:
interface TestExtraction {
  describes: DescribeBlock[];
  beforeEach: SetupBlock[];
  mocks: MockStatement[];
}

// Detect mock patterns per framework:
const MOCK_PATTERNS = {
  jest: [
    /jest\.mock\(['"]([^'"]+)['"]/,
    /jest\.spyOn\(([^,]+),/,
    /\.mockImplementation\(/,
  ],
  vitest: [
    /vi\.mock\(['"]([^'"]+)['"]/,
    /vi\.spyOn\(/,
  ],
  pytest: [
    /@patch\(['"]([^'"]+)['"]\)/,
    /mocker\.patch\(/,
    /MagicMock\(/,
  ],
  // ... other frameworks
};
```

**Phase 3: Build Coverage Map**
- Leverage existing call graph
- For each test function, traverse calls to find reachable production code
- Mark mocked paths as "not actually covered"

**Phase 4: Calculate Quality Signals**
```typescript
function analyzeTestQuality(testAst: AST): TestQualitySignals {
  return {
    assertionCount: countAssertions(testAst),
    hasErrorCases: hasErrorAssertions(testAst),
    hasEdgeCases: detectEdgeCaseTests(testAst),
    mockRatio: mocks.length / directCalls.length,
    setupRatio: setupLines / testLines,
  };
}
```

### MCP Tool: `drift_test_topology`

```typescript
// Query 1: What tests cover this file?
drift_test_topology(target: "src/auth/login.ts")
// Returns: List of tests, their quality, mock depth

// Query 2: What's the minimum test set for these changes?
drift_test_topology(changed: ["src/auth/login.ts", "src/auth/session.ts"])
// Returns: Minimal set of tests to run

// Query 3: Show uncovered code
drift_test_topology(action: "uncovered", minRisk: "medium")
// Returns: Functions with no coverage, sorted by risk

// Query 4: Mock analysis
drift_test_topology(action: "mock-analysis", testFile: "auth.test.ts")
// Returns: What's mocked, mock-to-real ratio, quality signals
```

### Integration with Existing Systems

- **Call Graph**: Reuse function resolution for test→code mapping
- **Impact Analyzer**: Combine with "affected tests" for smarter CI
- **Dead Code Detector**: Cross-reference uncovered code with dead code

---

## L6: Module Coupling Analysis

### Problem Statement

Developers need to understand:
1. "How tangled is this module with the rest of the codebase?"
2. "If I refactor this, what's the blast radius?"
3. "Are there circular dependencies I should break?"

### Core Questions Answered

| Question | Current State | With Module Coupling |
|----------|--------------|---------------------|
| How many files import this module? | ❌ Unknown | ✅ Afferent coupling score |
| How many modules does this depend on? | ❌ Unknown | ✅ Efferent coupling score |
| Are there circular dependencies? | ❌ Unknown | ✅ Cycle detection |
| What's the "instability" of this module? | ❌ Unknown | ✅ I = Ce/(Ca+Ce) metric |

### Data Model

```typescript
interface ModuleCouplingGraph {
  /** All modules (files or directories) */
  modules: Map<string, ModuleNode>;
  
  /** Import edges */
  imports: ImportEdge[];
  
  /** Detected cycles */
  cycles: DependencyCycle[];
  
  /** Aggregate metrics */
  metrics: CouplingMetrics;
}

interface ModuleNode {
  path: string;
  /** Modules that import this one (afferent coupling) */
  importedBy: string[];
  /** Modules this imports (efferent coupling) */
  imports: string[];
  /** Coupling metrics */
  metrics: {
    /** Afferent coupling: who depends on me */
    Ca: number;
    /** Efferent coupling: who do I depend on */
    Ce: number;
    /** Instability: Ce / (Ca + Ce). 0 = stable, 1 = unstable */
    instability: number;
    /** Abstractness: abstract types / total types */
    abstractness: number;
    /** Distance from main sequence: |A + I - 1| */
    distance: number;
  };
  /** Is this a "hub" (high Ca) or "authority" (high Ce)? */
  role: 'hub' | 'authority' | 'balanced' | 'isolated';
  /** Exports from this module */
  exports: ExportedSymbol[];
  /** Unused exports (exported but never imported) */
  unusedExports: string[];
}

interface ImportEdge {
  from: string;
  to: string;
  /** What's being imported */
  symbols: string[];
  /** Is this a type-only import? */
  isTypeOnly: boolean;
  /** Import weight (more symbols = tighter coupling) */
  weight: number;
}

interface DependencyCycle {
  /** Modules in the cycle */
  path: string[];
  /** Severity based on cycle length and module importance */
  severity: 'critical' | 'warning' | 'info';
  /** Suggested break points */
  breakPoints: CycleBreakSuggestion[];
}

interface CycleBreakSuggestion {
  /** Edge to remove */
  edge: { from: string; to: string };
  /** Why this is a good break point */
  rationale: string;
  /** Estimated effort */
  effort: 'low' | 'medium' | 'high';
}

interface CouplingMetrics {
  /** Average instability across all modules */
  avgInstability: number;
  /** Number of cycles */
  cycleCount: number;
  /** Modules in the "zone of pain" (stable + concrete) */
  zoneOfPain: string[];
  /** Modules in the "zone of uselessness" (unstable + abstract) */
  zoneOfUselessness: string[];
  /** Most coupled modules (highest Ca + Ce) */
  hotspots: string[];
}
```

### Extraction Strategy

**Phase 1: Parse Imports**
```typescript
// Already have ImportExtraction from call-graph types
// Extend to track:
interface EnhancedImport extends ImportExtraction {
  /** Resolved absolute path */
  resolvedPath: string;
  /** Is this internal or external (node_modules)? */
  isExternal: boolean;
  /** Import weight based on what's imported */
  weight: number;
}
```

**Phase 2: Build Dependency Graph**
```typescript
function buildModuleGraph(files: FileExtractionResult[]): ModuleCouplingGraph {
  const graph = new Map<string, ModuleNode>();
  
  for (const file of files) {
    // Add node
    graph.set(file.file, createModuleNode(file));
    
    // Add edges
    for (const imp of file.imports) {
      if (!imp.isExternal) {
        addEdge(file.file, imp.resolvedPath, imp);
      }
    }
  }
  
  // Calculate metrics
  for (const [path, node] of graph) {
    node.metrics = calculateCouplingMetrics(node, graph);
  }
  
  return { modules: graph, cycles: detectCycles(graph), ... };
}
```

**Phase 3: Detect Cycles (Tarjan's Algorithm)**
```typescript
function detectCycles(graph: Map<string, ModuleNode>): DependencyCycle[] {
  // Use Tarjan's strongly connected components
  const sccs = tarjanSCC(graph);
  
  // Filter to actual cycles (SCC size > 1)
  return sccs
    .filter(scc => scc.length > 1)
    .map(scc => ({
      path: scc,
      severity: calculateCycleSeverity(scc, graph),
      breakPoints: suggestBreakPoints(scc, graph),
    }));
}
```

**Phase 4: Calculate Robert C. Martin Metrics**
```typescript
function calculateCouplingMetrics(node: ModuleNode, graph: Map<string, ModuleNode>) {
  const Ca = node.importedBy.length;  // Afferent
  const Ce = node.imports.length;      // Efferent
  const I = Ce / (Ca + Ce) || 0;       // Instability
  const A = calculateAbstractness(node);
  const D = Math.abs(A + I - 1);       // Distance from main sequence
  
  return { Ca, Ce, instability: I, abstractness: A, distance: D };
}
```

### MCP Tool: `drift_coupling`

```typescript
// Query 1: Module coupling analysis
drift_coupling(target: "src/auth/")
// Returns: Ca, Ce, instability, who imports/is imported by

// Query 2: Find cycles
drift_coupling(action: "cycles")
// Returns: All dependency cycles with break suggestions

// Query 3: Coupling hotspots
drift_coupling(action: "hotspots", limit: 10)
// Returns: Most coupled modules, zones of pain

// Query 4: Refactor impact
drift_coupling(action: "refactor-impact", target: "src/utils/helpers.ts")
// Returns: All modules that would need updates if this changes

// Query 5: Unused exports
drift_coupling(action: "unused-exports")
// Returns: Exported symbols that are never imported
```

### Visualization (Galaxy Integration)

- Modules as nodes, imports as edges
- Node size = Ca + Ce (coupling)
- Edge thickness = import weight
- Color = instability (green=stable, red=unstable)
- Highlight cycles in red

---

## L7: Error Handling Coverage

### Problem Statement

Developers need to know:
1. "Does this function handle errors or just crash?"
2. "Where do errors get caught in the call chain?"
3. "Are there unhandled promise rejections?"

### Core Questions Answered

| Question | Current State | With Error Coverage |
|----------|--------------|-------------------|
| Does this function have error handling? | ❌ Unknown | ✅ Try/catch detection |
| Where do errors propagate to? | ❌ Unknown | ✅ Error boundary mapping |
| Are async errors handled? | ❌ Unknown | ✅ Promise chain analysis |
| What error types are caught? | ❌ Unknown | ✅ Catch clause analysis |

### Data Model

```typescript
interface ErrorHandlingTopology {
  /** Functions with their error handling status */
  functions: Map<string, ErrorHandlingProfile>;
  
  /** Error boundaries (where errors get caught) */
  boundaries: ErrorBoundary[];
  
  /** Unhandled error paths */
  unhandledPaths: UnhandledErrorPath[];
  
  /** Error propagation chains */
  propagationChains: ErrorPropagationChain[];
}

interface ErrorHandlingProfile {
  functionId: string;
  file: string;
  name: string;
  
  /** Does this function have try/catch? */
  hasTryCatch: boolean;
  
  /** Does this function throw? */
  canThrow: boolean;
  
  /** What types of errors does it catch? */
  catchTypes: CatchClause[];
  
  /** Does it re-throw after catching? */
  rethrows: boolean;
  
  /** For async functions: are promises handled? */
  asyncHandling: AsyncErrorHandling;
  
  /** Error handling quality score */
  qualityScore: number;
}

interface CatchClause {
  /** Error type being caught (or 'any' for bare catch) */
  errorType: string;
  /** What happens: log, rethrow, swallow, transform */
  action: 'log' | 'rethrow' | 'swallow' | 'transform' | 'recover';
  /** Line number */
  line: number;
}

interface AsyncErrorHandling {
  /** Has .catch() on promises */
  hasCatch: boolean;
  /** Uses try/catch with await */
  hasAsyncTryCatch: boolean;
  /** Has unhandled promise chains */
  hasUnhandledPromises: boolean;
  /** Specific unhandled locations */
  unhandledLocations: { line: number; expression: string }[];
}

interface ErrorBoundary {
  /** Function that catches errors */
  functionId: string;
  /** What it catches from */
  catchesFrom: string[];
  /** Error types handled */
  handledTypes: string[];
  /** Is this a framework boundary (React ErrorBoundary, Express middleware)? */
  isFrameworkBoundary: boolean;
  /** Coverage: what % of callers are protected */
  coverage: number;
}

interface UnhandledErrorPath {
  /** Entry point where error originates */
  entryPoint: string;
  /** Path to where error escapes */
  path: string[];
  /** What type of error */
  errorType: string;
  /** Severity based on entry point type */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Suggested fix location */
  suggestedBoundary: string;
}

interface ErrorPropagationChain {
  /** Where error originates */
  source: { functionId: string; throwLine: number };
  /** Where it gets caught (or null if uncaught) */
  sink: { functionId: string; catchLine: number } | null;
  /** Functions in between */
  propagationPath: string[];
  /** Does error get transformed along the way? */
  transformations: ErrorTransformation[];
}

interface ErrorTransformation {
  location: string;
  fromType: string;
  toType: string;
  /** Does it preserve stack trace? */
  preservesStack: boolean;
}
```

### Extraction Strategy

**Phase 1: Detect Error Handling Constructs**
```typescript
// Tree-sitter queries for each language
const ERROR_PATTERNS = {
  typescript: {
    tryCatch: '(try_statement) @try',
    throw: '(throw_statement) @throw',
    catch: '(catch_clause parameter: (identifier) @error_var)',
    promiseCatch: '(call_expression function: (member_expression property: (property_identifier) @method (#eq? @method "catch")))',
    asyncAwait: '(await_expression) @await',
  },
  python: {
    tryCatch: '(try_statement) @try',
    throw: '(raise_statement) @raise',
    catch: '(except_clause) @except',
    asyncAwait: '(await) @await',
  },
  // ... other languages
};
```

**Phase 2: Analyze Catch Clauses**
```typescript
function analyzeCatchClause(catchNode: AST): CatchClause {
  const errorType = extractErrorType(catchNode);
  const body = catchNode.body;
  
  // Determine action
  let action: CatchClause['action'];
  if (hasRethrow(body)) action = 'rethrow';
  else if (hasOnlyLogging(body)) action = 'log';
  else if (isEmpty(body)) action = 'swallow';
  else if (hasErrorTransform(body)) action = 'transform';
  else action = 'recover';
  
  return { errorType, action, line: catchNode.line };
}
```

**Phase 3: Build Error Propagation Graph**
```typescript
function buildErrorPropagation(callGraph: CallGraph): ErrorPropagationChain[] {
  const chains: ErrorPropagationChain[] = [];
  
  // For each function that can throw
  for (const [id, func] of callGraph.functions) {
    if (!func.canThrow) continue;
    
    // Trace up the call chain until we find a catch
    const chain = traceErrorPropagation(id, callGraph);
    chains.push(chain);
  }
  
  return chains;
}

function traceErrorPropagation(throwerId: string, graph: CallGraph): ErrorPropagationChain {
  const path: string[] = [throwerId];
  let current = throwerId;
  
  while (true) {
    const func = graph.functions.get(current);
    if (!func) break;
    
    // Check if any caller catches
    for (const caller of func.calledBy) {
      const callerFunc = graph.functions.get(caller.callerId);
      if (callerFunc?.hasTryCatch) {
        // Found a boundary
        return {
          source: { functionId: throwerId, throwLine: ... },
          sink: { functionId: caller.callerId, catchLine: ... },
          propagationPath: path,
          transformations: [],
        };
      }
      path.push(caller.callerId);
      current = caller.callerId;
    }
    
    // No more callers - error escapes
    if (func.calledBy.length === 0) {
      return {
        source: { functionId: throwerId, throwLine: ... },
        sink: null,  // Uncaught!
        propagationPath: path,
        transformations: [],
      };
    }
  }
}
```

**Phase 4: Detect Async Error Gaps**
```typescript
function analyzeAsyncErrors(func: FunctionNode, ast: AST): AsyncErrorHandling {
  const awaits = findAllAwaits(ast);
  const promiseChains = findPromiseChains(ast);
  
  const unhandledLocations: { line: number; expression: string }[] = [];
  
  // Check each await is in try/catch
  for (const awaitExpr of awaits) {
    if (!isInTryCatch(awaitExpr, ast)) {
      unhandledLocations.push({
        line: awaitExpr.line,
        expression: awaitExpr.text,
      });
    }
  }
  
  // Check promise chains have .catch()
  for (const chain of promiseChains) {
    if (!hasCatchHandler(chain)) {
      unhandledLocations.push({
        line: chain.line,
        expression: chain.text,
      });
    }
  }
  
  return {
    hasCatch: promiseChains.some(hasCatchHandler),
    hasAsyncTryCatch: awaits.some(a => isInTryCatch(a, ast)),
    hasUnhandledPromises: unhandledLocations.length > 0,
    unhandledLocations,
  };
}
```

### MCP Tool: `drift_error_handling`

```typescript
// Query 1: Error handling for a function
drift_error_handling(target: "processPayment")
// Returns: Has try/catch, what it catches, async handling

// Query 2: Find unhandled error paths
drift_error_handling(action: "unhandled")
// Returns: All paths where errors escape to entry points

// Query 3: Error boundaries
drift_error_handling(action: "boundaries")
// Returns: All error boundaries, their coverage

// Query 4: Error propagation from a function
drift_error_handling(action: "propagation", source: "validateInput")
// Returns: Where errors from this function end up

// Query 5: Async error gaps
drift_error_handling(action: "async-gaps")
// Returns: Unhandled promises, missing .catch()
```

### Quality Scoring

```typescript
function calculateErrorHandlingQuality(profile: ErrorHandlingProfile): number {
  let score = 50; // Base score
  
  // Positive signals
  if (profile.hasTryCatch) score += 15;
  if (profile.catchTypes.some(c => c.errorType !== 'any')) score += 10; // Specific catches
  if (profile.catchTypes.some(c => c.action === 'recover')) score += 10;
  if (profile.asyncHandling.hasAsyncTryCatch) score += 10;
  
  // Negative signals
  if (profile.catchTypes.some(c => c.action === 'swallow')) score -= 20; // Silent swallow
  if (profile.asyncHandling.hasUnhandledPromises) score -= 15;
  if (profile.canThrow && !profile.hasTryCatch && !profile.rethrows) score -= 10;
  
  return Math.max(0, Math.min(100, score));
}
```

---

## Implementation Priority

### Phase 1: Test Topology (Highest ROI)
- Directly answers "what tests to run" - immediate CI/CD value
- Builds on existing call graph infrastructure
- Mock analysis is unique differentiator

### Phase 2: Module Coupling
- Classic software metrics with modern tooling
- Cycle detection is high-value for large codebases
- Enables "refactor safety" queries

### Phase 3: Error Handling Coverage
- More complex extraction (needs AST analysis per language)
- High value for production reliability
- Async error detection is particularly valuable

---

## Storage Schema

All three layers integrate with existing lake architecture:

```
.drift/lake/
├── test-topology/
│   ├── coverage-map.json      # file → tests mapping
│   ├── test-targets.json      # test → what it tests
│   ├── mock-analysis.json     # mock profiles
│   └── uncovered.json         # uncovered functions
├── coupling/
│   ├── module-graph.json      # full dependency graph
│   ├── cycles.json            # detected cycles
│   └── metrics.json           # coupling metrics
└── error-handling/
    ├── profiles.json          # per-function error handling
    ├── boundaries.json        # error boundaries
    ├── propagation.json       # error chains
    └── async-gaps.json        # unhandled async errors
```

---

## Success Metrics

| Layer | Metric | Target |
|-------|--------|--------|
| Test Topology | Test selection accuracy | >95% (no missed failures) |
| Test Topology | Test reduction | >50% fewer tests run |
| Module Coupling | Cycle detection | 100% of cycles found |
| Module Coupling | Refactor impact accuracy | >90% |
| Error Handling | Unhandled path detection | >90% recall |
| Error Handling | False positive rate | <10% |


---

## Full Implementation Specification

### File Structure

```
packages/core/src/
├── test-topology/
│   ├── index.ts                    # Public exports
│   ├── types.ts                    # All type definitions
│   ├── test-topology-analyzer.ts   # Main analyzer class
│   ├── extractors/
│   │   ├── base-test-extractor.ts
│   │   ├── typescript-test-extractor.ts
│   │   ├── python-test-extractor.ts
│   │   ├── java-test-extractor.ts
│   │   ├── csharp-test-extractor.ts
│   │   └── php-test-extractor.ts
│   ├── mock-analyzer.ts            # Mock detection
│   ├── coverage-mapper.ts          # Test→code mapping
│   └── __tests__/
│       └── test-topology.test.ts
├── coupling/
│   ├── index.ts
│   ├── types.ts
│   ├── module-coupling-analyzer.ts
│   ├── extractors/
│   │   ├── base-import-extractor.ts
│   │   ├── typescript-import-extractor.ts
│   │   ├── python-import-extractor.ts
│   │   ├── java-import-extractor.ts
│   │   ├── csharp-import-extractor.ts
│   │   └── php-import-extractor.ts
│   ├── cycle-detector.ts           # Tarjan's SCC
│   ├── metrics-calculator.ts       # Ca, Ce, I, A, D
│   └── __tests__/
│       └── coupling.test.ts
├── error-handling/
│   ├── index.ts
│   ├── types.ts
│   ├── error-handling-analyzer.ts
│   ├── extractors/
│   │   ├── base-error-extractor.ts
│   │   ├── typescript-error-extractor.ts
│   │   ├── python-error-extractor.ts
│   │   ├── java-error-extractor.ts
│   │   ├── csharp-error-extractor.ts
│   │   └── php-error-extractor.ts
│   ├── propagation-tracer.ts       # Error flow analysis
│   ├── async-gap-detector.ts       # Unhandled promises
│   └── __tests__/
│       └── error-handling.test.ts

packages/cli/src/commands/
├── test-topology.ts
├── coupling.ts
└── error-handling.ts

packages/mcp/src/tools/
├── analysis/
│   ├── test-topology.ts
│   ├── coupling.ts
│   └── error-handling.ts
```

---

## Language-Specific Extractors

### L5: Test Topology Extractors

#### TypeScript/JavaScript Test Extractor

```typescript
// packages/core/src/test-topology/extractors/typescript-test-extractor.ts

import type { SyntaxNode } from 'tree-sitter';
import type { TestExtraction, MockStatement, TestCase } from '../types.js';

/**
 * Test framework detection patterns
 */
const TEST_FRAMEWORKS = {
  jest: {
    imports: ['jest', '@jest/globals'],
    testFns: ['test', 'it', 'describe', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll'],
    mockFns: ['jest.mock', 'jest.spyOn', 'jest.fn'],
  },
  vitest: {
    imports: ['vitest'],
    testFns: ['test', 'it', 'describe', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll'],
    mockFns: ['vi.mock', 'vi.spyOn', 'vi.fn'],
  },
  mocha: {
    imports: ['mocha', 'chai'],
    testFns: ['describe', 'it', 'before', 'after', 'beforeEach', 'afterEach'],
    mockFns: ['sinon.stub', 'sinon.mock', 'sinon.spy'],
  },
};

/**
 * Tree-sitter queries for TypeScript test extraction
 */
const TS_TEST_QUERIES = {
  // Find test/it/describe calls
  testCalls: `
    (call_expression
      function: (identifier) @fn_name
      (#match? @fn_name "^(test|it|describe)$")
      arguments: (arguments
        (string) @test_name
        (arrow_function) @test_body
      )
    ) @test_call
  `,
  
  // Find jest.mock() calls
  jestMock: `
    (call_expression
      function: (member_expression
        object: (identifier) @obj (#eq? @obj "jest")
        property: (property_identifier) @prop (#eq? @prop "mock")
      )
      arguments: (arguments
        (string) @mock_target
      )
    ) @mock_call
  `,
  
  // Find vi.mock() calls (vitest)
  vitestMock: `
    (call_expression
      function: (member_expression
        object: (identifier) @obj (#eq? @obj "vi")
        property: (property_identifier) @prop (#eq? @prop "mock")
      )
      arguments: (arguments
        (string) @mock_target
      )
    ) @mock_call
  `,
  
  // Find jest.spyOn() calls
  spyOn: `
    (call_expression
      function: (member_expression
        object: (identifier) @obj (#match? @obj "^(jest|vi)$")
        property: (property_identifier) @prop (#eq? @prop "spyOn")
      )
      arguments: (arguments
        (identifier) @spy_target
        (string) @spy_method
      )
    ) @spy_call
  `,
  
  // Find function calls within test body (what's being tested)
  functionCalls: `
    (call_expression
      function: [
        (identifier) @fn_name
        (member_expression
          property: (property_identifier) @method_name
        )
      ]
    ) @call
  `,
  
  // Find assertions
  assertions: `
    (call_expression
      function: (member_expression
        object: (call_expression
          function: (identifier) @expect (#eq? @expect "expect")
        )
        property: (property_identifier) @matcher
      )
    ) @assertion
  `,
};

export class TypeScriptTestExtractor {
  private parser: Parser;
  
  constructor(parser: Parser) {
    this.parser = parser;
  }
  
  extract(content: string, filePath: string): TestExtraction {
    const tree = this.parser.parse(content);
    const root = tree.rootNode;
    
    // Detect framework
    const framework = this.detectFramework(root);
    
    // Extract test cases
    const testCases = this.extractTestCases(root);
    
    // Extract mocks
    const mocks = this.extractMocks(root, framework);
    
    // Extract setup blocks
    const setupBlocks = this.extractSetupBlocks(root);
    
    // For each test, find what functions it calls
    for (const test of testCases) {
      test.directCalls = this.extractFunctionCalls(test.bodyNode);
      test.assertions = this.extractAssertions(test.bodyNode);
    }
    
    return {
      file: filePath,
      framework,
      testCases,
      mocks,
      setupBlocks,
      language: 'typescript',
    };
  }
  
  private detectFramework(root: SyntaxNode): string {
    const imports = this.findImports(root);
    
    for (const [framework, config] of Object.entries(TEST_FRAMEWORKS)) {
      if (config.imports.some(imp => imports.includes(imp))) {
        return framework;
      }
    }
    
    // Fallback: check for global test functions
    if (this.hasGlobalTestFunctions(root)) {
      return 'jest'; // Default assumption
    }
    
    return 'unknown';
  }
  
  private extractMocks(root: SyntaxNode, framework: string): MockStatement[] {
    const mocks: MockStatement[] = [];
    
    // Query based on framework
    const query = framework === 'vitest' 
      ? TS_TEST_QUERIES.vitestMock 
      : TS_TEST_QUERIES.jestMock;
    
    const matches = this.runQuery(root, query);
    
    for (const match of matches) {
      const target = match.captures.find(c => c.name === 'mock_target')?.node.text;
      if (target) {
        mocks.push({
          target: target.replace(/['"]/g, ''),
          mockType: framework === 'vitest' ? 'vi.mock' : 'jest.mock',
          line: match.captures[0]?.node.startPosition.row ?? 0,
          isExternal: this.isExternalModule(target),
        });
      }
    }
    
    // Also extract spyOn calls
    const spyMatches = this.runQuery(root, TS_TEST_QUERIES.spyOn);
    for (const match of spyMatches) {
      const target = match.captures.find(c => c.name === 'spy_target')?.node.text;
      const method = match.captures.find(c => c.name === 'spy_method')?.node.text;
      if (target && method) {
        mocks.push({
          target: `${target}.${method.replace(/['"]/g, '')}`,
          mockType: 'spyOn',
          line: match.captures[0]?.node.startPosition.row ?? 0,
          isExternal: false,
        });
      }
    }
    
    return mocks;
  }
  
  private isExternalModule(modulePath: string): boolean {
    // External if doesn't start with . or /
    const cleaned = modulePath.replace(/['"]/g, '');
    return !cleaned.startsWith('.') && !cleaned.startsWith('/');
  }
  
  private extractAssertions(bodyNode: SyntaxNode): AssertionInfo[] {
    const assertions: AssertionInfo[] = [];
    const matches = this.runQuery(bodyNode, TS_TEST_QUERIES.assertions);
    
    for (const match of matches) {
      const matcher = match.captures.find(c => c.name === 'matcher')?.node.text;
      assertions.push({
        matcher: matcher ?? 'unknown',
        line: match.captures[0]?.node.startPosition.row ?? 0,
        isErrorAssertion: ['toThrow', 'toThrowError', 'rejects'].includes(matcher ?? ''),
        isEdgeCaseAssertion: ['toBeNull', 'toBeUndefined', 'toBeFalsy', 'toHaveLength'].includes(matcher ?? ''),
      });
    }
    
    return assertions;
  }
}
```

#### Python Test Extractor

```typescript
// packages/core/src/test-topology/extractors/python-test-extractor.ts

const PYTHON_TEST_FRAMEWORKS = {
  pytest: {
    imports: ['pytest'],
    testPatterns: [/^test_/, /_test$/],
    fixtureDecorator: '@pytest.fixture',
    mockPatterns: ['@patch', '@mock.patch', 'mocker.patch', 'MagicMock'],
  },
  unittest: {
    imports: ['unittest'],
    testPatterns: [/^test_/],
    classPattern: /class\s+\w*Test\w*\(.*TestCase\)/,
    mockPatterns: ['@patch', 'Mock()', 'MagicMock()'],
  },
};

const PYTHON_TEST_QUERIES = {
  // Find test functions
  testFunctions: `
    (function_definition
      name: (identifier) @fn_name
      (#match? @fn_name "^test_")
    ) @test_fn
  `,
  
  // Find pytest fixtures
  fixtures: `
    (decorated_definition
      (decorator
        (call
          function: (attribute
            object: (identifier) @obj (#eq? @obj "pytest")
            attribute: (identifier) @attr (#eq? @attr "fixture")
          )
        )
      )
      definition: (function_definition
        name: (identifier) @fixture_name
      )
    ) @fixture
  `,
  
  // Find @patch decorators
  patchDecorators: `
    (decorated_definition
      (decorator
        (call
          function: (attribute
            attribute: (identifier) @attr (#eq? @attr "patch")
          )
          arguments: (argument_list
            (string) @patch_target
          )
        )
      )
    ) @patch
  `,
  
  // Find mocker.patch() calls (pytest-mock)
  mockerPatch: `
    (call
      function: (attribute
        object: (identifier) @obj (#eq? @obj "mocker")
        attribute: (identifier) @attr (#eq? @attr "patch")
      )
      arguments: (argument_list
        (string) @patch_target
      )
    ) @mocker_patch
  `,
  
  // Find MagicMock/Mock instantiations
  mockInstantiation: `
    (call
      function: (identifier) @fn (#match? @fn "^(Mock|MagicMock)$")
    ) @mock_inst
  `,
  
  // Find assert statements
  assertions: `
    (assert_statement) @assert
  `,
  
  // Find pytest assertions (assert x == y, etc.)
  pytestAssertions: `
    (expression_statement
      (comparison_operator) @comparison
    ) @pytest_assert
  `,
};

export class PythonTestExtractor {
  extract(content: string, filePath: string): TestExtraction {
    const tree = this.parser.parse(content);
    const root = tree.rootNode;
    
    const framework = this.detectFramework(root);
    const testCases = this.extractTestFunctions(root);
    const mocks = this.extractMocks(root);
    const fixtures = this.extractFixtures(root);
    
    return {
      file: filePath,
      framework,
      testCases,
      mocks,
      fixtures,
      language: 'python',
    };
  }
  
  private extractMocks(root: SyntaxNode): MockStatement[] {
    const mocks: MockStatement[] = [];
    
    // @patch decorators
    const patchMatches = this.runQuery(root, PYTHON_TEST_QUERIES.patchDecorators);
    for (const match of patchMatches) {
      const target = match.captures.find(c => c.name === 'patch_target')?.node.text;
      if (target) {
        mocks.push({
          target: target.replace(/['"]/g, ''),
          mockType: '@patch',
          line: match.captures[0]?.node.startPosition.row ?? 0,
          isExternal: this.isExternalPythonModule(target),
        });
      }
    }
    
    // mocker.patch() calls
    const mockerMatches = this.runQuery(root, PYTHON_TEST_QUERIES.mockerPatch);
    for (const match of mockerMatches) {
      const target = match.captures.find(c => c.name === 'patch_target')?.node.text;
      if (target) {
        mocks.push({
          target: target.replace(/['"]/g, ''),
          mockType: 'mocker.patch',
          line: match.captures[0]?.node.startPosition.row ?? 0,
          isExternal: this.isExternalPythonModule(target),
        });
      }
    }
    
    return mocks;
  }
  
  private isExternalPythonModule(modulePath: string): boolean {
    const cleaned = modulePath.replace(/['"]/g, '');
    // External if it's a known stdlib or third-party package
    const externalPrefixes = [
      'os', 'sys', 'json', 'datetime', 'requests', 'urllib',
      'django', 'flask', 'fastapi', 'sqlalchemy', 'celery',
    ];
    return externalPrefixes.some(prefix => cleaned.startsWith(prefix));
  }
}
```

#### Java Test Extractor

```typescript
// packages/core/src/test-topology/extractors/java-test-extractor.ts

const JAVA_TEST_FRAMEWORKS = {
  junit5: {
    imports: ['org.junit.jupiter'],
    annotations: ['@Test', '@BeforeEach', '@AfterEach', '@BeforeAll', '@AfterAll'],
    mockAnnotations: ['@Mock', '@MockBean', '@InjectMocks', '@Spy'],
  },
  junit4: {
    imports: ['org.junit'],
    annotations: ['@Test', '@Before', '@After', '@BeforeClass', '@AfterClass'],
    mockAnnotations: ['@Mock', '@InjectMocks'],
  },
  mockito: {
    imports: ['org.mockito'],
    mockMethods: ['mock(', 'spy(', 'when(', 'verify('],
  },
};

const JAVA_TEST_QUERIES = {
  // Find @Test annotated methods
  testMethods: `
    (method_declaration
      (modifiers
        (marker_annotation
          name: (identifier) @ann (#eq? @ann "Test")
        )
      )
      name: (identifier) @method_name
      body: (block) @method_body
    ) @test_method
  `,
  
  // Find @Mock annotations
  mockAnnotations: `
    (field_declaration
      (modifiers
        (marker_annotation
          name: (identifier) @ann (#match? @ann "^(Mock|MockBean|Spy|InjectMocks)$")
        )
      )
      declarator: (variable_declarator
        name: (identifier) @field_name
        value: (type_identifier) @field_type
      )
    ) @mock_field
  `,
  
  // Find Mockito.mock() calls
  mockitoCalls: `
    (method_invocation
      object: (identifier) @obj (#eq? @obj "Mockito")
      name: (identifier) @method (#match? @method "^(mock|spy|when|verify)$")
      arguments: (argument_list) @args
    ) @mockito_call
  `,
  
  // Find assertions
  assertions: `
    (method_invocation
      name: (identifier) @method (#match? @method "^(assert|assertEquals|assertTrue|assertFalse|assertNull|assertNotNull|assertThrows)$")
    ) @assertion
  `,
};

export class JavaTestExtractor {
  extract(content: string, filePath: string): TestExtraction {
    const tree = this.parser.parse(content);
    const root = tree.rootNode;
    
    const framework = this.detectFramework(root);
    const testCases = this.extractTestMethods(root);
    const mocks = this.extractMocks(root);
    
    return {
      file: filePath,
      framework,
      testCases,
      mocks,
      language: 'java',
    };
  }
  
  private extractMocks(root: SyntaxNode): MockStatement[] {
    const mocks: MockStatement[] = [];
    
    // @Mock annotated fields
    const annotationMatches = this.runQuery(root, JAVA_TEST_QUERIES.mockAnnotations);
    for (const match of annotationMatches) {
      const fieldName = match.captures.find(c => c.name === 'field_name')?.node.text;
      const fieldType = match.captures.find(c => c.name === 'field_type')?.node.text;
      const annotation = match.captures.find(c => c.name === 'ann')?.node.text;
      
      if (fieldName && fieldType) {
        mocks.push({
          target: `${fieldType}.${fieldName}`,
          mockType: `@${annotation}`,
          line: match.captures[0]?.node.startPosition.row ?? 0,
          isExternal: false, // Field mocks are typically internal
        });
      }
    }
    
    // Mockito.mock() calls
    const mockitoMatches = this.runQuery(root, JAVA_TEST_QUERIES.mockitoCalls);
    for (const match of mockitoMatches) {
      const method = match.captures.find(c => c.name === 'method')?.node.text;
      const args = match.captures.find(c => c.name === 'args')?.node.text;
      
      mocks.push({
        target: args?.replace(/[()]/g, '') ?? 'unknown',
        mockType: `Mockito.${method}`,
        line: match.captures[0]?.node.startPosition.row ?? 0,
        isExternal: false,
      });
    }
    
    return mocks;
  }
}
```

#### C# Test Extractor

```typescript
// packages/core/src/test-topology/extractors/csharp-test-extractor.ts

const CSHARP_TEST_FRAMEWORKS = {
  xunit: {
    imports: ['Xunit'],
    attributes: ['[Fact]', '[Theory]', '[InlineData]'],
    mockLibraries: ['Moq', 'NSubstitute'],
  },
  nunit: {
    imports: ['NUnit.Framework'],
    attributes: ['[Test]', '[TestCase]', '[SetUp]', '[TearDown]'],
    mockLibraries: ['Moq', 'NSubstitute'],
  },
  mstest: {
    imports: ['Microsoft.VisualStudio.TestTools.UnitTesting'],
    attributes: ['[TestMethod]', '[TestClass]', '[TestInitialize]'],
    mockLibraries: ['Moq'],
  },
};

const CSHARP_TEST_QUERIES = {
  // Find [Fact] or [Test] attributed methods
  testMethods: `
    (method_declaration
      (attribute_list
        (attribute
          name: (identifier) @attr (#match? @attr "^(Fact|Test|TestMethod|Theory)$")
        )
      )
      name: (identifier) @method_name
      body: (block) @method_body
    ) @test_method
  `,
  
  // Find Mock<T> instantiations (Moq)
  moqMocks: `
    (object_creation_expression
      type: (generic_name
        (identifier) @type (#eq? @type "Mock")
        (type_argument_list
          (type_argument (identifier) @mocked_type)
        )
      )
    ) @mock_creation
  `,
  
  // Find Substitute.For<T>() (NSubstitute)
  nsubstituteMocks: `
    (invocation_expression
      function: (member_access_expression
        expression: (identifier) @obj (#eq? @obj "Substitute")
        name: (generic_name
          (identifier) @method (#eq? @method "For")
        )
      )
    ) @substitute_call
  `,
  
  // Find Assert calls
  assertions: `
    (invocation_expression
      function: (member_access_expression
        expression: (identifier) @obj (#eq? @obj "Assert")
        name: (identifier) @method
      )
    ) @assertion
  `,
};

export class CSharpTestExtractor {
  extract(content: string, filePath: string): TestExtraction {
    const tree = this.parser.parse(content);
    const root = tree.rootNode;
    
    const framework = this.detectFramework(root);
    const testCases = this.extractTestMethods(root);
    const mocks = this.extractMocks(root);
    
    return {
      file: filePath,
      framework,
      testCases,
      mocks,
      language: 'csharp',
    };
  }
  
  private extractMocks(root: SyntaxNode): MockStatement[] {
    const mocks: MockStatement[] = [];
    
    // Moq: new Mock<IService>()
    const moqMatches = this.runQuery(root, CSHARP_TEST_QUERIES.moqMocks);
    for (const match of moqMatches) {
      const mockedType = match.captures.find(c => c.name === 'mocked_type')?.node.text;
      if (mockedType) {
        mocks.push({
          target: mockedType,
          mockType: 'Moq.Mock<T>',
          line: match.captures[0]?.node.startPosition.row ?? 0,
          isExternal: mockedType.startsWith('I'), // Interfaces are typically abstractions
        });
      }
    }
    
    // NSubstitute: Substitute.For<IService>()
    const nsubMatches = this.runQuery(root, CSHARP_TEST_QUERIES.nsubstituteMocks);
    for (const match of nsubMatches) {
      mocks.push({
        target: 'unknown', // Would need deeper parsing
        mockType: 'NSubstitute.For<T>',
        line: match.captures[0]?.node.startPosition.row ?? 0,
        isExternal: true,
      });
    }
    
    return mocks;
  }
}
```

#### PHP Test Extractor

```typescript
// packages/core/src/test-topology/extractors/php-test-extractor.ts

const PHP_TEST_FRAMEWORKS = {
  phpunit: {
    imports: ['PHPUnit\\Framework\\TestCase'],
    classPattern: /extends\s+TestCase/,
    testPrefix: 'test',
    annotations: ['@test', '@dataProvider'],
    mockMethods: ['createMock', 'getMockBuilder', 'prophesize'],
  },
  pest: {
    functions: ['test', 'it', 'describe', 'beforeEach', 'afterEach'],
    mockMethods: ['mock', 'spy'],
  },
};

const PHP_TEST_QUERIES = {
  // Find test methods (PHPUnit)
  testMethods: `
    (method_declaration
      (visibility_modifier) @visibility
      name: (name) @method_name (#match? @method_name "^test")
      body: (compound_statement) @method_body
    ) @test_method
  `,
  
  // Find test() function calls (Pest)
  pestTests: `
    (function_call_expression
      function: (name) @fn (#match? @fn "^(test|it)$")
      arguments: (arguments
        (argument (string) @test_name)
        (argument (anonymous_function_creation_expression) @test_body)
      )
    ) @pest_test
  `,
  
  // Find createMock() calls
  createMock: `
    (member_call_expression
      object: (variable_name) @obj (#eq? @obj "$this")
      name: (name) @method (#eq? @method "createMock")
      arguments: (arguments
        (argument (class_constant_access_expression
          class: (name) @mocked_class
        ))
      )
    ) @create_mock
  `,
  
  // Find Mockery::mock() calls
  mockeryMock: `
    (scoped_call_expression
      scope: (name) @scope (#eq? @scope "Mockery")
      name: (name) @method (#eq? @method "mock")
      arguments: (arguments) @args
    ) @mockery_mock
  `,
  
  // Find assertions
  assertions: `
    (member_call_expression
      object: (variable_name) @obj (#eq? @obj "$this")
      name: (name) @method (#match? @method "^assert")
    ) @assertion
  `,
};

export class PHPTestExtractor {
  extract(content: string, filePath: string): TestExtraction {
    const tree = this.parser.parse(content);
    const root = tree.rootNode;
    
    const framework = this.detectFramework(root, content);
    const testCases = framework === 'pest' 
      ? this.extractPestTests(root)
      : this.extractPHPUnitTests(root);
    const mocks = this.extractMocks(root);
    
    return {
      file: filePath,
      framework,
      testCases,
      mocks,
      language: 'php',
    };
  }
}
```


---

## L6: Module Coupling - Language-Specific Import Extractors

### TypeScript Import Extractor

```typescript
// packages/core/src/coupling/extractors/typescript-import-extractor.ts

const TS_IMPORT_QUERIES = {
  // Named imports: import { foo, bar } from 'module'
  namedImports: `
    (import_statement
      (import_clause
        (named_imports
          (import_specifier
            name: (identifier) @imported_name
            alias: (identifier)? @alias
          )
        )
      )
      source: (string) @source
    ) @import
  `,
  
  // Default imports: import foo from 'module'
  defaultImports: `
    (import_statement
      (import_clause
        (identifier) @default_name
      )
      source: (string) @source
    ) @import
  `,
  
  // Namespace imports: import * as foo from 'module'
  namespaceImports: `
    (import_statement
      (import_clause
        (namespace_import
          (identifier) @namespace_name
        )
      )
      source: (string) @source
    ) @import
  `,
  
  // Dynamic imports: import('module')
  dynamicImports: `
    (call_expression
      function: (import)
      arguments: (arguments
        (string) @source
      )
    ) @dynamic_import
  `,
  
  // Re-exports: export { foo } from 'module'
  reExports: `
    (export_statement
      (export_clause)
      source: (string) @source
    ) @reexport
  `,
  
  // Type-only imports: import type { Foo } from 'module'
  typeImports: `
    (import_statement
      "type"
      source: (string) @source
    ) @type_import
  `,
};

export class TypeScriptImportExtractor {
  extract(content: string, filePath: string): ImportGraph {
    const tree = this.parser.parse(content);
    const root = tree.rootNode;
    
    const imports: EnhancedImport[] = [];
    
    // Extract all import types
    for (const [queryName, query] of Object.entries(TS_IMPORT_QUERIES)) {
      const matches = this.runQuery(root, query);
      
      for (const match of matches) {
        const source = match.captures.find(c => c.name === 'source')?.node.text;
        if (!source) continue;
        
        const cleanSource = source.replace(/['"]/g, '');
        const resolvedPath = this.resolveImportPath(cleanSource, filePath);
        
        imports.push({
          source: cleanSource,
          resolvedPath,
          isExternal: this.isExternalModule(cleanSource),
          isTypeOnly: queryName === 'typeImports',
          isDynamic: queryName === 'dynamicImports',
          symbols: this.extractImportedSymbols(match),
          line: match.captures[0]?.node.startPosition.row ?? 0,
          weight: this.calculateImportWeight(match),
        });
      }
    }
    
    // Extract exports for unused export detection
    const exports = this.extractExports(root);
    
    return {
      file: filePath,
      imports,
      exports,
      language: 'typescript',
    };
  }
  
  private resolveImportPath(source: string, fromFile: string): string {
    if (this.isExternalModule(source)) {
      return `node_modules/${source}`;
    }
    
    // Resolve relative paths
    const fromDir = path.dirname(fromFile);
    let resolved = path.resolve(fromDir, source);
    
    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
    for (const ext of extensions) {
      if (fs.existsSync(resolved + ext)) {
        return resolved + ext;
      }
    }
    
    return resolved;
  }
  
  private isExternalModule(source: string): boolean {
    return !source.startsWith('.') && !source.startsWith('/') && !source.startsWith('@/');
  }
  
  private calculateImportWeight(match: QueryMatch): number {
    // More symbols imported = tighter coupling
    const symbols = this.extractImportedSymbols(match);
    
    // Namespace import (*) = high coupling
    if (match.captures.some(c => c.name === 'namespace_name')) {
      return 10;
    }
    
    // Weight based on number of symbols
    return Math.min(10, symbols.length);
  }
}
```

### Python Import Extractor

```typescript
// packages/core/src/coupling/extractors/python-import-extractor.ts

const PYTHON_IMPORT_QUERIES = {
  // import module
  simpleImport: `
    (import_statement
      name: (dotted_name) @module
    ) @import
  `,
  
  // from module import name
  fromImport: `
    (import_from_statement
      module_name: (dotted_name) @module
      name: [
        (dotted_name) @imported_name
        (aliased_import
          name: (dotted_name) @imported_name
          alias: (identifier) @alias
        )
      ]
    ) @from_import
  `,
  
  // from module import *
  wildcardImport: `
    (import_from_statement
      module_name: (dotted_name) @module
      (wildcard_import)
    ) @wildcard_import
  `,
  
  // Relative imports: from . import foo, from .. import bar
  relativeImport: `
    (import_from_statement
      module_name: (relative_import
        (import_prefix) @prefix
        (dotted_name)? @module
      )
    ) @relative_import
  `,
};

export class PythonImportExtractor {
  extract(content: string, filePath: string): ImportGraph {
    const tree = this.parser.parse(content);
    const root = tree.rootNode;
    
    const imports: EnhancedImport[] = [];
    
    // Simple imports
    const simpleMatches = this.runQuery(root, PYTHON_IMPORT_QUERIES.simpleImport);
    for (const match of simpleMatches) {
      const module = match.captures.find(c => c.name === 'module')?.node.text;
      if (module) {
        imports.push({
          source: module,
          resolvedPath: this.resolvePythonImport(module, filePath),
          isExternal: this.isExternalPythonModule(module),
          symbols: [module.split('.').pop() ?? module],
          line: match.captures[0]?.node.startPosition.row ?? 0,
          weight: 1,
        });
      }
    }
    
    // From imports
    const fromMatches = this.runQuery(root, PYTHON_IMPORT_QUERIES.fromImport);
    for (const match of fromMatches) {
      const module = match.captures.find(c => c.name === 'module')?.node.text;
      const importedNames = match.captures
        .filter(c => c.name === 'imported_name')
        .map(c => c.node.text);
      
      if (module) {
        imports.push({
          source: module,
          resolvedPath: this.resolvePythonImport(module, filePath),
          isExternal: this.isExternalPythonModule(module),
          symbols: importedNames,
          line: match.captures[0]?.node.startPosition.row ?? 0,
          weight: importedNames.length,
        });
      }
    }
    
    // Wildcard imports (high coupling!)
    const wildcardMatches = this.runQuery(root, PYTHON_IMPORT_QUERIES.wildcardImport);
    for (const match of wildcardMatches) {
      const module = match.captures.find(c => c.name === 'module')?.node.text;
      if (module) {
        imports.push({
          source: module,
          resolvedPath: this.resolvePythonImport(module, filePath),
          isExternal: this.isExternalPythonModule(module),
          symbols: ['*'],
          line: match.captures[0]?.node.startPosition.row ?? 0,
          weight: 10, // High weight for wildcard
          isWildcard: true,
        });
      }
    }
    
    return {
      file: filePath,
      imports,
      exports: this.extractExports(root),
      language: 'python',
    };
  }
  
  private isExternalPythonModule(module: string): boolean {
    const stdlib = [
      'os', 'sys', 'json', 'datetime', 'collections', 'itertools',
      'functools', 'typing', 'pathlib', 'logging', 're', 'math',
    ];
    const firstPart = module.split('.')[0] ?? '';
    return stdlib.includes(firstPart) || !module.startsWith('.');
  }
}
```

### Java Import Extractor

```typescript
// packages/core/src/coupling/extractors/java-import-extractor.ts

const JAVA_IMPORT_QUERIES = {
  // import com.example.Class;
  singleImport: `
    (import_declaration
      (scoped_identifier) @import_path
    ) @import
  `,
  
  // import com.example.*;
  wildcardImport: `
    (import_declaration
      (scoped_identifier) @import_path
      (asterisk)
    ) @wildcard_import
  `,
  
  // import static com.example.Class.method;
  staticImport: `
    (import_declaration
      "static"
      (scoped_identifier) @import_path
    ) @static_import
  `,
};

export class JavaImportExtractor {
  extract(content: string, filePath: string): ImportGraph {
    const tree = this.parser.parse(content);
    const root = tree.rootNode;
    
    const imports: EnhancedImport[] = [];
    const packageName = this.extractPackageName(root);
    
    // Single imports
    const singleMatches = this.runQuery(root, JAVA_IMPORT_QUERIES.singleImport);
    for (const match of singleMatches) {
      const importPath = match.captures.find(c => c.name === 'import_path')?.node.text;
      if (importPath) {
        imports.push({
          source: importPath,
          resolvedPath: this.resolveJavaImport(importPath),
          isExternal: this.isExternalJavaPackage(importPath, packageName),
          symbols: [importPath.split('.').pop() ?? importPath],
          line: match.captures[0]?.node.startPosition.row ?? 0,
          weight: 1,
        });
      }
    }
    
    // Wildcard imports
    const wildcardMatches = this.runQuery(root, JAVA_IMPORT_QUERIES.wildcardImport);
    for (const match of wildcardMatches) {
      const importPath = match.captures.find(c => c.name === 'import_path')?.node.text;
      if (importPath) {
        imports.push({
          source: importPath + '.*',
          resolvedPath: this.resolveJavaImport(importPath),
          isExternal: this.isExternalJavaPackage(importPath, packageName),
          symbols: ['*'],
          line: match.captures[0]?.node.startPosition.row ?? 0,
          weight: 10,
          isWildcard: true,
        });
      }
    }
    
    return {
      file: filePath,
      imports,
      exports: [], // Java exports are implicit (public classes)
      language: 'java',
    };
  }
  
  private isExternalJavaPackage(importPath: string, currentPackage: string): boolean {
    // External if different root package
    const importRoot = importPath.split('.')[0];
    const currentRoot = currentPackage.split('.')[0];
    
    // Also external if it's a known library
    const externalPrefixes = ['java.', 'javax.', 'org.', 'com.google.', 'org.apache.'];
    return importRoot !== currentRoot || externalPrefixes.some(p => importPath.startsWith(p));
  }
}
```

---

## L7: Error Handling - Language-Specific Extractors

### TypeScript Error Extractor

```typescript
// packages/core/src/error-handling/extractors/typescript-error-extractor.ts

const TS_ERROR_QUERIES = {
  // try { } catch (e) { }
  tryCatch: `
    (try_statement
      body: (statement_block) @try_body
      (catch_clause
        parameter: (identifier)? @error_var
        body: (statement_block) @catch_body
      )?
      (finally_clause
        body: (statement_block) @finally_body
      )?
    ) @try_statement
  `,
  
  // throw new Error()
  throwStatement: `
    (throw_statement
      (new_expression
        constructor: (identifier) @error_type
      )?
    ) @throw
  `,
  
  // promise.catch()
  promiseCatch: `
    (call_expression
      function: (member_expression
        property: (property_identifier) @method (#eq? @method "catch")
      )
      arguments: (arguments) @catch_handler
    ) @promise_catch
  `,
  
  // await without try/catch
  awaitExpression: `
    (await_expression) @await
  `,
  
  // .then().catch() chains
  thenCatch: `
    (call_expression
      function: (member_expression
        object: (call_expression
          function: (member_expression
            property: (property_identifier) @then (#eq? @then "then")
          )
        )
        property: (property_identifier) @catch (#eq? @catch "catch")
      )
    ) @then_catch
  `,
};

export class TypeScriptErrorExtractor {
  extract(content: string, filePath: string): ErrorHandlingProfile[] {
    const tree = this.parser.parse(content);
    const root = tree.rootNode;
    
    const profiles: ErrorHandlingProfile[] = [];
    const functions = this.extractFunctions(root);
    
    for (const func of functions) {
      const profile = this.analyzeFunction(func, root);
      profiles.push(profile);
    }
    
    return profiles;
  }
  
  private analyzeFunction(func: FunctionNode, root: SyntaxNode): ErrorHandlingProfile {
    const funcBody = func.bodyNode;
    
    // Find try/catch blocks
    const tryCatches = this.runQuery(funcBody, TS_ERROR_QUERIES.tryCatch);
    const catchClauses = this.analyzeCatchClauses(tryCatches);
    
    // Find throw statements
    const throws = this.runQuery(funcBody, TS_ERROR_QUERIES.throwStatement);
    const canThrow = throws.length > 0;
    
    // Analyze async error handling
    const asyncHandling = this.analyzeAsyncErrors(funcBody, func.isAsync);
    
    // Check for rethrows
    const rethrows = catchClauses.some(c => c.action === 'rethrow');
    
    return {
      functionId: func.id,
      file: func.file,
      name: func.name,
      hasTryCatch: tryCatches.length > 0,
      canThrow,
      catchTypes: catchClauses,
      rethrows,
      asyncHandling,
      qualityScore: this.calculateQualityScore({
        hasTryCatch: tryCatches.length > 0,
        catchClauses,
        asyncHandling,
        canThrow,
        rethrows,
      }),
    };
  }
  
  private analyzeCatchClauses(tryCatches: QueryMatch[]): CatchClause[] {
    const clauses: CatchClause[] = [];
    
    for (const match of tryCatches) {
      const catchBody = match.captures.find(c => c.name === 'catch_body')?.node;
      const errorVar = match.captures.find(c => c.name === 'error_var')?.node.text;
      
      if (!catchBody) continue;
      
      // Determine what happens in the catch block
      const action = this.determineCatchAction(catchBody, errorVar);
      const errorType = this.inferErrorType(catchBody, errorVar);
      
      clauses.push({
        errorType,
        action,
        line: match.captures[0]?.node.startPosition.row ?? 0,
      });
    }
    
    return clauses;
  }
  
  private determineCatchAction(catchBody: SyntaxNode, errorVar?: string): CatchClause['action'] {
    const bodyText = catchBody.text;
    
    // Check for rethrow
    if (bodyText.includes('throw')) {
      return 'rethrow';
    }
    
    // Check for logging only
    const hasLogging = /console\.(log|error|warn)|logger\.|log\(/.test(bodyText);
    const hasOtherStatements = catchBody.namedChildCount > 1;
    
    if (hasLogging && !hasOtherStatements) {
      return 'log';
    }
    
    // Check for empty catch (swallow)
    if (catchBody.namedChildCount === 0 || bodyText.trim() === '{}') {
      return 'swallow';
    }
    
    // Check for error transformation
    if (bodyText.includes('new ') && bodyText.includes('Error')) {
      return 'transform';
    }
    
    return 'recover';
  }
  
  private analyzeAsyncErrors(funcBody: SyntaxNode, isAsync: boolean): AsyncErrorHandling {
    if (!isAsync) {
      return {
        hasCatch: false,
        hasAsyncTryCatch: false,
        hasUnhandledPromises: false,
        unhandledLocations: [],
      };
    }
    
    const awaits = this.runQuery(funcBody, TS_ERROR_QUERIES.awaitExpression);
    const promiseCatches = this.runQuery(funcBody, TS_ERROR_QUERIES.promiseCatch);
    const tryCatches = this.runQuery(funcBody, TS_ERROR_QUERIES.tryCatch);
    
    const unhandledLocations: { line: number; expression: string }[] = [];
    
    // Check each await
    for (const awaitMatch of awaits) {
      const awaitNode = awaitMatch.captures[0]?.node;
      if (!awaitNode) continue;
      
      // Check if this await is inside a try block
      const isInTry = this.isNodeInsideTry(awaitNode, tryCatches);
      
      if (!isInTry) {
        unhandledLocations.push({
          line: awaitNode.startPosition.row,
          expression: awaitNode.text.substring(0, 50),
        });
      }
    }
    
    return {
      hasCatch: promiseCatches.length > 0,
      hasAsyncTryCatch: tryCatches.length > 0 && awaits.length > 0,
      hasUnhandledPromises: unhandledLocations.length > 0,
      unhandledLocations,
    };
  }
  
  private isNodeInsideTry(node: SyntaxNode, tryCatches: QueryMatch[]): boolean {
    for (const tryMatch of tryCatches) {
      const tryBody = tryMatch.captures.find(c => c.name === 'try_body')?.node;
      if (!tryBody) continue;
      
      // Check if node is a descendant of try body
      if (this.isDescendant(node, tryBody)) {
        return true;
      }
    }
    return false;
  }
}
```

### Python Error Extractor

```typescript
// packages/core/src/error-handling/extractors/python-error-extractor.ts

const PYTHON_ERROR_QUERIES = {
  // try: ... except: ...
  tryExcept: `
    (try_statement
      body: (block) @try_body
      (except_clause
        (identifier)? @exception_type
        (identifier)? @exception_var
        (block) @except_body
      )*
      (finally_clause
        (block) @finally_body
      )?
    ) @try_statement
  `,
  
  // raise Exception()
  raiseStatement: `
    (raise_statement
      (call
        function: (identifier) @exception_type
      )?
    ) @raise
  `,
  
  // raise ... from ...
  raiseFrom: `
    (raise_statement
      cause: (expression) @cause
    ) @raise_from
  `,
  
  // async with / async for without try
  asyncWith: `
    (with_statement
      "async"
    ) @async_with
  `,
};

export class PythonErrorExtractor {
  extract(content: string, filePath: string): ErrorHandlingProfile[] {
    const tree = this.parser.parse(content);
    const root = tree.rootNode;
    
    const profiles: ErrorHandlingProfile[] = [];
    const functions = this.extractFunctions(root);
    
    for (const func of functions) {
      const profile = this.analyzeFunction(func);
      profiles.push(profile);
    }
    
    return profiles;
  }
  
  private analyzeFunction(func: FunctionNode): ErrorHandlingProfile {
    const funcBody = func.bodyNode;
    
    // Find try/except blocks
    const tryExcepts = this.runQuery(funcBody, PYTHON_ERROR_QUERIES.tryExcept);
    const catchClauses = this.analyzeExceptClauses(tryExcepts);
    
    // Find raise statements
    const raises = this.runQuery(funcBody, PYTHON_ERROR_QUERIES.raiseStatement);
    const canThrow = raises.length > 0;
    
    // Check for bare except (bad practice)
    const hasBareExcept = catchClauses.some(c => c.errorType === 'any');
    
    return {
      functionId: func.id,
      file: func.file,
      name: func.name,
      hasTryCatch: tryExcepts.length > 0,
      canThrow,
      catchTypes: catchClauses,
      rethrows: catchClauses.some(c => c.action === 'rethrow'),
      asyncHandling: this.analyzeAsyncErrors(funcBody, func.isAsync),
      qualityScore: this.calculateQualityScore({
        hasTryCatch: tryExcepts.length > 0,
        catchClauses,
        hasBareExcept,
        canThrow,
      }),
    };
  }
  
  private analyzeExceptClauses(tryExcepts: QueryMatch[]): CatchClause[] {
    const clauses: CatchClause[] = [];
    
    for (const match of tryExcepts) {
      const exceptBody = match.captures.find(c => c.name === 'except_body')?.node;
      const exceptionType = match.captures.find(c => c.name === 'exception_type')?.node.text;
      
      if (!exceptBody) continue;
      
      const action = this.determineExceptAction(exceptBody);
      
      clauses.push({
        errorType: exceptionType ?? 'any', // bare except
        action,
        line: match.captures[0]?.node.startPosition.row ?? 0,
      });
    }
    
    return clauses;
  }
  
  private determineExceptAction(exceptBody: SyntaxNode): CatchClause['action'] {
    const bodyText = exceptBody.text;
    
    // Check for re-raise
    if (/^\s*raise\s*$/.test(bodyText) || bodyText.includes('raise ')) {
      return 'rethrow';
    }
    
    // Check for pass (swallow)
    if (/^\s*pass\s*$/.test(bodyText.trim())) {
      return 'swallow';
    }
    
    // Check for logging only
    if (/logger\.|logging\.|print\(/.test(bodyText) && exceptBody.namedChildCount <= 2) {
      return 'log';
    }
    
    return 'recover';
  }
}
```


---

## CLI Commands

### Test Topology CLI

```typescript
// packages/cli/src/commands/test-topology.ts

import { Command } from 'commander';
import { createTestTopologyAnalyzer } from 'driftdetect-core';
import { formatTable, formatJson, spinner } from '../utils/output.js';

export function registerTestTopologyCommand(program: Command): void {
  const cmd = program
    .command('test-topology')
    .description('Analyze test-to-code mapping and test quality')
    .option('-t, --target <file>', 'Show tests covering a specific file')
    .option('-c, --changed <files...>', 'Find minimum test set for changed files')
    .option('--uncovered', 'Show functions with no test coverage')
    .option('--mock-analysis', 'Analyze mock usage patterns')
    .option('--min-risk <level>', 'Minimum risk level for uncovered (low|medium|high)', 'low')
    .option('--format <format>', 'Output format (table|json)', 'table')
    .option('--limit <n>', 'Limit results', '20')
    .action(async (options) => {
      const spin = spinner('Analyzing test topology...');
      
      try {
        const analyzer = createTestTopologyAnalyzer({ rootDir: process.cwd() });
        await analyzer.initialize();
        
        if (options.target) {
          // Show tests covering a specific file
          const coverage = await analyzer.getTestsForFile(options.target);
          spin.stop();
          
          console.log(`\nTests covering ${options.target}:\n`);
          
          if (options.format === 'json') {
            console.log(formatJson(coverage));
          } else {
            formatTable(coverage.tests, [
              { key: 'testFile', header: 'Test File' },
              { key: 'testName', header: 'Test Name' },
              { key: 'reachType', header: 'Reach Type' },
              { key: 'depth', header: 'Depth' },
              { key: 'confidence', header: 'Confidence' },
            ]);
          }
          
        } else if (options.changed) {
          // Find minimum test set
          const testSet = await analyzer.getMinimumTestSet(options.changed);
          spin.stop();
          
          console.log(`\nMinimum test set for ${options.changed.length} changed file(s):\n`);
          console.log(`Total tests to run: ${testSet.tests.length}`);
          console.log(`Estimated time saved: ${testSet.timeSaved}\n`);
          
          for (const test of testSet.tests) {
            console.log(`  ${test.file}::${test.name}`);
          }
          
        } else if (options.uncovered) {
          // Show uncovered functions
          const uncovered = await analyzer.getUncoveredFunctions({
            minRisk: options.minRisk,
            limit: parseInt(options.limit),
          });
          spin.stop();
          
          console.log(`\nFunctions with no test coverage:\n`);
          
          formatTable(uncovered, [
            { key: 'name', header: 'Function' },
            { key: 'file', header: 'File' },
            { key: 'riskScore', header: 'Risk' },
            { key: 'possibleReasons', header: 'Possible Reasons' },
          ]);
          
        } else if (options.mockAnalysis) {
          // Mock analysis
          const analysis = await analyzer.getMockAnalysis();
          spin.stop();
          
          console.log(`\nMock Analysis Summary:\n`);
          console.log(`  Total mocks: ${analysis.totalMocks}`);
          console.log(`  External mocks: ${analysis.externalMocks} (${analysis.externalPercent}%)`);
          console.log(`  Internal mocks: ${analysis.internalMocks} (${analysis.internalPercent}%)`);
          console.log(`  Average mock ratio: ${analysis.avgMockRatio.toFixed(2)}`);
          
          if (analysis.highMockRatioTests.length > 0) {
            console.log(`\n⚠️  Tests with high mock ratio (>0.7):\n`);
            for (const test of analysis.highMockRatioTests.slice(0, 10)) {
              console.log(`  ${test.file} - ratio: ${test.mockRatio.toFixed(2)}`);
            }
          }
          
        } else {
          // Default: show summary
          const summary = await analyzer.getSummary();
          spin.stop();
          
          console.log(`\nTest Topology Summary:\n`);
          console.log(`  Test files: ${summary.testFiles}`);
          console.log(`  Test cases: ${summary.testCases}`);
          console.log(`  Source files covered: ${summary.coveredFiles}/${summary.totalFiles} (${summary.coveragePercent}%)`);
          console.log(`  Functions covered: ${summary.coveredFunctions}/${summary.totalFunctions} (${summary.functionCoveragePercent}%)`);
          console.log(`  Average mock ratio: ${summary.avgMockRatio.toFixed(2)}`);
        }
        
      } catch (error) {
        spin.fail('Analysis failed');
        console.error(error);
        process.exit(1);
      }
    });
}
```

### Coupling CLI

```typescript
// packages/cli/src/commands/coupling.ts

import { Command } from 'commander';
import { createModuleCouplingAnalyzer } from 'driftdetect-core';
import { formatTable, formatJson, spinner } from '../utils/output.js';

export function registerCouplingCommand(program: Command): void {
  const cmd = program
    .command('coupling')
    .description('Analyze module coupling and dependencies')
    .option('-t, --target <path>', 'Analyze coupling for a specific module/file')
    .option('--cycles', 'Detect circular dependencies')
    .option('--hotspots', 'Show most coupled modules')
    .option('--unused-exports', 'Find exported symbols never imported')
    .option('--refactor-impact <file>', 'Show impact of refactoring a file')
    .option('--format <format>', 'Output format (table|json)', 'table')
    .option('--limit <n>', 'Limit results', '20')
    .action(async (options) => {
      const spin = spinner('Analyzing module coupling...');
      
      try {
        const analyzer = createModuleCouplingAnalyzer({ rootDir: process.cwd() });
        await analyzer.initialize();
        
        if (options.cycles) {
          // Detect cycles
          const cycles = await analyzer.detectCycles();
          spin.stop();
          
          if (cycles.length === 0) {
            console.log('\n✅ No circular dependencies detected!\n');
          } else {
            console.log(`\n⚠️  Found ${cycles.length} circular dependency cycle(s):\n`);
            
            for (const cycle of cycles) {
              const severity = cycle.severity === 'critical' ? '🔴' : 
                              cycle.severity === 'warning' ? '🟡' : '🟢';
              console.log(`${severity} ${cycle.path.join(' → ')} → ${cycle.path[0]}`);
              
              if (cycle.breakPoints.length > 0) {
                console.log(`   Suggested break: ${cycle.breakPoints[0].edge.from} → ${cycle.breakPoints[0].edge.to}`);
                console.log(`   Rationale: ${cycle.breakPoints[0].rationale}\n`);
              }
            }
          }
          
        } else if (options.hotspots) {
          // Show coupling hotspots
          const hotspots = await analyzer.getHotspots(parseInt(options.limit));
          spin.stop();
          
          console.log(`\nModule Coupling Hotspots:\n`);
          
          formatTable(hotspots, [
            { key: 'path', header: 'Module' },
            { key: 'Ca', header: 'Afferent (Ca)' },
            { key: 'Ce', header: 'Efferent (Ce)' },
            { key: 'instability', header: 'Instability' },
            { key: 'role', header: 'Role' },
          ]);
          
        } else if (options.unusedExports) {
          // Find unused exports
          const unused = await analyzer.getUnusedExports();
          spin.stop();
          
          if (unused.length === 0) {
            console.log('\n✅ No unused exports found!\n');
          } else {
            console.log(`\n⚠️  Found ${unused.length} unused export(s):\n`);
            
            formatTable(unused, [
              { key: 'file', header: 'File' },
              { key: 'symbol', header: 'Export' },
              { key: 'line', header: 'Line' },
            ]);
          }
          
        } else if (options.refactorImpact) {
          // Refactor impact analysis
          const impact = await analyzer.getRefactorImpact(options.refactorImpact);
          spin.stop();
          
          console.log(`\nRefactor Impact for ${options.refactorImpact}:\n`);
          console.log(`  Direct importers: ${impact.directImporters.length}`);
          console.log(`  Transitive importers: ${impact.transitiveImporters.length}`);
          console.log(`  Total affected files: ${impact.totalAffected}`);
          
          if (impact.directImporters.length > 0) {
            console.log(`\nDirect importers:\n`);
            for (const imp of impact.directImporters.slice(0, 10)) {
              console.log(`  ${imp.file} (imports: ${imp.symbols.join(', ')})`);
            }
          }
          
        } else if (options.target) {
          // Analyze specific module
          const metrics = await analyzer.analyzeModule(options.target);
          spin.stop();
          
          console.log(`\nCoupling Analysis for ${options.target}:\n`);
          console.log(`  Afferent coupling (Ca): ${metrics.Ca} (${metrics.importedBy.length} files import this)`);
          console.log(`  Efferent coupling (Ce): ${metrics.Ce} (imports ${metrics.imports.length} files)`);
          console.log(`  Instability (I): ${metrics.instability.toFixed(2)} (0=stable, 1=unstable)`);
          console.log(`  Abstractness (A): ${metrics.abstractness.toFixed(2)}`);
          console.log(`  Distance from main sequence: ${metrics.distance.toFixed(2)}`);
          console.log(`  Role: ${metrics.role}`);
          
        } else {
          // Default: show summary
          const summary = await analyzer.getSummary();
          spin.stop();
          
          console.log(`\nModule Coupling Summary:\n`);
          console.log(`  Total modules: ${summary.totalModules}`);
          console.log(`  Total import edges: ${summary.totalEdges}`);
          console.log(`  Circular dependencies: ${summary.cycleCount}`);
          console.log(`  Average instability: ${summary.avgInstability.toFixed(2)}`);
          console.log(`  Modules in "zone of pain": ${summary.zoneOfPain.length}`);
          console.log(`  Unused exports: ${summary.unusedExports}`);
        }
        
      } catch (error) {
        spin.fail('Analysis failed');
        console.error(error);
        process.exit(1);
      }
    });
}
```

### Error Handling CLI

```typescript
// packages/cli/src/commands/error-handling.ts

import { Command } from 'commander';
import { createErrorHandlingAnalyzer } from 'driftdetect-core';
import { formatTable, formatJson, spinner } from '../utils/output.js';

export function registerErrorHandlingCommand(program: Command): void {
  const cmd = program
    .command('error-handling')
    .description('Analyze error handling coverage and patterns')
    .option('-t, --target <function>', 'Analyze error handling for a specific function')
    .option('--unhandled', 'Find unhandled error paths')
    .option('--boundaries', 'Show error boundaries')
    .option('--propagation <function>', 'Trace error propagation from a function')
    .option('--async-gaps', 'Find unhandled async errors')
    .option('--format <format>', 'Output format (table|json)', 'table')
    .option('--limit <n>', 'Limit results', '20')
    .action(async (options) => {
      const spin = spinner('Analyzing error handling...');
      
      try {
        const analyzer = createErrorHandlingAnalyzer({ rootDir: process.cwd() });
        await analyzer.initialize();
        
        if (options.unhandled) {
          // Find unhandled error paths
          const unhandled = await analyzer.getUnhandledPaths();
          spin.stop();
          
          if (unhandled.length === 0) {
            console.log('\n✅ No unhandled error paths detected!\n');
          } else {
            console.log(`\n⚠️  Found ${unhandled.length} unhandled error path(s):\n`);
            
            for (const path of unhandled.slice(0, parseInt(options.limit))) {
              const severity = path.severity === 'critical' ? '🔴' : 
                              path.severity === 'high' ? '🟠' : '🟡';
              console.log(`${severity} ${path.entryPoint}`);
              console.log(`   Path: ${path.path.join(' → ')}`);
              console.log(`   Error type: ${path.errorType}`);
              console.log(`   Suggested boundary: ${path.suggestedBoundary}\n`);
            }
          }
          
        } else if (options.boundaries) {
          // Show error boundaries
          const boundaries = await analyzer.getErrorBoundaries();
          spin.stop();
          
          console.log(`\nError Boundaries:\n`);
          
          formatTable(boundaries, [
            { key: 'functionId', header: 'Function' },
            { key: 'handledTypes', header: 'Handles' },
            { key: 'coverage', header: 'Coverage %' },
            { key: 'isFrameworkBoundary', header: 'Framework' },
          ]);
          
        } else if (options.asyncGaps) {
          // Find async error gaps
          const gaps = await analyzer.getAsyncGaps();
          spin.stop();
          
          if (gaps.length === 0) {
            console.log('\n✅ No unhandled async errors detected!\n');
          } else {
            console.log(`\n⚠️  Found ${gaps.length} async error gap(s):\n`);
            
            for (const gap of gaps.slice(0, parseInt(options.limit))) {
              console.log(`  ${gap.file}:${gap.line}`);
              console.log(`    ${gap.expression}`);
              console.log(`    Issue: ${gap.issue}\n`);
            }
          }
          
        } else if (options.propagation) {
          // Trace error propagation
          const chain = await analyzer.traceErrorPropagation(options.propagation);
          spin.stop();
          
          console.log(`\nError Propagation from ${options.propagation}:\n`);
          
          if (chain.sink) {
            console.log(`  ✅ Caught at: ${chain.sink.functionId}:${chain.sink.catchLine}`);
          } else {
            console.log(`  ⚠️  Error escapes uncaught!`);
          }
          
          console.log(`\n  Propagation path:`);
          for (const func of chain.propagationPath) {
            console.log(`    → ${func}`);
          }
          
        } else if (options.target) {
          // Analyze specific function
          const profile = await analyzer.analyzeFunction(options.target);
          spin.stop();
          
          console.log(`\nError Handling for ${options.target}:\n`);
          console.log(`  Has try/catch: ${profile.hasTryCatch ? '✅' : '❌'}`);
          console.log(`  Can throw: ${profile.canThrow ? '⚠️ Yes' : '✅ No'}`);
          console.log(`  Rethrows: ${profile.rethrows ? 'Yes' : 'No'}`);
          console.log(`  Quality score: ${profile.qualityScore}/100`);
          
          if (profile.catchTypes.length > 0) {
            console.log(`\n  Catch clauses:`);
            for (const clause of profile.catchTypes) {
              console.log(`    - ${clause.errorType}: ${clause.action}`);
            }
          }
          
          if (profile.asyncHandling.hasUnhandledPromises) {
            console.log(`\n  ⚠️  Unhandled async errors:`);
            for (const loc of profile.asyncHandling.unhandledLocations) {
              console.log(`    Line ${loc.line}: ${loc.expression}`);
            }
          }
          
        } else {
          // Default: show summary
          const summary = await analyzer.getSummary();
          spin.stop();
          
          console.log(`\nError Handling Summary:\n`);
          console.log(`  Functions analyzed: ${summary.totalFunctions}`);
          console.log(`  With try/catch: ${summary.withTryCatch} (${summary.tryCatchPercent}%)`);
          console.log(`  Can throw: ${summary.canThrow}`);
          console.log(`  Unhandled paths: ${summary.unhandledPaths}`);
          console.log(`  Async gaps: ${summary.asyncGaps}`);
          console.log(`  Average quality score: ${summary.avgQualityScore.toFixed(0)}/100`);
          
          if (summary.swallowedErrors > 0) {
            console.log(`\n  ⚠️  ${summary.swallowedErrors} catch blocks swallow errors silently`);
          }
        }
        
      } catch (error) {
        spin.fail('Analysis failed');
        console.error(error);
        process.exit(1);
      }
    });
}
```


---

## MCP Tool Handlers

### Test Topology MCP Tool

```typescript
// packages/mcp/src/tools/analysis/test-topology.ts

import {
  createTestTopologyAnalyzer,
  type TestTopologyResult,
  type MinimumTestSet,
  type MockAnalysis,
} from 'driftdetect-core';
import { createResponseBuilder, Errors } from '../../infrastructure/index.js';

interface TestTopologyData {
  action: 'coverage' | 'minimum-set' | 'uncovered' | 'mock-analysis' | 'summary';
  target?: string;
  changed?: string[];
  tests?: TestCoverageInfo[];
  minimumSet?: MinimumTestSet;
  uncovered?: UncoveredFunction[];
  mockAnalysis?: MockAnalysis;
  summary?: TestTopologySummary;
}

export async function handleTestTopology(
  projectRoot: string,
  args: {
    action?: string;
    target?: string;
    changed?: string[];
    minRisk?: string;
    limit?: number;
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const builder = createResponseBuilder<TestTopologyData>();
  
  const action = args.action ?? 'summary';
  const limit = args.limit ?? 20;
  
  const analyzer = createTestTopologyAnalyzer({ rootDir: projectRoot });
  await analyzer.initialize();
  
  switch (action) {
    case 'coverage': {
      if (!args.target) {
        throw Errors.missingParameter('target');
      }
      
      const coverage = await analyzer.getTestsForFile(args.target);
      
      const data: TestTopologyData = {
        action: 'coverage',
        target: args.target,
        tests: coverage.tests.slice(0, limit),
      };
      
      const directTests = coverage.tests.filter(t => t.reachType === 'direct').length;
      const transitiveTests = coverage.tests.filter(t => t.reachType === 'transitive').length;
      
      return builder
        .withSummary(`${coverage.tests.length} tests cover ${args.target} (${directTests} direct, ${transitiveTests} transitive)`)
        .withData(data)
        .withHints({
          nextActions: [
            coverage.tests.length === 0 
              ? 'Consider adding tests for this file'
              : `Run: npm test -- ${coverage.tests.slice(0, 3).map(t => t.testFile).join(' ')}`,
          ],
          relatedTools: ['drift_impact_analysis', 'drift_coverage'],
        })
        .buildContent();
    }
    
    case 'minimum-set': {
      if (!args.changed || args.changed.length === 0) {
        throw Errors.missingParameter('changed');
      }
      
      const testSet = await analyzer.getMinimumTestSet(args.changed);
      
      const data: TestTopologyData = {
        action: 'minimum-set',
        changed: args.changed,
        minimumSet: testSet,
      };
      
      return builder
        .withSummary(`${testSet.tests.length} tests needed for ${args.changed.length} changed file(s). Estimated time saved: ${testSet.timeSaved}`)
        .withData(data)
        .withHints({
          nextActions: [
            `Run: npm test -- ${testSet.tests.map(t => t.file).join(' ')}`,
          ],
          relatedTools: ['drift_impact_analysis'],
        })
        .buildContent();
    }
    
    case 'uncovered': {
      const uncovered = await analyzer.getUncoveredFunctions({
        minRisk: args.minRisk ?? 'low',
        limit,
      });
      
      const data: TestTopologyData = {
        action: 'uncovered',
        uncovered,
      };
      
      const highRisk = uncovered.filter(u => u.riskScore >= 70).length;
      
      return builder
        .withSummary(`${uncovered.length} functions without test coverage (${highRisk} high risk)`)
        .withData(data)
        .withHints({
          nextActions: highRisk > 0
            ? ['Prioritize adding tests for high-risk uncovered functions']
            : ['Consider adding tests for medium-risk functions'],
          warnings: highRisk > 5 ? ['Multiple high-risk functions lack coverage'] : undefined,
          relatedTools: ['drift_dead_code', 'drift_coverage'],
        })
        .buildContent();
    }
    
    case 'mock-analysis': {
      const analysis = await analyzer.getMockAnalysis();
      
      const data: TestTopologyData = {
        action: 'mock-analysis',
        mockAnalysis: analysis,
      };
      
      const warnings: string[] = [];
      if (analysis.internalPercent > 50) {
        warnings.push('High internal mock ratio - tests may be brittle');
      }
      if (analysis.avgMockRatio > 0.7) {
        warnings.push('Tests mock more than they test - consider integration tests');
      }
      
      return builder
        .withSummary(`${analysis.totalMocks} mocks (${analysis.externalPercent}% external, ${analysis.internalPercent}% internal). Avg mock ratio: ${analysis.avgMockRatio.toFixed(2)}`)
        .withData(data)
        .withHints({
          nextActions: warnings.length > 0
            ? ['Review tests with high mock ratios']
            : ['Mock usage looks healthy'],
          warnings: warnings.length > 0 ? warnings : undefined,
          relatedTools: ['drift_test_topology action="coverage"'],
        })
        .buildContent();
    }
    
    default: {
      const summary = await analyzer.getSummary();
      
      const data: TestTopologyData = {
        action: 'summary',
        summary,
      };
      
      return builder
        .withSummary(`${summary.testCases} tests covering ${summary.coveragePercent}% of files (${summary.functionCoveragePercent}% of functions)`)
        .withData(data)
        .withHints({
          nextActions: [
            'Use action="coverage" target="file.ts" to see tests for a file',
            'Use action="minimum-set" changed=["file.ts"] to get minimum test set',
            'Use action="uncovered" to find untested code',
          ],
          relatedTools: ['drift_coverage', 'drift_impact_analysis'],
        })
        .buildContent();
    }
  }
}
```

### Coupling MCP Tool

```typescript
// packages/mcp/src/tools/analysis/coupling.ts

import {
  createModuleCouplingAnalyzer,
  type DependencyCycle,
  type ModuleMetrics,
  type RefactorImpact,
} from 'driftdetect-core';
import { createResponseBuilder, Errors } from '../../infrastructure/index.js';

interface CouplingData {
  action: 'analyze' | 'cycles' | 'hotspots' | 'unused-exports' | 'refactor-impact' | 'summary';
  target?: string;
  metrics?: ModuleMetrics;
  cycles?: DependencyCycle[];
  hotspots?: ModuleMetrics[];
  unusedExports?: UnusedExport[];
  refactorImpact?: RefactorImpact;
  summary?: CouplingSummary;
}

export async function handleCoupling(
  projectRoot: string,
  args: {
    action?: string;
    target?: string;
    limit?: number;
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const builder = createResponseBuilder<CouplingData>();
  
  const action = args.action ?? 'summary';
  const limit = args.limit ?? 20;
  
  const analyzer = createModuleCouplingAnalyzer({ rootDir: projectRoot });
  await analyzer.initialize();
  
  switch (action) {
    case 'cycles': {
      const cycles = await analyzer.detectCycles();
      
      const data: CouplingData = {
        action: 'cycles',
        cycles: cycles.slice(0, limit),
      };
      
      const critical = cycles.filter(c => c.severity === 'critical').length;
      
      return builder
        .withSummary(cycles.length === 0 
          ? '✅ No circular dependencies detected'
          : `⚠️ ${cycles.length} circular dependencies (${critical} critical)`)
        .withData(data)
        .withHints({
          nextActions: cycles.length > 0
            ? cycles.slice(0, 3).map(c => `Break cycle: ${c.breakPoints[0]?.edge.from} → ${c.breakPoints[0]?.edge.to}`)
            : ['Codebase has clean dependency structure'],
          warnings: critical > 0 ? ['Critical cycles can cause build/runtime issues'] : undefined,
          relatedTools: ['drift_coupling action="refactor-impact"'],
        })
        .buildContent();
    }
    
    case 'hotspots': {
      const hotspots = await analyzer.getHotspots(limit);
      
      const data: CouplingData = {
        action: 'hotspots',
        hotspots,
      };
      
      const hubs = hotspots.filter(h => h.role === 'hub').length;
      
      return builder
        .withSummary(`Top ${hotspots.length} coupled modules. ${hubs} are "hubs" (many dependents)`)
        .withData(data)
        .withHints({
          nextActions: [
            'Consider breaking up modules with high coupling',
            'Use action="refactor-impact" to assess change risk',
          ],
          relatedTools: ['drift_coupling action="cycles"', 'drift_impact_analysis'],
        })
        .buildContent();
    }
    
    case 'unused-exports': {
      const unused = await analyzer.getUnusedExports();
      
      const data: CouplingData = {
        action: 'unused-exports',
        unusedExports: unused.slice(0, limit),
      };
      
      return builder
        .withSummary(unused.length === 0
          ? '✅ No unused exports found'
          : `⚠️ ${unused.length} exported symbols are never imported`)
        .withData(data)
        .withHints({
          nextActions: unused.length > 0
            ? ['Consider removing unused exports to reduce API surface']
            : ['Export hygiene looks good'],
          relatedTools: ['drift_dead_code'],
        })
        .buildContent();
    }
    
    case 'refactor-impact': {
      if (!args.target) {
        throw Errors.missingParameter('target');
      }
      
      const impact = await analyzer.getRefactorImpact(args.target);
      
      const data: CouplingData = {
        action: 'refactor-impact',
        target: args.target,
        refactorImpact: impact,
      };
      
      const riskLevel = impact.totalAffected > 20 ? 'high' :
                       impact.totalAffected > 5 ? 'medium' : 'low';
      
      return builder
        .withSummary(`Refactoring ${args.target} affects ${impact.totalAffected} files (${impact.directImporters.length} direct, ${impact.transitiveImporters.length} transitive). Risk: ${riskLevel}`)
        .withData(data)
        .withHints({
          nextActions: [
            riskLevel === 'high' 
              ? 'Consider incremental refactoring to reduce blast radius'
              : 'Safe to refactor with proper testing',
          ],
          warnings: riskLevel === 'high' ? ['High-impact change - ensure comprehensive testing'] : undefined,
          relatedTools: ['drift_test_topology action="minimum-set"', 'drift_impact_analysis'],
        })
        .buildContent();
    }
    
    case 'analyze': {
      if (!args.target) {
        throw Errors.missingParameter('target');
      }
      
      const metrics = await analyzer.analyzeModule(args.target);
      
      const data: CouplingData = {
        action: 'analyze',
        target: args.target,
        metrics,
      };
      
      const stability = metrics.instability < 0.3 ? 'stable' :
                       metrics.instability > 0.7 ? 'unstable' : 'balanced';
      
      return builder
        .withSummary(`${args.target}: Ca=${metrics.Ca}, Ce=${metrics.Ce}, I=${metrics.instability.toFixed(2)} (${stability}), role=${metrics.role}`)
        .withData(data)
        .withHints({
          nextActions: [
            metrics.role === 'hub' 
              ? 'This module has many dependents - changes are high-risk'
              : 'Use action="refactor-impact" to assess change risk',
          ],
          relatedTools: ['drift_coupling action="refactor-impact"'],
        })
        .buildContent();
    }
    
    default: {
      const summary = await analyzer.getSummary();
      
      const data: CouplingData = {
        action: 'summary',
        summary,
      };
      
      return builder
        .withSummary(`${summary.totalModules} modules, ${summary.cycleCount} cycles, avg instability ${summary.avgInstability.toFixed(2)}`)
        .withData(data)
        .withHints({
          nextActions: [
            'Use action="cycles" to find circular dependencies',
            'Use action="hotspots" to find highly coupled modules',
            'Use action="refactor-impact" target="file.ts" to assess change risk',
          ],
          relatedTools: ['drift_impact_analysis', 'drift_test_topology'],
        })
        .buildContent();
    }
  }
}
```

### Error Handling MCP Tool

```typescript
// packages/mcp/src/tools/analysis/error-handling.ts

import {
  createErrorHandlingAnalyzer,
  type ErrorHandlingProfile,
  type ErrorBoundary,
  type UnhandledErrorPath,
  type ErrorPropagationChain,
} from 'driftdetect-core';
import { createResponseBuilder, Errors } from '../../infrastructure/index.js';

interface ErrorHandlingData {
  action: 'analyze' | 'unhandled' | 'boundaries' | 'propagation' | 'async-gaps' | 'summary';
  target?: string;
  profile?: ErrorHandlingProfile;
  unhandledPaths?: UnhandledErrorPath[];
  boundaries?: ErrorBoundary[];
  propagation?: ErrorPropagationChain;
  asyncGaps?: AsyncGap[];
  summary?: ErrorHandlingSummary;
}

export async function handleErrorHandling(
  projectRoot: string,
  args: {
    action?: string;
    target?: string;
    source?: string;
    limit?: number;
  }
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const builder = createResponseBuilder<ErrorHandlingData>();
  
  const action = args.action ?? 'summary';
  const limit = args.limit ?? 20;
  
  const analyzer = createErrorHandlingAnalyzer({ rootDir: projectRoot });
  await analyzer.initialize();
  
  switch (action) {
    case 'unhandled': {
      const unhandled = await analyzer.getUnhandledPaths();
      
      const data: ErrorHandlingData = {
        action: 'unhandled',
        unhandledPaths: unhandled.slice(0, limit),
      };
      
      const critical = unhandled.filter(u => u.severity === 'critical').length;
      const high = unhandled.filter(u => u.severity === 'high').length;
      
      return builder
        .withSummary(unhandled.length === 0
          ? '✅ No unhandled error paths detected'
          : `⚠️ ${unhandled.length} unhandled error paths (${critical} critical, ${high} high)`)
        .withData(data)
        .withHints({
          nextActions: unhandled.length > 0
            ? unhandled.slice(0, 3).map(u => `Add error handling at ${u.suggestedBoundary}`)
            : ['Error handling coverage looks good'],
          warnings: critical > 0 ? ['Critical paths can crash the application'] : undefined,
          relatedTools: ['drift_error_handling action="boundaries"'],
        })
        .buildContent();
    }
    
    case 'boundaries': {
      const boundaries = await analyzer.getErrorBoundaries();
      
      const data: ErrorHandlingData = {
        action: 'boundaries',
        boundaries: boundaries.slice(0, limit),
      };
      
      const frameworkBoundaries = boundaries.filter(b => b.isFrameworkBoundary).length;
      
      return builder
        .withSummary(`${boundaries.length} error boundaries (${frameworkBoundaries} framework-level)`)
        .withData(data)
        .withHints({
          nextActions: [
            'Use action="unhandled" to find gaps in error handling',
          ],
          relatedTools: ['drift_error_handling action="unhandled"'],
        })
        .buildContent();
    }
    
    case 'async-gaps': {
      const gaps = await analyzer.getAsyncGaps();
      
      const data: ErrorHandlingData = {
        action: 'async-gaps',
        asyncGaps: gaps.slice(0, limit),
      };
      
      return builder
        .withSummary(gaps.length === 0
          ? '✅ No unhandled async errors detected'
          : `⚠️ ${gaps.length} unhandled async error(s) (missing .catch() or try/catch)`)
        .withData(data)
        .withHints({
          nextActions: gaps.length > 0
            ? ['Wrap await calls in try/catch or add .catch() handlers']
            : ['Async error handling looks good'],
          warnings: gaps.length > 5 ? ['Multiple unhandled promises can cause silent failures'] : undefined,
          relatedTools: ['drift_error_handling action="unhandled"'],
        })
        .buildContent();
    }
    
    case 'propagation': {
      const source = args.source ?? args.target;
      if (!source) {
        throw Errors.missingParameter('source');
      }
      
      const chain = await analyzer.traceErrorPropagation(source);
      
      const data: ErrorHandlingData = {
        action: 'propagation',
        target: source,
        propagation: chain,
      };
      
      const caught = chain.sink !== null;
      
      return builder
        .withSummary(caught
          ? `Errors from ${source} are caught at ${chain.sink!.functionId}`
          : `⚠️ Errors from ${source} escape uncaught through ${chain.propagationPath.length} functions`)
        .withData(data)
        .withHints({
          nextActions: caught
            ? ['Error handling chain is complete']
            : [`Add error handling at ${chain.propagationPath[chain.propagationPath.length - 1]}`],
          relatedTools: ['drift_error_handling action="boundaries"'],
        })
        .buildContent();
    }
    
    case 'analyze': {
      if (!args.target) {
        throw Errors.missingParameter('target');
      }
      
      const profile = await analyzer.analyzeFunction(args.target);
      
      const data: ErrorHandlingData = {
        action: 'analyze',
        target: args.target,
        profile,
      };
      
      const quality = profile.qualityScore >= 70 ? 'good' :
                     profile.qualityScore >= 40 ? 'fair' : 'poor';
      
      return builder
        .withSummary(`${args.target}: ${profile.hasTryCatch ? 'has' : 'no'} try/catch, ${profile.canThrow ? 'can throw' : 'safe'}, quality=${quality} (${profile.qualityScore}/100)`)
        .withData(data)
        .withHints({
          nextActions: profile.qualityScore < 50
            ? ['Consider improving error handling in this function']
            : ['Error handling looks adequate'],
          warnings: profile.catchTypes.some(c => c.action === 'swallow')
            ? ['Function swallows errors silently']
            : undefined,
          relatedTools: ['drift_error_handling action="propagation"'],
        })
        .buildContent();
    }
    
    default: {
      const summary = await analyzer.getSummary();
      
      const data: ErrorHandlingData = {
        action: 'summary',
        summary,
      };
      
      return builder
        .withSummary(`${summary.tryCatchPercent}% of functions have error handling. ${summary.unhandledPaths} unhandled paths, ${summary.asyncGaps} async gaps. Avg quality: ${summary.avgQualityScore}/100`)
        .withData(data)
        .withHints({
          nextActions: [
            'Use action="unhandled" to find error handling gaps',
            'Use action="async-gaps" to find unhandled promises',
            'Use action="analyze" target="functionName" for detailed analysis',
          ],
          relatedTools: ['drift_impact_analysis', 'drift_coverage'],
        })
        .buildContent();
    }
  }
}
```

---

## Tool Registration

```typescript
// packages/mcp/src/tools/analysis/index.ts

export { handleTestTopology } from './test-topology.js';
export { handleCoupling } from './coupling.js';
export { handleErrorHandling } from './error-handling.js';

// Register in enterprise-server.ts
import { handleTestTopology, handleCoupling, handleErrorHandling } from './tools/analysis/index.js';

// Add to tool definitions
{
  name: 'drift_test_topology',
  description: 'Analyze test-to-code mapping, find minimum test sets, detect mock patterns',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['coverage', 'minimum-set', 'uncovered', 'mock-analysis', 'summary'],
        description: 'Analysis action to perform',
      },
      target: { type: 'string', description: 'File to analyze (for coverage action)' },
      changed: { type: 'array', items: { type: 'string' }, description: 'Changed files (for minimum-set action)' },
      minRisk: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Minimum risk level (for uncovered action)' },
      limit: { type: 'number', description: 'Max results to return' },
    },
  },
},
{
  name: 'drift_coupling',
  description: 'Analyze module coupling, detect cycles, find unused exports',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['analyze', 'cycles', 'hotspots', 'unused-exports', 'refactor-impact', 'summary'],
        description: 'Analysis action to perform',
      },
      target: { type: 'string', description: 'Module/file to analyze' },
      limit: { type: 'number', description: 'Max results to return' },
    },
  },
},
{
  name: 'drift_error_handling',
  description: 'Analyze error handling coverage, find unhandled paths, trace error propagation',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['analyze', 'unhandled', 'boundaries', 'propagation', 'async-gaps', 'summary'],
        description: 'Analysis action to perform',
      },
      target: { type: 'string', description: 'Function to analyze' },
      source: { type: 'string', description: 'Source function for propagation tracing' },
      limit: { type: 'number', description: 'Max results to return' },
    },
  },
},
```
