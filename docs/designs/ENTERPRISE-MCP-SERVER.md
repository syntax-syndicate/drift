# Enterprise-Grade MCP Server Design for Drift

## Executive Summary

Drift is not just another MCP server - it's an **AI-native codebase intelligence platform**. Unlike typical MCP servers that wrap existing APIs, Drift's MCP server is the primary interface for AI agents to understand and work with codebases. This document outlines an enterprise-grade architecture that maximizes AI task completion rates while maintaining security, observability, and scalability.

## What Makes Drift Unique

### The Problem Space
Traditional MCP servers expose CRUD operations on external systems. Drift is fundamentally different:

1. **Drift IS the AI's codebase understanding** - It's not wrapping an API, it's providing the cognitive foundation for code generation
2. **Context is the product** - Every response directly impacts AI reasoning quality
3. **Patterns are living knowledge** - They evolve with the codebase and inform every AI decision
4. **Security analysis is first-class** - Understanding data flows and access patterns is core functionality

### Design Principles

1. **Maximize Task Completion Rate** - Every design decision optimizes for AI successfully completing user tasks
2. **Context-Efficient by Default** - Responses are structured to minimize token waste while maximizing signal
3. **Progressive Disclosure** - Summary first, details on demand
4. **Self-Describing** - Tools guide the AI toward correct usage
5. **Fail Gracefully** - Errors include recovery suggestions

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Client (Claude, Kiro, etc.)             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Transport Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   stdio     │  │   HTTP/SSE  │  │   WebSocket (future)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Request Pipeline                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Validate │→ │ Authorize│→ │ Rate     │→ │ Request Context  │ │
│  │          │  │          │  │ Limit    │  │ Enrichment       │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Tool Router                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Tool Registry → Handler Selection → Response Builder       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Response Pipeline                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Token    │→ │ Format   │→ │ Cache    │→ │ Observability    │ │
│  │ Budget   │  │ Response │  │ Response │  │ & Metrics        │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Core Services                                 │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────────┐  │
│  │ Pattern   │ │ Call      │ │ Boundary  │ │ DNA/Styling     │  │
│  │ Store     │ │ Graph     │ │ Store     │ │ Store           │  │
│  └───────────┘ └───────────┘ └───────────┘ └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tool Design Philosophy

### The Layered Tool Pattern

Following Block's proven approach, Drift tools are organized into three conceptual layers:

```
Layer 1: DISCOVERY
  "What capabilities exist? What's the state of the codebase?"
  
Layer 2: EXPLORATION  
  "Tell me more about this specific thing"
  
Layer 3: ACTION
  "Give me what I need to generate code / make decisions"
```

### Tool Taxonomy

#### Layer 1: Discovery Tools (Always Lightweight)
| Tool | Purpose | Max Response Size |
|------|---------|-------------------|
| `drift_status` | Overall health snapshot | ~500 tokens |
| `drift_capabilities` | What can Drift tell me? | ~300 tokens |
| `drift_categories` | List pattern categories | ~200 tokens |

#### Layer 2: Exploration Tools (Paginated, Filterable)
| Tool | Purpose | Default Limit |
|------|---------|---------------|
| `drift_patterns_list` | List patterns with summaries | 20 patterns |
| `drift_files_list` | List files with pattern counts | 30 files |
| `drift_callgraph_overview` | Call graph summary | ~800 tokens |
| `drift_boundaries_overview` | Data access summary | ~600 tokens |
| `drift_security_summary` | Security posture overview | ~700 tokens |

#### Layer 3: Detail Tools (Focused, Complete)
| Tool | Purpose | Behavior |
|------|---------|----------|
| `drift_pattern_get` | Full pattern details | Single pattern, complete |
| `drift_file_patterns` | All patterns in one file | Complete for that file |
| `drift_code_examples` | Code snippets for patterns | 3 examples max by default |
| `drift_impact_analysis` | What breaks if I change X? | Focused on single target |
| `drift_reachability` | What data can code reach? | Single entry point |

---

## Response Format Standard

### Envelope Structure

Every response follows a consistent envelope:

```typescript
interface MCPResponse<T> {
  // Always present
  summary: string;           // 1-2 sentence human-readable summary
  data: T;                   // The actual payload
  
  // Pagination (when applicable)
  pagination?: {
    cursor?: string;         // Opaque cursor for next page
    hasMore: boolean;
    totalCount?: number;     // If known without extra query
    pageSize: number;
  };
  
  // Context hints for AI
  hints?: {
    nextActions?: string[];  // Suggested follow-up tools
    relatedTools?: string[]; // Tools that might help
    warnings?: string[];     // Things to be aware of
  };
  
  // Observability
  meta: {
    requestId: string;
    durationMs: number;
    cached: boolean;
    tokenEstimate: number;   // Estimated tokens in response
  };
}
```

### Example Response

```json
{
  "summary": "Found 47 auth patterns across 23 files. 3 have compliance issues.",
  "data": {
    "patterns": [
      {
        "id": "auth-middleware-jwt",
        "name": "JWT Middleware Pattern",
        "confidence": 0.92,
        "locationCount": 15,
        "status": "approved"
      }
    ]
  },
  "pagination": {
    "cursor": "eyJvZmZzZXQiOjIwfQ==",
    "hasMore": true,
    "totalCount": 47,
    "pageSize": 20
  },
  "hints": {
    "nextActions": [
      "Use drift_pattern_get with id 'auth-middleware-jwt' for full details",
      "Use drift_code_examples with pattern 'auth-middleware-jwt' to see implementations"
    ],
    "warnings": [
      "3 patterns have compliance < 80% - consider reviewing outliers"
    ]
  },
  "meta": {
    "requestId": "req_abc123",
    "durationMs": 45,
    "cached": true,
    "tokenEstimate": 380
  }
}
```

---

## Token Budget Management

### The Problem
AI context windows are finite. A single unbounded response can consume 50%+ of available context, degrading reasoning quality for the rest of the conversation.

### Solution: Token Budget Awareness

```typescript
interface TokenBudgetConfig {
  // Hard limits
  maxResponseTokens: number;      // Default: 4000
  maxSectionTokens: number;       // Default: 1000 per section
  
  // Adaptive behavior
  adaptiveMode: boolean;          // Adjust based on request hints
  preferSummary: boolean;         // When over budget, summarize vs truncate
}

class TokenBudgetManager {
  private estimator: TokenEstimator;
  
  constructor(private config: TokenBudgetConfig) {
    this.estimator = new TokenEstimator();
  }
  
  /**
   * Estimate tokens for a response before serialization
   */
  estimate(data: unknown): number {
    return this.estimator.estimate(JSON.stringify(data));
  }
  
  /**
   * Fit response to budget, preserving most important information
   */
  fitToBudget<T>(response: MCPResponse<T>, budget: number): MCPResponse<T> {
    const estimate = this.estimate(response);
    
    if (estimate <= budget) {
      return response;
    }
    
    // Strategy 1: Reduce pagination size
    if (response.pagination && Array.isArray(response.data)) {
      return this.reducePageSize(response, budget);
    }
    
    // Strategy 2: Summarize nested data
    if (this.config.preferSummary) {
      return this.summarize(response, budget);
    }
    
    // Strategy 3: Truncate with indicator
    return this.truncate(response, budget);
  }
}
```

### Token Estimation

```typescript
class TokenEstimator {
  // Rough heuristic: 1 token ≈ 4 characters for English text
  // JSON structure adds ~20% overhead
  
  estimate(text: string): number {
    const baseTokens = Math.ceil(text.length / 4);
    const structureOverhead = 1.2;
    return Math.ceil(baseTokens * structureOverhead);
  }
  
  estimateObject(obj: unknown): number {
    return this.estimate(JSON.stringify(obj, null, 2));
  }
}
```

---

## Cursor-Based Pagination

### Why Cursors Over Offsets

1. **Stable across mutations** - Adding/removing items doesn't break pagination
2. **Efficient for large datasets** - No need to count total items
3. **Opaque to clients** - Can change implementation without breaking clients

### Implementation

```typescript
interface CursorData {
  // Position markers
  lastId?: string;
  lastScore?: number;
  lastTimestamp?: string;
  
  // Query context (for validation)
  queryHash: string;
  
  // Metadata
  createdAt: number;
  version: number;
}

class CursorManager {
  private readonly VERSION = 1;
  private readonly MAX_AGE_MS = 3600000; // 1 hour
  
  encode(data: CursorData): string {
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }
  
  decode(cursor: string): CursorData | null {
    try {
      const data = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      
      // Validate version
      if (data.version !== this.VERSION) {
        return null;
      }
      
      // Validate age
      if (Date.now() - data.createdAt > this.MAX_AGE_MS) {
        return null;
      }
      
      return data;
    } catch {
      return null;
    }
  }
  
  createForPatterns(lastPattern: Pattern, queryHash: string): string {
    return this.encode({
      lastId: lastPattern.id,
      lastScore: lastPattern.confidence.score,
      queryHash,
      createdAt: Date.now(),
      version: this.VERSION,
    });
  }
}
```

---

## Caching Strategy

### Multi-Level Cache

```typescript
interface CacheConfig {
  l1: {
    maxSize: number;        // In-memory cache size
    ttlMs: number;          // Time to live
  };
  l2?: {
    type: 'redis' | 'file';
    ttlMs: number;
  };
}

class ResponseCache {
  private l1: LRUCache<string, CachedResponse>;
  private l2?: ExternalCache;
  
  async get<T>(key: string): Promise<CachedResponse<T> | null> {
    // Try L1 first
    const l1Result = this.l1.get(key);
    if (l1Result && !this.isStale(l1Result)) {
      return { ...l1Result, source: 'l1' };
    }
    
    // Try L2
    if (this.l2) {
      const l2Result = await this.l2.get(key);
      if (l2Result && !this.isStale(l2Result)) {
        // Promote to L1
        this.l1.set(key, l2Result);
        return { ...l2Result, source: 'l2' };
      }
    }
    
    return null;
  }
  
  /**
   * Generate cache key from tool name and arguments
   */
  generateKey(tool: string, args: Record<string, unknown>): string {
    const normalized = this.normalizeArgs(args);
    const hash = createHash('sha256')
      .update(`${tool}:${JSON.stringify(normalized)}`)
      .digest('hex')
      .slice(0, 16);
    return `drift:${tool}:${hash}`;
  }
  
  /**
   * Invalidate cache when patterns change
   */
  invalidateOnPatternChange(changedCategories: string[]): void {
    // Invalidate all cached responses that depend on changed categories
    for (const [key, value] of this.l1.entries()) {
      if (this.dependsOnCategories(value, changedCategories)) {
        this.l1.delete(key);
      }
    }
  }
}
```

### Cache Invalidation Triggers

| Event | Invalidation Scope |
|-------|-------------------|
| `drift scan` completes | All pattern-related caches |
| Pattern approved/ignored | Specific pattern + related queries |
| Config change | All caches |
| Call graph rebuild | Call graph + security + impact caches |

---

## Error Handling

### Structured Error Responses

```typescript
enum DriftErrorCode {
  // Client errors (4xx equivalent)
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  PATTERN_NOT_FOUND = 'PATTERN_NOT_FOUND',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_CURSOR = 'INVALID_CURSOR',
  
  // Server errors (5xx equivalent)
  SCAN_REQUIRED = 'SCAN_REQUIRED',
  STORE_UNAVAILABLE = 'STORE_UNAVAILABLE',
  ANALYSIS_FAILED = 'ANALYSIS_FAILED',
  
  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',
}

interface DriftError {
  code: DriftErrorCode;
  message: string;
  details?: Record<string, unknown>;
  
  // Recovery hints for AI
  recovery?: {
    suggestion: string;
    alternativeTools?: string[];
    retryAfterMs?: number;
  };
}
```

### Example Error Response

```json
{
  "error": {
    "code": "SCAN_REQUIRED",
    "message": "No pattern data found. The codebase needs to be scanned first.",
    "recovery": {
      "suggestion": "Run 'drift scan' in the project root to analyze patterns",
      "alternativeTools": ["drift_status to check if scan is in progress"]
    }
  },
  "meta": {
    "requestId": "req_xyz789",
    "durationMs": 12
  }
}
```

---

## Observability

### Metrics Collection

```typescript
interface DriftMetrics {
  // Request metrics
  requestCount: Counter;
  requestDuration: Histogram;
  requestErrors: Counter;
  
  // Cache metrics
  cacheHits: Counter;
  cacheMisses: Counter;
  
  // Token metrics
  tokenEstimates: Histogram;
  tokenBudgetExceeded: Counter;
  
  // Business metrics
  patternsQueried: Counter;
  toolUsage: Counter;  // By tool name
}

class MetricsCollector {
  recordRequest(tool: string, duration: number, success: boolean): void {
    this.metrics.requestCount.inc({ tool, success: String(success) });
    this.metrics.requestDuration.observe({ tool }, duration);
    this.metrics.toolUsage.inc({ tool });
  }
  
  recordTokenEstimate(tool: string, tokens: number): void {
    this.metrics.tokenEstimates.observe({ tool }, tokens);
  }
}
```

### Distributed Tracing

```typescript
class RequestTracer {
  startSpan(tool: string, args: Record<string, unknown>): Span {
    return {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      tool,
      startTime: Date.now(),
      events: [],
    };
  }
  
  addEvent(span: Span, name: string, data?: Record<string, unknown>): void {
    span.events.push({
      name,
      timestamp: Date.now(),
      data,
    });
  }
  
  finishSpan(span: Span): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    
    // Export to observability backend
    this.exporter.export(span);
  }
}
```

---

## Security Considerations

### Input Validation

```typescript
import { z } from 'zod';

const PatternQuerySchema = z.object({
  categories: z.array(z.enum([
    'api', 'auth', 'security', 'errors', 'logging',
    'data-access', 'config', 'testing', 'performance',
    'components', 'styling', 'structural', 'types',
    'accessibility', 'documentation'
  ])).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().max(500).optional(),
});

class InputValidator {
  validate<T>(schema: z.ZodSchema<T>, input: unknown): T {
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new DriftError({
        code: DriftErrorCode.INVALID_ARGUMENT,
        message: 'Invalid input parameters',
        details: { errors: result.error.flatten() },
        recovery: {
          suggestion: 'Check parameter types and values against tool schema',
        },
      });
    }
    return result.data;
  }
}
```

### Path Traversal Prevention

```typescript
class PathValidator {
  private projectRoot: string;
  
  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }
  
  validatePath(inputPath: string): string {
    const resolved = path.resolve(this.projectRoot, inputPath);
    
    // Ensure path is within project root
    if (!resolved.startsWith(this.projectRoot)) {
      throw new DriftError({
        code: DriftErrorCode.INVALID_ARGUMENT,
        message: 'Path traversal detected',
        details: { path: inputPath },
      });
    }
    
    return resolved;
  }
}
```

### Rate Limiting

```typescript
class RateLimiter {
  private windows: Map<string, number[]> = new Map();
  
  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000
  ) {}
  
  checkLimit(identifier: string = 'default'): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    let requests = this.windows.get(identifier) || [];
    requests = requests.filter(t => t > windowStart);
    
    if (requests.length >= this.maxRequests) {
      const oldestRequest = requests[0];
      const retryAfter = oldestRequest + this.windowMs - now;
      
      throw new DriftError({
        code: DriftErrorCode.RATE_LIMITED,
        message: 'Rate limit exceeded',
        recovery: {
          suggestion: 'Wait before making more requests',
          retryAfterMs: retryAfter,
        },
      });
    }
    
    requests.push(now);
    this.windows.set(identifier, requests);
  }
}
```

---

## Tool Definitions (Refactored)

### Discovery Layer

```typescript
const DISCOVERY_TOOLS: Tool[] = [
  {
    name: 'drift_status',
    description: 'Get codebase health snapshot. Always call this first to understand the current state. Returns pattern counts, health score, and any critical issues.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'drift_capabilities',
    description: 'List all available Drift capabilities and when to use each tool. Helpful for understanding what questions Drift can answer.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];
```

### Exploration Layer

```typescript
const EXPLORATION_TOOLS: Tool[] = [
  {
    name: 'drift_patterns_list',
    description: 'List patterns with summaries. Use filters to narrow results. Returns pattern IDs for use with drift_pattern_get.',
    inputSchema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by categories (api, auth, security, etc.)',
        },
        status: {
          type: 'string',
          enum: ['all', 'approved', 'discovered', 'ignored'],
          description: 'Filter by approval status (default: all)',
        },
        minConfidence: {
          type: 'number',
          description: 'Minimum confidence 0.0-1.0 (default: 0)',
        },
        limit: {
          type: 'number',
          description: 'Max patterns to return (default: 20, max: 50)',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor from previous response',
        },
      },
      required: [],
    },
  },
  {
    name: 'drift_files_list',
    description: 'List files with pattern counts. Use to find files relevant to a task.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Glob pattern to filter files (e.g., "src/api/**/*.ts")',
        },
        category: {
          type: 'string',
          description: 'Only files with patterns in this category',
        },
        minPatterns: {
          type: 'number',
          description: 'Minimum pattern count (default: 1)',
        },
        limit: {
          type: 'number',
          description: 'Max files to return (default: 30)',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor',
        },
      },
      required: [],
    },
  },
  {
    name: 'drift_security_summary',
    description: 'Get security posture overview. Shows sensitive data access, security patterns, and potential issues.',
    inputSchema: {
      type: 'object',
      properties: {
        focus: {
          type: 'string',
          enum: ['all', 'critical', 'data-access', 'auth'],
          description: 'Focus area (default: all)',
        },
      },
      required: [],
    },
  },
];
```

### Detail Layer

```typescript
const DETAIL_TOOLS: Tool[] = [
  {
    name: 'drift_pattern_get',
    description: 'Get complete details for a single pattern including all locations, outliers, and examples.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Pattern ID from drift_patterns_list',
        },
        includeExamples: {
          type: 'boolean',
          description: 'Include code examples (default: true)',
        },
        maxExamples: {
          type: 'number',
          description: 'Max examples to include (default: 3)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'drift_file_patterns',
    description: 'Get all patterns in a specific file with full context.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to project root',
        },
        category: {
          type: 'string',
          description: 'Filter to specific category',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'drift_code_examples',
    description: 'Get real code examples demonstrating patterns. Use before generating code to match codebase style.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Pattern ID or name to get examples for',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Categories to get examples from',
        },
        maxExamples: {
          type: 'number',
          description: 'Max examples per pattern (default: 3)',
        },
        contextLines: {
          type: 'number',
          description: 'Lines of context around match (default: 10)',
        },
      },
      required: [],
    },
  },
  {
    name: 'drift_impact_analysis',
    description: 'Analyze what breaks if you change a file or function. Shows callers, entry points, and affected data paths.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'File path or function name to analyze',
        },
        maxDepth: {
          type: 'number',
          description: 'Max call chain depth (default: 10)',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'drift_reachability',
    description: 'Find what data a code location can access. Use to understand security implications.',
    inputSchema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'Code location (file:line or function_name)',
        },
        maxDepth: {
          type: 'number',
          description: 'Max traversal depth (default: 10)',
        },
      },
      required: ['location'],
    },
  },
];
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Implement `ResponseBuilder` with envelope structure
- [ ] Implement `TokenEstimator` and `TokenBudgetManager`
- [ ] Implement `CursorManager` for pagination
- [ ] Implement structured error handling
- [ ] Add request/response logging

### Phase 2: Tool Refactoring (Week 3-4)
- [ ] Split monolithic tools into layered pattern
- [ ] Implement discovery tools (`drift_status`, `drift_capabilities`)
- [ ] Refactor exploration tools with pagination
- [ ] Refactor detail tools with focused responses
- [ ] Update tool descriptions for AI clarity

### Phase 3: Caching & Performance (Week 5)
- [ ] Implement `ResponseCache` with L1/L2
- [ ] Add cache invalidation on pattern changes
- [ ] Implement request deduplication
- [ ] Add performance metrics

### Phase 4: Observability & Security (Week 6)
- [ ] Implement metrics collection
- [ ] Add distributed tracing
- [ ] Implement rate limiting
- [ ] Add input validation with Zod
- [ ] Security audit

### Phase 5: Polish & Documentation (Week 7)
- [ ] Update MCP README with new tool structure
- [ ] Add usage examples for each tool
- [ ] Performance testing
- [ ] Documentation for enterprise deployment

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Average response tokens | < 1000 | Token estimator |
| Cache hit rate | > 60% | Cache metrics |
| P95 response time | < 200ms | Request duration histogram |
| Error rate | < 1% | Error counter |
| Tool selection accuracy | > 90% | Manual evaluation |

---

## Appendix: Token Budget Guidelines

| Tool Type | Target Tokens | Max Tokens |
|-----------|---------------|------------|
| Discovery | 300-500 | 800 |
| Exploration (list) | 500-1000 | 2000 |
| Detail (single item) | 800-1500 | 3000 |
| Code examples | 1000-2000 | 4000 |
| Analysis (impact/security) | 1000-2000 | 4000 |

---

## References

- [MCP Specification](https://modelcontextprotocol.io)
- [Block's Layered Tool Pattern](https://developer.squareup.com/blog/mcp-layered-tools)
- [Glama: Running Efficient MCP Servers](https://glama.ai/blog/2025-09-18-running-efficient-mcp-servers-in-production)
- [WorkOS: Enterprise MCP Servers](https://workos.com/blog/making-mcp-servers-enterprise-ready)


---

## Implementation Status

### Phase 1: Core Infrastructure ✅

The following infrastructure components have been implemented in `drift/packages/mcp/src/infrastructure/`:

| Component | File | Status |
|-----------|------|--------|
| Response Builder | `response-builder.ts` | ✅ Complete |
| Token Estimator | `token-estimator.ts` | ✅ Complete |
| Cursor Manager | `cursor-manager.ts` | ✅ Complete |
| Error Handler | `error-handler.ts` | ✅ Complete |
| Response Cache | `cache.ts` | ✅ Complete |
| Rate Limiter | `rate-limiter.ts` | ✅ Complete |
| Metrics Collector | `metrics.ts` | ✅ Complete |

### Phase 2: Layered Tools ✅

#### Discovery Layer (Layer 1)
| Tool | File | Status |
|------|------|--------|
| `drift_status` | `tools/discovery/status.ts` | ✅ Complete |
| `drift_capabilities` | `tools/discovery/capabilities.ts` | ✅ Complete |

#### Exploration Layer (Layer 2)
| Tool | File | Status |
|------|------|--------|
| `drift_patterns_list` | `tools/exploration/patterns-list.ts` | ✅ Complete |
| `drift_security_summary` | `tools/exploration/security-summary.ts` | ✅ Complete |
| `drift_contracts_list` | `tools/exploration/contracts-list.ts` | ✅ Complete |
| `drift_trends` | `tools/exploration/trends.ts` | ✅ Complete |

#### Detail Layer (Layer 3)
| Tool | File | Status |
|------|------|--------|
| `drift_pattern_get` | `tools/detail/pattern-get.ts` | ✅ Complete |
| `drift_code_examples` | `tools/detail/code-examples.ts` | ✅ Complete |
| `drift_files_list` | `tools/detail/files-list.ts` | ✅ Complete |
| `drift_file_patterns` | `tools/detail/file-patterns.ts` | ✅ Complete |
| `drift_impact_analysis` | `tools/detail/impact-analysis.ts` | ✅ Complete |
| `drift_reachability` | `tools/detail/reachability.ts` | ✅ Complete |
| `drift_dna_profile` | `tools/detail/dna-profile.ts` | ✅ Complete |

### Phase 3: Enterprise Server ✅

The enterprise server is implemented in `drift/packages/mcp/src/enterprise-server.ts` with:
- Layered tool routing (Discovery → Exploration → Detail)
- Response caching with automatic invalidation
- Rate limiting (sliding window)
- Metrics collection (Prometheus-compatible)
- Structured error handling with recovery hints
- Token budget awareness

### Tool Summary

**14 Enterprise Tools Implemented:**

| Layer | Tools | Purpose |
|-------|-------|---------|
| Orchestration (1) | `drift_context` | **THE FINAL BOSS** - Intent-aware context synthesis |
| Discovery (2) | `drift_status`, `drift_capabilities` | Quick health checks, tool guidance |
| Exploration (4) | `drift_patterns_list`, `drift_security_summary`, `drift_contracts_list`, `drift_trends` | Paginated browsing, summaries |
| Detail (7) | `drift_pattern_get`, `drift_code_examples`, `drift_files_list`, `drift_file_patterns`, `drift_impact_analysis`, `drift_reachability`, `drift_dna_profile` | Deep inspection, analysis |

### The Final Boss: `drift_context`

The crown jewel of the enterprise server. Instead of making the AI figure out which tools to call and how to synthesize results, `drift_context` understands the AI's intent and returns a curated context package.

**Input:**
```json
{
  "intent": "add_feature",
  "focus": "user authentication",
  "question": "How do I add OAuth support?"
}
```

**Output:**
```json
{
  "summary": "Adding feature in 'user authentication'. Found 5 relevant patterns...",
  "relevantPatterns": [
    {
      "id": "auth-middleware-jwt",
      "name": "JWT Middleware Pattern",
      "why": "Directly related to authentication - this is the established pattern",
      "example": "// Real code from the codebase...",
      "confidence": 0.92
    }
  ],
  "suggestedFiles": [
    {
      "file": "src/auth/middleware.ts",
      "reason": "Matches focus area",
      "patterns": ["JWT Middleware", "Error Handler"],
      "risk": "medium"
    }
  ],
  "guidance": {
    "keyInsights": [
      "This codebase uses middleware-based auth, not decorator-based",
      "Error handling patterns exist - use the established error types"
    ],
    "commonMistakes": [
      "Don't create new patterns when existing ones apply",
      "Remember to add appropriate logging"
    ],
    "decisionPoints": [
      "Decide if this feature needs its own module or fits in existing structure"
    ]
  },
  "warnings": [
    {
      "type": "data_access",
      "message": "src/auth/middleware.ts accesses sensitive data: users.password_hash",
      "severity": "warning"
    }
  ],
  "confidence": {
    "patternCoverage": 80,
    "dataFreshness": "Current session",
    "limitations": []
  },
  "deeperDive": [
    {
      "tool": "drift_code_examples",
      "args": { "pattern": "auth-middleware-jwt" },
      "reason": "See more examples of JWT Middleware pattern"
    }
  ]
}
```

**Why This Is The Final Boss:**
1. **Intent-Aware** - Understands "add_feature" vs "fix_bug" vs "security_audit" and tailors response
2. **Synthesizes Context** - Pulls from patterns, files, boundaries, and call graph
3. **Provides Reasoning Scaffolds** - Teaches the AI how to think about this codebase
4. **Includes Confidence Signals** - AI knows when to trust vs verify
5. **Suggests Next Steps** - If more info needed, tells AI exactly what to call

### Key Features

1. **Consistent Response Envelope** - All responses include summary, data, pagination, hints, and meta
2. **Token Budget Management** - Responses fit within configurable token limits
3. **Cursor-Based Pagination** - Stable pagination across mutations
4. **AI-Friendly Hints** - Every response suggests next actions and related tools
5. **Structured Errors** - Errors include recovery suggestions for AI agents
6. **Multi-Level Caching** - L1 in-memory + L2 file-based caching
7. **Rate Limiting** - Sliding window rate limiting per tool
8. **Observability** - Request metrics, cache stats, error tracking


---

## Deployment Status ✅ COMPLETE

**Date:** January 21, 2026

### What's Deployed

The enterprise MCP server is now the **default server** when running `drift-mcp`:

```bash
# Enterprise server (default)
drift-mcp /path/to/project

# With options
drift-mcp /path/to/project --no-cache --no-rate-limit

# Legacy v1 server (backward compatibility)
drift-mcp /path/to/project --legacy
```

### Files Changed

| File | Change |
|------|--------|
| `src/index.ts` | Now exports both enterprise and legacy servers |
| `src/bin/server.ts` | Uses enterprise server by default |
| `src/enterprise-server.ts` | Main enterprise server implementation |
| `src/infrastructure/*` | All infrastructure components |
| `src/tools/orchestration/*` | The "final boss" drift_context tool |
| `src/tools/discovery/*` | Discovery layer tools |
| `src/tools/exploration/*` | Exploration layer tools |
| `src/tools/detail/*` | Detail layer tools |

### Exports Available

```typescript
// Enterprise Server (v2) - Recommended
import { 
  createEnterpriseMCPServer,
  getAllTools,
  getToolCategories,
} from 'driftdetect-mcp';

// Legacy Server (v1) - Backward compatibility
import { createDriftMCPServer } from 'driftdetect-mcp';

// Infrastructure (for custom implementations)
import {
  createResponseBuilder,
  TokenEstimator,
  CursorManager,
  DriftError,
  Errors,
  createCache,
  rateLimiter,
  metrics,
} from 'driftdetect-mcp';
```

### Testing

Run the test script to verify the server:

```bash
cd packages/mcp
npm run build
node test-enterprise.mjs
```

### MCP Configuration

Update your `mcp.json` to use the enterprise server:

```json
{
  "mcpServers": {
    "drift": {
      "command": "npx",
      "args": ["driftdetect-mcp", "/path/to/your/project"]
    }
  }
}
```

The enterprise server is now live and ready for production use.
