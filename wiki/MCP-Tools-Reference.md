# MCP Tools Reference

Complete reference for all 24 Drift MCP tools.

## Tool Layers

Drift organizes tools in layers for efficient token usage:

1. **Orchestration** — Start here for most tasks
2. **Discovery** — Quick overview of codebase
3. **Exploration** — Browse patterns and security
4. **Detail** — Deep dives into specific patterns
5. **Analysis** — Code health metrics
6. **Generation** — AI-assisted changes

---

## Layer 1: Orchestration

### `drift_context`

**The recommended starting point.** Returns curated context based on your intent.

```json
{
  "intent": "add_feature",
  "focus": "user authentication",
  "question": "How do I add a new auth endpoint?",
  "project": "backend"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `intent` | enum | Yes | `add_feature`, `fix_bug`, `refactor`, `security_audit`, `understand_code`, `add_test` |
| `focus` | string | Yes | Area or feature you're working with |
| `question` | string | No | Specific question to answer |
| `project` | string | No | Target project name |

**Returns:** Relevant patterns, examples, files to modify, warnings, and guidance.

---

## Layer 2: Discovery

### `drift_status`

Get codebase health snapshot. Always fast, always lightweight.

```json
{}
```

No parameters required.

**Returns:** Pattern counts, health score, critical issues.

### `drift_capabilities`

List all Drift capabilities.

```json
{}
```

**Returns:** Guide to available tools organized by purpose.

### `drift_projects`

Manage registered projects.

```json
{
  "action": "list",
  "project": "backend",
  "path": "/path/to/project"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | No | `list`, `info`, `switch`, `recent`, `register` |
| `project` | string | No | Project name (for info/switch) |
| `path` | string | No | Project path (for register) |

---

## Layer 3: Exploration

### `drift_patterns_list`

List patterns with summaries.

```json
{
  "categories": ["api", "auth"],
  "status": "approved",
  "minConfidence": 0.8,
  "search": "controller",
  "limit": 20
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `categories` | array | No | Filter by categories |
| `status` | enum | No | `all`, `approved`, `discovered`, `ignored` |
| `minConfidence` | number | No | Minimum confidence 0.0-1.0 |
| `search` | string | No | Search pattern names |
| `limit` | number | No | Max results (default: 20) |
| `cursor` | string | No | Pagination cursor |

### `drift_security_summary`

Security posture overview.

```json
{
  "focus": "critical",
  "limit": 10
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `focus` | enum | No | `all`, `critical`, `data-access`, `auth` |
| `limit` | number | No | Max items per section |

### `drift_contracts_list`

API contracts between frontend and backend.

```json
{
  "status": "mismatch",
  "limit": 20
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | enum | No | `all`, `verified`, `mismatch`, `discovered` |
| `limit` | number | No | Max results |
| `cursor` | string | No | Pagination cursor |

### `drift_trends`

Pattern trend analysis.

```json
{
  "period": "30d",
  "category": "security",
  "severity": "critical"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period` | enum | No | `7d`, `30d`, `90d` |
| `category` | string | No | Filter by category |
| `severity` | enum | No | `all`, `critical`, `warning` |

---

## Layer 4: Detail

### `drift_pattern_get`

Complete details for a specific pattern.

```json
{
  "id": "api-rest-controller-pattern",
  "includeLocations": true,
  "includeOutliers": true,
  "maxLocations": 20
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Pattern ID |
| `includeLocations` | boolean | No | Include all locations |
| `includeOutliers` | boolean | No | Include outlier details |
| `maxLocations` | number | No | Max locations to return |

### `drift_code_examples`

Real code examples for patterns.

```json
{
  "categories": ["api", "errors"],
  "pattern": "error-handling-try-catch",
  "maxExamples": 3,
  "contextLines": 10
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `categories` | array | No | Categories to get examples for |
| `pattern` | string | No | Specific pattern name or ID |
| `maxExamples` | number | No | Max examples per pattern |
| `contextLines` | number | No | Lines of context |

### `drift_files_list`

List files with patterns.

```json
{
  "path": "src/api/**/*.ts",
  "category": "api",
  "limit": 20
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | No | Glob pattern |
| `category` | string | No | Filter by category |
| `limit` | number | No | Max files |
| `cursor` | string | No | Pagination cursor |

### `drift_file_patterns`

All patterns in a specific file.

```json
{
  "file": "src/api/users.controller.ts",
  "category": "api"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | string | Yes | File path |
| `category` | string | No | Filter by category |

### `drift_impact_analysis`

Analyze impact of changing a file or function.

```json
{
  "target": "src/auth/login.ts",
  "maxDepth": 10,
  "limit": 10
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `target` | string | Yes | File path or function name |
| `maxDepth` | number | No | Max call depth |
| `limit` | number | No | Max items per section |

### `drift_reachability`

Data reachability analysis.

```json
{
  "direction": "forward",
  "location": "src/api/users.ts:42",
  "target": "users.password_hash",
  "maxDepth": 10,
  "sensitiveOnly": true
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `direction` | enum | No | `forward` (what can code access) or `inverse` (who can access data) |
| `location` | string | No | For forward: file:line or function |
| `target` | string | No | For inverse: table or table.field |
| `maxDepth` | number | No | Max traversal depth |
| `sensitiveOnly` | boolean | No | Only show sensitive data |

### `drift_dna_profile`

Styling DNA profile.

```json
{
  "gene": "variant-handling"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `gene` | enum | No | `variant-handling`, `responsive-approach`, `state-styling`, `theming`, `spacing-philosophy`, `animation-approach` |

### `drift_wrappers`

Framework wrapper detection.

```json
{
  "category": "data-fetching",
  "minConfidence": 0.5,
  "minClusterSize": 2,
  "includeTests": false
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | enum | No | Wrapper category |
| `minConfidence` | number | No | Minimum confidence 0-1 |
| `minClusterSize` | number | No | Minimum wrappers per cluster |
| `maxDepth` | number | No | Max wrapper depth |
| `includeTests` | boolean | No | Include test files |

---

## Layer 5: Analysis

### `drift_test_topology`

Test-to-code mapping analysis.

```json
{
  "action": "affected",
  "files": ["src/auth/login.ts", "src/auth/logout.ts"],
  "file": "src/api/users.ts",
  "limit": 20,
  "minRisk": "medium"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | Yes | `status`, `coverage`, `uncovered`, `mocks`, `affected`, `quality` |
| `file` | string | No | File for coverage/quality |
| `files` | array | No | Changed files for affected |
| `limit` | number | No | Max results |
| `minRisk` | enum | No | `low`, `medium`, `high` |

### `drift_coupling`

Module dependency analysis.

```json
{
  "action": "cycles",
  "module": "src/auth",
  "limit": 15,
  "minCoupling": 3,
  "maxCycleLength": 10,
  "minSeverity": "warning"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | Yes | `status`, `cycles`, `hotspots`, `analyze`, `refactor-impact`, `unused-exports` |
| `module` | string | No | Module path for analyze/refactor-impact |
| `limit` | number | No | Max results |
| `minCoupling` | number | No | Min coupling threshold |
| `maxCycleLength` | number | No | Max cycle length |
| `minSeverity` | enum | No | `info`, `warning`, `critical` |

### `drift_error_handling`

Error handling pattern analysis.

```json
{
  "action": "gaps",
  "function": "handleLogin",
  "limit": 20,
  "minSeverity": "medium"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | Yes | `status`, `gaps`, `boundaries`, `unhandled`, `analyze` |
| `function` | string | No | Function for analyze |
| `limit` | number | No | Max results |
| `minSeverity` | enum | No | `low`, `medium`, `high`, `critical` |

### `drift_constants`

Analyze constants, enums, and exported values. Detects hardcoded secrets, inconsistent values, and magic numbers.

```json
{
  "action": "status"
}
```

**Actions:**

| Action | Description |
|--------|-------------|
| `status` | Overview of constants by category and language |
| `list` | List constants with filtering |
| `get` | Get constant details |
| `usages` | Find references to a constant |
| `magic` | Find magic values that should be constants |
| `dead` | Find unused constants |
| `secrets` | Detect potential hardcoded secrets |
| `inconsistent` | Find constants with inconsistent values |

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | No | Action to perform (default: `status`) |
| `category` | enum | No | Filter by category: `config`, `api`, `status`, `error`, `feature_flag`, `limit`, `regex`, `path`, `env`, `security`, `uncategorized` |
| `language` | enum | No | Filter by language: `typescript`, `javascript`, `python`, `java`, `csharp`, `php`, `go` |
| `file` | string | No | Filter by file path |
| `search` | string | No | Search constant names |
| `exported` | boolean | No | Filter by exported status |
| `id` | string | No | Constant ID for get/usages |
| `name` | string | No | Constant name for get/usages |
| `severity` | enum | No | Min severity for secrets: `info`, `low`, `medium`, `high`, `critical` |
| `limit` | number | No | Max results (default: 20, max: 50) |
| `cursor` | string | No | Pagination cursor |

**Example - Find hardcoded secrets:**
```json
{
  "action": "secrets",
  "severity": "high"
}
```

**Example - List API constants:**
```json
{
  "action": "list",
  "category": "api",
  "language": "typescript"
}
```

---

## Layer 6: Generation

### `drift_suggest_changes`

AI-guided fix suggestions.

```json
{
  "target": "src/api/users.ts",
  "issue": "outlier",
  "patternId": "api-rest-controller",
  "maxSuggestions": 3
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `target` | string | Yes | File or function to analyze |
| `issue` | enum | No | `outlier`, `security`, `coupling`, `error-handling`, `test-coverage`, `pattern-violation` |
| `patternId` | string | No | Pattern ID for outlier issues |
| `maxSuggestions` | number | No | Max suggestions |

### `drift_validate_change`

Validate proposed changes against patterns.

```json
{
  "file": "src/api/users.ts",
  "content": "// new code here",
  "diff": "--- a/file\n+++ b/file\n...",
  "strictMode": false
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | string | Yes | File path |
| `content` | string | No | Proposed code content |
| `diff` | string | No | Unified diff format |
| `strictMode` | boolean | No | Fail on any violation |

### `drift_explain`

Comprehensive code explanation.

```json
{
  "target": "src/auth/middleware.ts",
  "depth": "comprehensive",
  "focus": "security"
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `target` | string | Yes | File, function, or symbol |
| `depth` | enum | No | `summary`, `detailed`, `comprehensive` |
| `focus` | string | No | `security`, `performance`, `architecture`, `testing` |
