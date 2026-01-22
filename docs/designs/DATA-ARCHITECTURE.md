# Drift Data Architecture

## Single Source of Truth

The `.drift/` folder is the single source of truth for all drift data. The **Data Lake** (`DataLake` class) is the central aggregation layer that all consumers use for reading data.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WRITE PATH                                     │
│                                                                          │
│   drift scan ──► PatternStore ──► .drift/patterns/{status}/{category}.json
│              ──► ContractStore ──► .drift/contracts/{status}/
│              ──► BoundaryStore ──► .drift/boundaries/access-map.json
│              ──► CallGraphStore ──► .drift/call-graph/
│              ──► HistoryStore ──► .drift/history/snapshots/
│              ──► DNAStore ──► .drift/dna/
│                                                                          │
│   After scan: DataLake.materializer ──► .drift/lake/ (optimized views)   │
│               DataLake.patternShards.saveAll() ──► .drift/lake/patterns/ │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           READ PATH                                      │
│                                                                          │
│   MCP/Dashboard/CLI                                                      │
│         │                                                                │
│         ▼                                                                │
│   ┌─────────────┐    cache hit    ┌─────────────────┐                   │
│   │  DataLake   │ ◄──────────────►│ .drift/lake/    │                   │
│   │  (primary)  │                 │ (pre-computed)  │                   │
│   └──────┬──────┘                 └─────────────────┘                   │
│          │ cache miss / stale                                            │
│          ▼                                                               │
│   ┌─────────────┐                 ┌─────────────────┐                   │
│   │ Source      │ ◄──────────────►│ .drift/patterns/│                   │
│   │ Stores      │                 │ .drift/contracts│                   │
│   │ (fallback)  │                 │ .drift/boundaries                   │
│   └─────────────┘                 └─────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Storage Structure

### Source of Truth (Authoritative)
```
.drift/
├── config.json                    # Project configuration
├── patterns/
│   ├── discovered/{category}.json # Auto-discovered patterns
│   ├── approved/{category}.json   # User-approved patterns
│   └── ignored/{category}.json    # User-ignored patterns
├── contracts/
│   ├── discovered/                # Found API contracts
│   ├── verified/                  # Verified contracts
│   └── mismatch/                  # Contracts with issues
├── boundaries/
│   └── access-map.json            # Data access points
├── call-graph/
│   └── graph.json                 # Function call relationships
├── history/
│   └── snapshots/{date}.json      # Daily pattern snapshots
└── dna/
    └── styling.json               # Styling DNA profile
```

### Optimized Read Layer (Data Lake)
```
.drift/lake/
├── manifest.json                  # Quick-load index (instant status)
├── views/
│   ├── status.json                # Pre-computed status view
│   ├── pattern-index.json         # Pattern listing view
│   ├── security-summary.json      # Security overview
│   └── trends.json                # Trend analysis
├── indexes/
│   ├── by-file.json               # File → patterns mapping
│   ├── by-category.json           # Category → patterns mapping
│   └── by-table.json              # Table → access points mapping
├── patterns/
│   └── {category}.json            # Sharded patterns by category
├── security/
│   ├── index.json                 # Security summary
│   └── tables/{table}.json        # Per-table access data
├── examples/
│   └── patterns/{id}.json         # Pre-extracted code examples
└── callgraph/
    ├── index.json                 # Call graph summary
    └── files/{hash}.json          # Per-file function data
```

## Key Principles

### 1. DataLake is the Central Aggregation Layer
- All consumers (MCP, CLI, Dashboard) use `DataLake` for reading
- `DataLake` provides unified query API via `dataLake.query.*`
- Automatically uses pre-computed views when available
- Falls back to source stores when views are stale/missing

### 2. Source Stores Handle Writes
- `PatternStore`, `ContractStore`, `BoundaryStore`, etc. own the data
- All writes go through these stores
- They read/write to `.drift/{domain}/` directories

### 3. Lake is Materialized After Scans
- CLI scan calls `dataLake.materializer.materialize()` after saving patterns
- Also calls `dataLake.patternShards.saveAll()` for category-based queries
- Views, indexes, and shards are rebuilt from source data

### 4. Consumers Use Lake-First Pattern
```typescript
// MCP/Dashboard pattern:
async function getData(store: PatternStore, dataLake: DataLake) {
  // Try lake first (fast, pre-computed)
  const cached = await dataLake.query.getStatus();
  if (cached) return cached;
  
  // Fallback to source store (slower but always works)
  await store.initialize();
  return computeFromStore(store);
}
```

## Consumer Integration

### CLI
- **Writes**: Uses source stores directly (`PatternStore.add()`, etc.)
- **After scan**: Calls `DataLake.materializer.materialize()` to populate lake
- **Reads**: Can use `DataLake` for queries (status, patterns, etc.)

### MCP Server
- **Writes**: None (read-only)
- **Reads**: Uses `DataLake` as primary source with store fallback
- **Tools**: `drift_status`, `drift_patterns_list`, `drift_security_summary`, etc.
- **Features**: Caching, rate limiting, metrics, cursor-based pagination

### Dashboard
- **Writes**: Pattern approval/ignore via source stores (direct file operations)
- **Reads**: Uses `DataLake` for optimized reads via `DriftDataReader`
  - `getStats()` - Uses `dataLake.query.getStatus()` for instant health/pattern stats
  - `getPatterns()` - Uses `dataLake.query.getPatterns()` for fast pattern listing
  - `getTrends()` - Uses `dataLake.views.getTrendsView()` for pre-computed trends
- **Fallback**: Falls back to direct file reading when lake data unavailable

### VSCode Extension
- **Writes**: None (read-only)
- **Reads**: Uses LSP which uses source stores
- **TODO**: Could benefit from lake for faster diagnostics

## Performance Benefits

| Operation | Without Lake | With Lake |
|-----------|-------------|-----------|
| `drift_status` | 200-500ms | <10ms |
| `drift_patterns_list` | 100-300ms | <20ms |
| `drift_security_summary` | 500-2000ms | <50ms |
| `drift_code_examples` | 1000-5000ms | <100ms |
| Memory (large codebase) | 500MB+ | <100MB |

## Staleness Detection

- Lake views have timestamps and checksums
- Manifest tracks which views are stale
- Stale views trigger fallback to source stores
- Running `drift scan` rebuilds all views
