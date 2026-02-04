# Memory CLI Reference

Complete reference for the `drift memory` command — managing Cortex V2 memories from the command line.

---

## ⚡ Quick Start (30 Seconds)

```bash
# Run the interactive setup wizard (recommended)
drift memory setup

# Or initialize manually
drift memory init

# Add your first memory
drift memory add tribal "Always use bcrypt for passwords" --importance critical

# See what you've stored
drift memory list

# Search memories
drift memory search "password"
```

---

## 📋 Technical Overview

The `drift memory` command provides full CRUD operations for Cortex V2 memories. Memories are stored in a SQLite database at `.drift/memory/cortex.db` and support:

- **23 memory types** with different decay rates
- **Semantic search** via embeddings (local Transformers.js or OpenAI)
- **Confidence decay** based on age and usage
- **Automatic consolidation** of episodic memories
- **Health monitoring** and validation
- **Universal memory types** for agent spawns, workflows, entities, and more

---

## 🚫 Replacing AGENTS.md

Stop maintaining static `AGENTS.md` or `CLAUDE.md` files. They become stale immediately.

**Migrate in 2 minutes:**

```bash
# 1. Run the setup wizard
drift memory setup

# 2. Or add knowledge manually
drift memory add tribal "Always use bcrypt for passwords" --importance critical

# 3. Delete your AGENTS.md
rm AGENTS.md  # 🎉
```

---

## 📊 Memory Types (23 Total)

### Domain-Agnostic Types

| Type | Icon | Half-Life | Use Case |
|------|------|-----------|----------|
| `core` | 🏠 | ∞ (never) | Project name, tech stack |
| `tribal` | ⚠️ | 365 days | Gotchas, warnings |
| `procedural` | 📋 | 180 days | Deploy process |
| `semantic` | 💡 | 90 days | Auto-consolidated |
| `episodic` | 💭 | 7 days | Raw interactions |

### Code-Specific Types

| Type | Icon | Half-Life | Use Case |
|------|------|-----------|----------|
| `pattern_rationale` | 🎯 | 180 days | Why patterns exist |
| `constraint_override` | ✅ | 90 days | Approved exceptions |
| `decision_context` | 📝 | 180 days | Architectural decisions |
| `code_smell` | 🚫 | 90 days | Anti-patterns |

### Universal Memory Types (V2)

| Type | Icon | Half-Life | Use Case |
|------|------|-----------|----------|
| `agent_spawn` | 🤖 | 365 days | Agent configurations |
| `entity` | 📦 | 180 days | Projects, teams |
| `goal` | 🎯 | 90 days | Objectives |
| `workflow` | 📋 | 180 days | Processes |
| `incident` | 🚨 | 365 days | Postmortems |
| `skill` | 🧠 | 180 days | Knowledge domains |
| `environment` | 🌍 | 90 days | Environment configs |

---

## 🔧 Command Reference

### `drift memory setup`

**NEW** — Interactive wizard to set up Cortex memory.

```bash
drift memory setup [options]

Options:
  -y, --yes               Accept defaults
  --verbose               Verbose output
  --skip <sections>       Skip sections (comma-separated)
```

**Sections:**
1. Core Identity — Project name, tech stack, preferences
2. Tribal Knowledge — Gotchas, warnings
3. Workflows — Deploy, review, release processes
4. Agent Spawns — Reusable agent configurations
5. Entities — Projects, teams, services
6. Skills — Knowledge domains
7. Environments — Prod, staging, dev configs

All sections are optional — skip any with 'n'.

---

### `drift memory init`

Initialize the memory system.

```bash
drift memory init
```

---

### `drift memory status`

Show memory system status.

```bash
drift memory status
```

---

### `drift memory add`

Add a new memory.

```bash
drift memory add <type> <content> [options]

Options:
  -t, --topic <topic>         Topic name
  -s, --severity <severity>   info, warning, critical
  -i, --importance <level>    low, normal, high, critical
  --tags <tags>               Comma-separated tags
```

**Examples:**

```bash
drift memory add tribal "Always use bcrypt" --importance critical
drift memory add procedural "Deploy: 1) Test 2) Build 3) Push"
drift memory add code_smell "Avoid any type in TypeScript"
```

---

### Universal Memory Subcommands

```bash
drift memory agent-spawn add    # Add agent configuration
drift memory workflow add       # Add workflow
drift memory entity add         # Add entity
drift memory skill add          # Add skill
drift memory environment add    # Add environment
drift memory goal add           # Add goal
drift memory incident add       # Add incident
drift memory meeting add        # Add meeting notes
drift memory conversation add   # Add conversation
```

---

### `drift memory list`

List memories with filters.

```bash
drift memory list [options]

Options:
  -t, --type <type>           Filter by type
  -i, --importance <level>    Filter by importance
  -l, --limit <number>        Max results (default: 20)
  --min-confidence <number>   Min confidence (0-1)
```

---

### `drift memory search`

Search memories semantically.

```bash
drift memory search <query> [options]

Options:
  -t, --type <type>     Filter by type
  -l, --limit <number>  Max results
```

---

### `drift memory why`

Get context for a task.

```bash
drift memory why <focus> [options]

Options:
  -i, --intent <intent>     add_feature, fix_bug, refactor, etc.
  --max-tokens <number>     Max tokens (default: 2000)
```

---

### `drift memory learn`

Learn from a correction.

```bash
drift memory learn <correction> [options]

Options:
  -o, --original <text>   What was originally done
  -c, --code <code>       Corrected code example
```

---

### `drift memory feedback`

Provide feedback on a memory.

```bash
drift memory feedback <id> <action> [options]

Actions: confirm, reject, modify
```

---

### `drift memory validate`

Validate memories.

```bash
drift memory validate [options]

Options:
  -s, --scope <scope>    all, stale, recent, high_importance
  --auto-heal            Auto-heal issues
```

---

### `drift memory consolidate`

Consolidate episodic memories.

```bash
drift memory consolidate [--dry-run]
```

---

### `drift memory health`

Get health report.

```bash
drift memory health
```

---

### `drift memory export/import`

Export and import memories.

```bash
drift memory export backup.json
drift memory import backup.json [--overwrite]
```

---

## 🔗 Related Documentation

- [Cortex V2 Overview](Cortex-V2-Overview)
- [Memory Setup Wizard](Cortex-Memory-Setup)
- [Universal Memory Types](Cortex-Universal-Memory-Types)
- [MCP Tools Reference](MCP-Tools-Reference)
