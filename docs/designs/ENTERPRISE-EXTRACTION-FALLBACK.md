# Enterprise Extraction Fallback System

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Base Infrastructure | ✅ Complete | `types.ts`, `base-regex-extractor.ts`, `hybrid-extractor-base.ts` |
| TypeScript Regex | ✅ Complete | `regex/typescript-regex.ts` |
| Python Regex | ✅ Complete | `regex/python-regex.ts` |
| PHP Regex | ✅ Complete | `regex/php-regex.ts` |
| Java Regex | ✅ Complete | `regex/java-regex.ts` |
| C# Regex | ✅ Complete | `regex/csharp-regex.ts` |
| Python Hybrid | ✅ Complete | `python-hybrid-extractor.ts` |
| TypeScript Hybrid | ✅ Complete | `typescript-hybrid-extractor.ts` |
| PHP Hybrid | ✅ Complete | `php-hybrid-extractor.ts` |
| Java Hybrid | ✅ Complete | `java-hybrid-extractor.ts` |
| C# Hybrid | ✅ Complete | `csharp-hybrid-extractor.ts` |
| Heuristic Layer | 🔄 Pending | Line-by-line fallback for edge cases |
| Data Access Extractors | 🔄 Pending | Uses unified provider system (different approach) |
| **Test Topology Extractors** | ✅ Complete | All 5 languages have regex fallback |

### Test Topology Regex Fallback

| Language | Status | File |
|----------|--------|------|
| TypeScript/JS | ✅ Complete | `test-topology/extractors/regex/typescript-test-regex.ts` |
| Python | ✅ Complete | `test-topology/extractors/regex/python-test-regex.ts` |
| Java | ✅ Complete | `test-topology/extractors/regex/java-test-regex.ts` |
| C# | ✅ Complete | `test-topology/extractors/regex/csharp-test-regex.ts` |
| PHP | ✅ Complete | `test-topology/extractors/regex/php-test-regex.ts` |
| Hybrid Analyzer | ✅ Complete | `test-topology/hybrid-test-topology-analyzer.ts` |

## Overview

This document describes the enterprise-grade fallback system for code extraction that ensures near-100% extraction coverage across all supported languages, even when tree-sitter is unavailable or fails.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTRACTION PIPELINE                                   │
│                                                                              │
│  Source Code                                                                 │
│      │                                                                       │
│      ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    TIER 1: TREE-SITTER (Primary)                     │    │
│  │  • Full AST parsing                                                  │    │
│  │  • Semantic accuracy: 99%+                                           │    │
│  │  • Confidence: HIGH (0.95)                                           │    │
│  │  • Handles: All language constructs                                  │    │
│  └──────────────────────────┬──────────────────────────────────────────┘    │
│                             │                                                │
│                    ┌────────┴────────┐                                       │
│                    │ Tree-sitter     │                                       │
│                    │ Available?      │                                       │
│                    └────────┬────────┘                                       │
│                      Yes    │    No / Parse Error                            │
│                      │      │      │                                         │
│                      ▼      │      ▼                                         │
│  ┌──────────────────────┐   │   ┌──────────────────────────────────────┐    │
│  │ Return Results       │   │   │        TIER 2: REGEX (Fallback)      │    │
│  │ confidence: HIGH     │   │   │  • Pattern-based extraction          │    │
│  └──────────────────────┘   │   │  • Semantic accuracy: 85-95%         │    │
│                             │   │  • Confidence: MEDIUM (0.75)         │    │
│                             │   │  • Handles: Common patterns          │    │
│                             │   └──────────────────────┬───────────────┘    │
│                             │                          │                     │
│                             │                 ┌────────┴────────┐            │
│                             │                 │ Regex           │            │
│                             │                 │ Succeeded?      │            │
│                             │                 └────────┬────────┘            │
│                             │                   Yes    │    No               │
│                             │                   │      │    │                │
│                             │                   ▼      │    ▼                │
│                             │   ┌──────────────────┐   │   ┌────────────────┐│
│                             │   │ Return Results   │   │   │ TIER 3: HEURISTIC│
│                             │   │ confidence: MED  │   │   │ • Line scanning │
│                             │   └──────────────────┘   │   │ • Keyword match │
│                             │                          │   │ • Confidence: LOW│
│                             │                          │   └────────────────┘│
│                             │                          │                     │
│  ┌──────────────────────────┴──────────────────────────┴───────────────────┐│
│  │                      RESULT AGGREGATOR                                   ││
│  │  • Merge results from all tiers                                         ││
│  │  • Deduplicate by location                                              ││
│  │  • Track extraction method per item                                     ││
│  │  • Calculate overall confidence score                                   ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Confidence Scoring

Each extraction method produces results with confidence scores:

| Tier | Method | Confidence | Use Case |
|------|--------|------------|----------|
| 1 | Tree-sitter | 0.95 | Full AST available |
| 2 | Regex | 0.75 | Tree-sitter unavailable |
| 3 | Heuristic | 0.50 | Regex failed, last resort |

## Extraction Quality Metrics

```typescript
interface ExtractionQuality {
  /** Overall confidence (0-1) */
  confidence: number;
  
  /** Extraction method used */
  method: 'tree-sitter' | 'regex' | 'heuristic' | 'hybrid';
  
  /** Percentage of file successfully parsed */
  coveragePercent: number;
  
  /** Number of items extracted */
  itemsExtracted: number;
  
  /** Number of parse errors encountered */
  parseErrors: number;
  
  /** Warnings (non-fatal issues) */
  warnings: string[];
  
  /** Whether fallback was used */
  usedFallback: boolean;
  
  /** Time taken in ms */
  extractionTimeMs: number;
}
```

## Language-Specific Regex Patterns

### TypeScript/JavaScript

```typescript
const TS_PATTERNS = {
  // Function declarations
  functionDecl: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)/g,
  
  // Arrow functions
  arrowFunc: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/g,
  
  // Class declarations
  classDecl: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g,
  
  // Method declarations
  methodDecl: /(?:public|private|protected|static|async|readonly|\s)*(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?::\s*[^{]+)?{/g,
  
  // Import statements
  importStmt: /import\s+(?:type\s+)?(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/g,
  
  // Export statements
  exportStmt: /export\s+(?:default\s+)?(?:type\s+)?(?:{([^}]+)}|(\w+)|function\s+(\w+)|class\s+(\w+)|const\s+(\w+))/g,
  
  // Function calls
  functionCall: /(\w+)\s*\(/g,
  
  // Method calls
  methodCall: /(\w+)\.(\w+)\s*\(/g,
};
```

### Python

```typescript
const PYTHON_PATTERNS = {
  // Function definitions
  functionDef: /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?:/gm,
  
  // Class definitions
  classDef: /^(\s*)class\s+(\w+)(?:\(([^)]*)\))?:/gm,
  
  // Method definitions (indented def)
  methodDef: /^(\s{4,})(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gm,
  
  // Import statements
  importStmt: /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm,
  
  // Decorators
  decorator: /^(\s*)@(\w+(?:\.\w+)*)(?:\(([^)]*)\))?$/gm,
  
  // Function calls
  functionCall: /(\w+)\s*\(/g,
};
```

### PHP

```typescript
const PHP_PATTERNS = {
  // Function definitions
  functionDef: /(?:public|private|protected|static|\s)*function\s+(\w+)\s*\(([^)]*)\)/g,
  
  // Class definitions
  classDef: /(?:abstract\s+)?(?:final\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g,
  
  // Interface definitions
  interfaceDef: /interface\s+(\w+)(?:\s+extends\s+([^{]+))?/g,
  
  // Trait definitions
  traitDef: /trait\s+(\w+)/g,
  
  // Namespace
  namespace: /namespace\s+([^;{]+)/g,
  
  // Use statements
  useStmt: /use\s+([^;]+)/g,
  
  // Method calls
  methodCall: /(\$?\w+)->(\w+)\s*\(/g,
  
  // Static calls
  staticCall: /(\w+)::(\w+)\s*\(/g,
};
```

### Java

```typescript
const JAVA_PATTERNS = {
  // Method definitions
  methodDef: /(?:public|private|protected|static|final|abstract|synchronized|\s)*(?:<[^>]+>\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)/g,
  
  // Class definitions
  classDef: /(?:public|private|protected|abstract|final|\s)*class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/g,
  
  // Interface definitions
  interfaceDef: /(?:public\s+)?interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+([^{]+))?/g,
  
  // Package declaration
  packageDecl: /package\s+([^;]+)/g,
  
  // Import statements
  importStmt: /import\s+(?:static\s+)?([^;]+)/g,
  
  // Annotations
  annotation: /@(\w+)(?:\(([^)]*)\))?/g,
  
  // Method calls
  methodCall: /(\w+)\.(\w+)\s*\(/g,
};
```

### C#

```typescript
const CSHARP_PATTERNS = {
  // Method definitions
  methodDef: /(?:public|private|protected|internal|static|virtual|override|abstract|async|\s)*(?:<[^>]+>\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)/g,
  
  // Class definitions
  classDef: /(?:public|private|protected|internal|abstract|sealed|static|partial|\s)*class\s+(\w+)(?:<[^>]+>)?(?:\s*:\s*([^{]+))?/g,
  
  // Interface definitions
  interfaceDef: /(?:public|private|protected|internal|\s)*interface\s+(\w+)(?:<[^>]+>)?(?:\s*:\s*([^{]+))?/g,
  
  // Namespace
  namespace: /namespace\s+([^{;]+)/g,
  
  // Using statements
  usingStmt: /using\s+(?:static\s+)?([^;]+)/g,
  
  // Attributes
  attribute: /\[(\w+)(?:\(([^)]*)\))?\]/g,
  
  // Method calls
  methodCall: /(\w+)\.(\w+)\s*\(/g,
  
  // LINQ queries
  linqQuery: /\.(?:Where|Select|OrderBy|GroupBy|Join|Any|All|First|Single|Count)\s*\(/g,
};
```

## Implementation Strategy

### Phase 1: Base Infrastructure

1. Create `RegexExtractorBase` class with common utilities
2. Define `ExtractionQuality` interface
3. Implement confidence scoring system
4. Add extraction method tracking

### Phase 2: Language-Specific Regex Extractors

1. `TypeScriptRegexExtractor`
2. `PythonRegexExtractor`
3. `PhpRegexExtractor`
4. `JavaRegexExtractor`
5. `CSharpRegexExtractor`

### Phase 3: Hybrid Extractors

1. Modify each tree-sitter extractor to:
   - Try tree-sitter first
   - Fall back to regex on failure
   - Merge results with confidence tracking
   - Report extraction quality metrics

### Phase 4: Heuristic Layer

1. Line-by-line keyword scanning
2. Bracket matching for scope detection
3. Comment/string filtering
4. Last-resort extraction for edge cases

## File Structure

```
drift/packages/core/src/call-graph/extractors/
├── base-extractor.ts              # Existing base class
├── hybrid-extractor-base.ts       # NEW: Base for hybrid extractors
├── regex/
│   ├── index.ts                   # NEW: Regex extractor exports
│   ├── base-regex-extractor.ts    # NEW: Base regex extractor
│   ├── typescript-regex.ts        # NEW: TS/JS regex patterns
│   ├── python-regex.ts            # NEW: Python regex patterns
│   ├── php-regex.ts               # NEW: PHP regex patterns
│   ├── java-regex.ts              # NEW: Java regex patterns
│   └── csharp-regex.ts            # NEW: C# regex patterns
├── heuristic/
│   ├── index.ts                   # NEW: Heuristic extractor exports
│   ├── line-scanner.ts            # NEW: Line-by-line scanner
│   └── keyword-matcher.ts         # NEW: Keyword-based detection
├── typescript-extractor.ts        # MODIFY: Add fallback
├── python-extractor.ts            # MODIFY: Add fallback
├── php-extractor.ts               # MODIFY: Add fallback
├── java-extractor.ts              # MODIFY: Add fallback
└── csharp-extractor.ts            # MODIFY: Add fallback

drift/packages/core/src/test-topology/
├── extractors/
│   ├── base-test-extractor.ts     # Base class for test extractors
│   ├── typescript-test-extractor.ts
│   ├── python-test-extractor.ts
│   ├── java-test-extractor.ts
│   ├── csharp-test-extractor.ts
│   ├── php-test-extractor.ts
│   └── regex/
│       ├── index.ts               # Regex extractor exports + factory
│       ├── typescript-test-regex.ts  # Jest/Vitest/Mocha patterns
│       ├── python-test-regex.ts      # pytest/unittest patterns
│       ├── java-test-regex.ts        # JUnit 4/5/TestNG patterns
│       ├── csharp-test-regex.ts      # xUnit/NUnit/MSTest patterns
│       └── php-test-regex.ts         # PHPUnit/Pest patterns
├── hybrid-test-topology-analyzer.ts  # Hybrid analyzer with fallback
├── test-topology-analyzer.ts         # Original tree-sitter analyzer
├── types.ts
└── index.ts
```

## Quality Assurance

### Extraction Coverage Targets

| Language | Tree-sitter | Regex Fallback | Combined |
|----------|-------------|----------------|----------|
| TypeScript/JS | 99% | 90% | 99.9% |
| Python | 99% | 88% | 99.5% |
| PHP | 98% | 85% | 99.0% |
| Java | 98% | 87% | 99.2% |
| C# | 98% | 85% | 99.0% |

### Test Strategy

1. **Unit Tests**: Each regex pattern tested against known code samples
2. **Integration Tests**: Full extraction pipeline with fallback scenarios
3. **Benchmark Tests**: Compare tree-sitter vs regex accuracy
4. **Edge Case Tests**: Malformed code, unusual syntax, edge cases

### Metrics to Track

- Extraction success rate per method
- Fallback trigger frequency
- Confidence score distribution
- Parse error frequency
- Extraction time per method

## Migration Path

1. Implement regex extractors (non-breaking)
2. Add fallback logic to existing extractors
3. Add quality metrics to extraction results
4. Update consumers to handle quality metadata
5. Add dashboard/CLI reporting for extraction quality

## API Changes

### Before (Current)

```typescript
interface FileExtractionResult {
  file: string;
  language: CallGraphLanguage;
  functions: FunctionExtraction[];
  calls: CallExtraction[];
  imports: ImportExtraction[];
  exports: ExportExtraction[];
  classes: ClassExtraction[];
  errors: string[];
}
```

### After (With Quality Metrics)

```typescript
interface FileExtractionResult {
  file: string;
  language: CallGraphLanguage;
  functions: FunctionExtraction[];
  calls: CallExtraction[];
  imports: ImportExtraction[];
  exports: ExportExtraction[];
  classes: ClassExtraction[];
  errors: string[];
  
  // NEW: Quality metrics
  quality: ExtractionQuality;
}

interface FunctionExtraction {
  // ... existing fields ...
  
  // NEW: Per-item confidence
  extractionConfidence?: number;
  extractionMethod?: 'tree-sitter' | 'regex' | 'heuristic';
}
```

## Conclusion

This enterprise-grade fallback system ensures:

1. **Near-100% extraction coverage** across all supported languages
2. **Graceful degradation** when tree-sitter is unavailable
3. **Confidence tracking** for downstream consumers
4. **Quality metrics** for monitoring and debugging
5. **Backward compatibility** with existing code
