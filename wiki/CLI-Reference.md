# CLI Reference

Complete reference for all 28 Drift CLI commands.

## Core Commands

### `drift init`

Initialize Drift in a project.

```bash
drift init [options]

Options:
  --from-scaffold    Initialize from scaffold config
  --yes, -y          Skip confirmation prompts
```

### `drift scan`

Scan codebase for patterns.

```bash
drift scan [path] [options]

Options:
  --manifest         Generate manifest file
  --incremental      Only scan changed files
  --contracts        Detect API contracts
  --boundaries       Scan data access boundaries
  --project <name>   Target specific project
  --timeout <ms>     Scan timeout in milliseconds
```

### `drift check`

Check for violations against approved patterns.

```bash
drift check [options]

Options:
  --staged           Only check staged files
  --ci               CI mode (exit code on violations)
  --format <type>    Output format: text, json, github, gitlab
  --fail-on <level>  Fail on: error, warning, info
```

### `drift status`

Show current drift status.

```bash
drift status [options]

Options:
  --detailed         Show detailed breakdown
  --format <type>    Output format: text, json
```

### `drift approve`

Approve discovered patterns.

```bash
drift approve <pattern-id> [options]

Options:
  --category <cat>   Approve all in category
  --yes, -y          Skip confirmation
```

### `drift ignore`

Ignore patterns.

```bash
drift ignore <pattern-id> [options]

Options:
  --yes, -y          Skip confirmation
```

### `drift report`

Generate reports.

```bash
drift report [options]

Options:
  --format <type>    Format: html, json, markdown
  --output <path>    Output file path
  --categories       Filter by categories
```

---

## Discovery Commands

### `drift where`

Find pattern locations.

```bash
drift where <pattern-id> [options]

Options:
  --category <cat>   Filter by category
  --status <status>  Filter by status
  --json             JSON output
```

### `drift files`

Show patterns in specific files.

```bash
drift files <path> [options]

Options:
  --category <cat>   Filter by category
  --json             JSON output
```

### `drift export`

Export manifest.

```bash
drift export [options]

Options:
  --format <type>    Format: json, ai-context, summary, markdown
  --max-tokens <n>   Token limit for ai-context format
  --snippets         Include code snippets
```

---

## Monitoring Commands

### `drift watch`

Real-time file watching.

```bash
drift watch [options]

Options:
  --context          Show context for changes
  --debounce <ms>    Debounce delay
  --persist          Persist changes to disk
```

### `drift dashboard`

Launch web dashboard.

```bash
drift dashboard [options]

Options:
  --port <port>      Server port (default: 3000)
  --no-browser       Don't open browser
```

### `drift trends`

View pattern trends over time.

```bash
drift trends [options]

Options:
  --period <period>  Time period: 7d, 30d, 90d
  --verbose          Show detailed changes
```

---

## Analysis Commands

### `drift boundaries`

Data access boundary analysis.

```bash
drift boundaries <subcommand>

Subcommands:
  overview           Show boundary overview
  tables             List tables and access patterns
  file <path>        Show boundaries for a file
  sensitive          List sensitive data access
  check              Check boundary violations
  init-rules         Initialize boundary rules
```

### `drift callgraph`

Call graph analysis.

```bash
drift callgraph <subcommand>

Subcommands:
  build              Build call graph
  status             Show call graph status
  reach <location>   What data can this code reach?
  inverse <target>   Who can access this data?
  function <name>    Show function details
```

### `drift test-topology`

Test coverage analysis.

```bash
drift test-topology <subcommand>

Subcommands:
  build              Build test topology
  status             Show test coverage status
  uncovered          Find uncovered code
  mocks              Analyze mock usage
  affected <files>   Minimum tests for changed files
```

### `drift coupling`

Module coupling analysis.

```bash
drift coupling <subcommand>

Subcommands:
  build              Build coupling graph
  status             Show coupling metrics
  cycles             Find dependency cycles
  hotspots           High-coupling modules
  analyze <module>   Analyze specific module
  refactor-impact    Impact of refactoring
  unused-exports     Find dead exports
```

### `drift error-handling`

Error handling analysis.

```bash
drift error-handling <subcommand>

Subcommands:
  build              Build error handling map
  status             Show error handling status
  gaps               Find error handling gaps
  boundaries         Show error boundaries
  unhandled          Find unhandled errors
  analyze <func>     Analyze specific function
```

### `drift wrappers`

Framework wrapper detection.

```bash
drift wrappers [options]

Options:
  --min-confidence <n>   Minimum confidence (0-1)
  --category <cat>       Filter by category
  --include-tests        Include test files
```

### `drift constants`

Analyze constants, enums, and exported values.

```bash
drift constants [subcommand] [options]

Subcommands:
  (default)          Show constants overview
  list               List all constants
  get <name>         Show constant details
  secrets            Show potential hardcoded secrets
  inconsistent       Show constants with inconsistent values
  dead               Show potentially unused constants
  export <output>    Export constants to file

Options:
  --format <type>    Output format: text, json, csv
  --category <cat>   Filter by category
  --language <lang>  Filter by language
  --file <path>      Filter by file path
  --search <query>   Search by name
  --exported         Show only exported constants
  --severity <level> Min severity for secrets
  --limit <n>        Limit results
```

**Examples:**

```bash
# Show overview
drift constants

# List API constants
drift constants list --category api

# Find hardcoded secrets
drift constants secrets --severity high

# Export to JSON
drift constants export constants.json
```

### `drift dna`

Styling DNA analysis.

```bash
drift dna <subcommand>

Subcommands:
  scan               Scan for styling patterns
  status             Show DNA profile
  gene <name>        Show specific gene
  mutations          Find style inconsistencies
  playbook           Generate style playbook
  export             Export DNA profile
```

---

## Management Commands

### `drift projects`

Manage multiple projects.

```bash
drift projects <subcommand>

Subcommands:
  list               List registered projects
  switch <name>      Switch active project
  add <path>         Register a project
  remove <name>      Unregister a project
  info <name>        Show project details
  cleanup            Remove stale projects
```

### `drift skills`

Manage Agent Skills.

```bash
drift skills <subcommand>

Subcommands:
  list               List available skills
  install <name>     Install a skill
  info <name>        Show skill details
  search <query>     Search for skills
```

### `drift parser`

Show parser status.

```bash
drift parser [options]

Options:
  --test             Test parser functionality
  --format <type>    Output format
```

### `drift migrate-storage`

Migrate to unified storage format.

```bash
drift migrate-storage [options]

Options:
  --status           Show migration status only
```

---

## Global Options

These options work with all commands:

```bash
--help, -h         Show help
--version, -v      Show version
--verbose          Verbose output
--quiet, -q        Suppress output
--no-color         Disable colors
```
