# Data Storage Optimization for Enterprise MCP Server

## Current State Analysis

### Current `.drift/` Structure
```
.drift/
├── config.json                    # Project configuration
├── boundaries/
│   ├── access-map.json           # Data access points (can be HUGE)
│   └── rules.json                # User-defined boundary rules
├── cache/                         # Empty - unused
├── contracts/
│   ├── discovered/               # API contracts found
│   ├── ignored/                  # User-ignored contracts
│   ├── mismatch/                 # Frontend/backend mismatches
│   └── verified/                 # Verified contracts
├── history/
│   └── snapshots/                # Daily pattern snapshots
│       ├── 2026-01-14.json
│       └── 2026-01-21.json
├── index/                         # Empty - unused
├── patterns/
│   ├── approved/                 # User-approved patterns
│   │   └── {category}.json
│   ├── discovered/               # Auto-discovered patterns
│   │   └── {category}.json
│   ├── ignored/                  # User-ignored patterns
│   │   └── {category}.json
│   └── variants/                 # Pattern variants
└── reports/                       # Empty - unused
```

### Problems with Current Structure

1. **Flat JSON Files Get Huge**
   - `access-map.json` can be 10MB+ for large codebases
   - Pattern files grow unbounded
   - Loading entire files into memory is slow

2. **No Query Optimization**
   - Every query loads full files
   - No indexing for common queries
   - Pagination requires loading everything first

3. **Scattered Related Data**
   - Patterns in `/patterns/`
   - Their examples scattered in source files
   - Call graph in `/call-graph/`
   - No easy way to get "everything about X"

4. **Unused Directories**
   - `cache/`, `index/`, `reports/` are empty
   - No clear purpose defined

5. **No MCP-Specific Optimization**
   - Data not structured for common MCP queries
   - No pre-computed aggregations
   - No cursor-friendly storage

---

## Proposed Structure

### New `.drift/` Layout
```
.drift/
├── config.json                    # Project configuration
├── manifest.json                  # Quick-load index of everything
│
├── patterns/
│   ├── index.json                # Pattern index (IDs, names, categories, confidence)
│   ├── by-category/
│   │   └── {category}.json       # Patterns grouped by category
│   ├── by-file/
│   │   └── {file-hash}.json      # Patterns grouped by file
│   └── examples/
│       └── {pattern-id}.json     # Pre-extracted code examples
│
├── security/
│   ├── index.json                # Security summary (pre-computed)
│   ├── access-map/
│   │   ├── by-table/
│   │   │   └── {table}.json      # Access points per table
│   │   └── by-file/
│   │       └── {file-hash}.json  # Access points per file
│   ├── sensitive-fields.json     # Sensitive field registry
│   └── violations.json           # Current violations
│
├── call-graph/
│   ├── index.json                # Call graph summary
│   ├── nodes/
│   │   └── {function-hash}.json  # Individual function nodes
│   ├── edges.json                # Call relationships
│   └── entry-points.json         # API entry points
│
├── contracts/
│   ├── index.json                # Contract summary
│   ├── verified/
│   ├── mismatch/
│   └── discovered/
│
├── dna/
│   ├── profile.json              # Styling DNA profile
│   ├── playbook.md               # Generated playbook
│   └── mutations.json            # Style mutations
│
├── history/
│   ├── snapshots/
│   │   └── {date}.json
│   └── trends.json               # Pre-computed trends
│
└── mcp/
    ├── cache/
    │   └── {query-hash}.json     # Cached MCP responses
    ├── cursors/
    │   └── {cursor-id}.json      # Pagination state
    └── metrics.json              # Usage metrics
```

---

## Key Changes

### 1. Add `manifest.json` - The Quick-Load Index

```typescript
interface DriftManifest {
  version: string;
  generatedAt: string;
  projectRoot: string;
  
  // Quick stats for drift_status
  stats: {
    patterns: {
      total: number;
      byCategory: Record<string, number>;
      byStatus: Record<string, number>;
      byConfidence: Record<string, number>;
    };
    security: {
      totalTables: number;
      totalAccessPoints: number;
      sensitiveFields: number;
      violations: number;
    };
    callGraph: {
      totalFunctions: number;
      totalCalls: number;
      entryPoints: number;
    };
    contracts: {
      verified: number;
      mismatch: number;
      discovered: number;
    };
  };
  
  // File hashes for cache invalidation
  fileHashes: Record<string, string>;
  
  // Last scan info
  lastScan: {
    timestamp: string;
    duration: number;
    filesScanned: number;
  };
}
```

**Why:** `drift_status` can return instantly by reading just this file.

### 2. Split Large Files by Key

Instead of one giant `access-map.json`:

```
security/access-map/
├── by-table/
│   ├── users.json          # All access to users table
│   ├── orders.json         # All access to orders table
│   └── ...
└── by-file/
    ├── a1b2c3.json         # Access points in src/api/users.ts
    └── ...
```

**Why:** 
- `drift_reachability` for a specific table loads only that file
- `drift_file_patterns` loads only that file's data
- Pagination is natural (one file = one page)

### 3. Pre-Extract Code Examples

```
patterns/examples/
├── auth-middleware-jwt.json
├── error-boundary-react.json
└── ...
```

Each file contains:
```typescript
interface PatternExamples {
  patternId: string;
  patternName: string;
  examples: Array<{
    file: string;
    line: number;
    code: string;           // Pre-extracted snippet
    context: string;        // Surrounding code
    quality: number;        // Example quality score
  }>;
  lastUpdated: string;
}
```

**Why:** `drift_code_examples` doesn't need to read source files at runtime.

### 4. Pre-Compute Aggregations

```typescript
// security/index.json
interface SecurityIndex {
  summary: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    totalTables: number;
    sensitiveTablesCount: number;
    violationCount: number;
  };
  
  // Top items for quick display
  topSensitiveTables: Array<{
    table: string;
    sensitiveFields: number;
    accessPoints: number;
  }>;
  
  topViolations: Array<{
    id: string;
    severity: string;
    message: string;
  }>;
  
  // Pointers to detailed files
  tableFiles: Record<string, string>;  // table -> file path
}
```

**Why:** `drift_security_summary` returns instantly.

### 5. MCP-Specific Cache Directory

```
mcp/
├── cache/
│   ├── drift_status_abc123.json
│   ├── drift_patterns_list_def456.json
│   └── ...
├── cursors/
│   └── cur_xyz789.json
└── metrics.json
```

**Why:** 
- MCP server has its own cache separate from core
- Cursor state persists across requests
- Metrics tracked for optimization

---

## Migration Strategy

### Phase 1: Add Manifest (Non-Breaking)
1. Generate `manifest.json` during scan
2. Update `drift_status` to read manifest first
3. Fall back to current behavior if manifest missing

### Phase 2: Split Security Data
1. During scan, write both old and new format
2. Update MCP tools to prefer new format
3. Keep old format for backward compatibility

### Phase 3: Pre-Extract Examples
1. Add example extraction to scan pipeline
2. Update `drift_code_examples` to use pre-extracted
3. Fall back to runtime extraction if missing

### Phase 4: Full Migration
1. Remove old format writes
2. Add migration command for existing projects
3. Update documentation

---

## Implementation Priority

| Change | Impact | Effort | Priority |
|--------|--------|--------|----------|
| Add manifest.json | High (instant status) | Low | 1 |
| Pre-compute security index | High (instant security) | Medium | 2 |
| Split access-map by table | High (fast reachability) | Medium | 3 |
| Pre-extract examples | Medium (faster examples) | Medium | 4 |
| MCP cache directory | Medium (persistence) | Low | 5 |
| Split patterns by file | Low (already fast) | Medium | 6 |

---

## API Changes Required

### PatternStore
```typescript
// Add method to get pattern index only
getIndex(): PatternIndex;

// Add method to get patterns for specific file
getByFileHash(hash: string): Pattern[];
```

### BoundaryStore
```typescript
// Add method to get security summary
getSecurityIndex(): SecurityIndex;

// Add method to get table-specific data
getTableData(table: string): TableAccessData;
```

### New: ManifestStore
```typescript
class ManifestStore {
  // Quick load of project stats
  getStats(): ProjectStats;
  
  // Check if data is stale
  isStale(): boolean;
  
  // Get file hash for cache invalidation
  getFileHash(file: string): string | null;
}
```

---

## Estimated Impact

| Metric | Current | After Optimization |
|--------|---------|-------------------|
| `drift_status` response time | 200-500ms | <10ms |
| `drift_security_summary` response time | 500-2000ms | <50ms |
| `drift_code_examples` response time | 1000-5000ms | <100ms |
| Memory usage (large codebase) | 500MB+ | <100MB |
| Cold start time | 2-5s | <500ms |

---

## Decision: Should We Do This?

### YES, because:
1. **Enterprise MCP server is designed for this** - The layered tools expect fast data access
2. **Current structure doesn't scale** - Large codebases hit memory limits
3. **AI agents are impatient** - Slow responses degrade task completion
4. **Pre-computation is cheap** - Scan already does the work, just store smarter

### Phased approach:
1. **Start with manifest.json** - Biggest bang for buck, minimal risk
2. **Add security index** - Second biggest impact
3. **Evaluate before continuing** - Measure actual improvement

### NOT a breaking change:
- All changes are additive
- Old format still works
- Migration is optional

---

## Next Steps

1. [ ] Implement `ManifestStore` with `manifest.json` generation
2. [ ] Update `drift scan` to generate manifest
3. [ ] Update `drift_status` to use manifest
4. [ ] Measure improvement
5. [ ] Decide on Phase 2
