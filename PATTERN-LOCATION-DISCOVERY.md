# Pattern Location Discovery - Implementation Plan

## Overview

This feature adds intelligent pattern location discovery to Drift, enabling AI agents and developers to instantly understand WHERE patterns are implemented in a codebase without reading every file.

**The Problem:** Current pattern storage knows WHAT patterns exist but not WHERE they live. AI agents must read dozens of files to understand a codebase's architecture.

**The Solution:** Drift scans code, discovers pattern implementations, and stores exact file locations with semantic information (class names, method signatures, line ranges).

**The Result:** One JSON manifest file contains complete architectural understanding. AI agents read one file instead of 100.

---

## Tasks

### Phase 1: Detection Rules Schema

- [ ] 1. Define detection rules schema
  - [ ] 1.1 Create `PatternDetection` interface in `@drift/core`
    - File path patterns (glob matching)
    - Code patterns (regex matching)
    - AST patterns (node type matching)
    - Required imports/dependencies
    - Weighted scoring system
    - Confidence threshold
  - [ ] 1.2 Create `SemanticLocation` interface
    - File path and content hash
    - Line range (start/end)
    - Semantic type (class, function, method, variable)
    - Name and signature
    - Nested members (methods within classes)
  - [ ] 1.3 Update `Pattern` type to include detection rules and locations
  - [ ] 1.4 Write unit tests for new types

- [ ] 2. Checkpoint - Schema complete
  - Types compile without errors
  - Existing tests still pass

---

### Phase 2: Cheatcode2026 Detection Rules

- [ ] 3. Add detection rules to all 18 Cheatcode2026 patterns
  - [ ] 3.1 Auth patterns
    - `cc2026-auth-middleware`: middleware.py/ts, Bearer token, authenticate
    - `cc2026-rbac`: entitlements, TierEntitlements, check_feature
  - [ ] 3.2 API patterns
    - `cc2026-response-helpers`: responses.py, success_response, error_response
    - `cc2026-api-routes`: routes/, router.py, APIRouter
    - `cc2026-error-responses`: exception_handlers, to_dict
  - [ ] 3.3 Error patterns
    - `cc2026-exception-taxonomy`: exceptions.py, AppError, ErrorCode
    - `cc2026-circuit-breaker`: circuit_breaker, CircuitBreaker, OPEN/CLOSED
  - [ ] 3.4 Logging patterns
    - `cc2026-structured-logging`: logging.py, structlog, logger
    - `cc2026-correlation-ids`: X-Request-ID, correlation, request_id
    - `cc2026-health-checks`: health.py, HealthChecker, /health
  - [ ] 3.5 Security patterns
    - `cc2026-input-sanitization`: sanitize.py, sanitize_input, validate_
    - `cc2026-csp-headers`: csp.ts, Content-Security-Policy, buildCSP
    - `cc2026-rate-limiting`: RateLimitError, rate_limit, retry_after
  - [ ] 3.6 Config patterns
    - `cc2026-env-validation`: config.py, env.ts, Settings, z.object
    - `cc2026-feature-flags`: ENABLE_, feature_flag, isEnabled
  - [ ] 3.7 Styling patterns
    - `cc2026-design-tokens`: tokens.ts, design-tokens, colors, spacing
  - [ ] 3.8 Data access patterns
    - `cc2026-job-state-machine`: JobStatus, VALID_TRANSITIONS, state machine
  - [ ] 3.9 Testing patterns
    - `cc2026-test-structure`: .test.ts, .test.py, describe, it, def test_

- [ ] 4. Checkpoint - Detection rules complete
  - All 18 patterns have detection rules
  - Rules are stored in preset JSON

---

### Phase 3: Location Discovery Engine

- [ ] 5. Implement location discovery
  - [ ] 5.1 Create `LocationDiscoverer` class in `@drift/core`
    - Accept pattern with detection rules
    - Accept list of files to scan
    - Return discovered locations with confidence
  - [ ] 5.2 Implement file pattern matching
    - Glob pattern matching against file paths
    - Support for ** recursive matching
  - [ ] 5.3 Implement code pattern matching
    - Regex matching against file content
    - Line number extraction for matches
    - Snippet extraction around matches
  - [ ] 5.4 Implement AST-based matching (TypeScript/Python)
    - Find classes, functions, methods by name pattern
    - Extract signatures and member lists
    - Calculate precise line ranges
  - [ ] 5.5 Implement confidence scoring for locations
    - Weight file path matches
    - Weight code pattern matches
    - Weight AST matches
    - Combine into overall confidence
  - [ ] 5.6 Write unit tests for LocationDiscoverer

- [ ] 6. Checkpoint - Location discovery works
  - Can find Auth Middleware in test codebase
  - Returns correct file, line range, and signature

---

### Phase 4: The Manifest

- [ ] 7. Implement manifest storage
  - [ ] 7.1 Create `Manifest` interface
    - Version and generation timestamp
    - Codebase hash (for change detection)
    - Pattern-to-locations map
    - File-to-patterns reverse index
    - File hashes for incremental updates
  - [ ] 7.2 Create `ManifestStore` class
    - Load manifest from `.drift/index/manifest.json`
    - Save manifest with atomic write
    - Merge updates into existing manifest
  - [ ] 7.3 Implement content hashing
    - Hash file contents for change detection
    - Hash codebase state for staleness check
  - [ ] 7.4 Implement incremental updates
    - Compare file hashes to detect changes
    - Only re-scan changed files
    - Update manifest with new locations
  - [ ] 7.5 Write unit tests for ManifestStore

- [ ] 8. Checkpoint - Manifest storage works
  - Manifest saves and loads correctly
  - Incremental updates only scan changed files

---

### Phase 5: CLI Integration

- [ ] 9. Update scan command
  - [ ] 9.1 Add location discovery to scan flow
    - After pattern detection, run location discovery
    - Update pattern locations in store
    - Generate/update manifest
  - [ ] 9.2 Add `--discover-locations` flag (default: true)
    - Allow skipping location discovery for speed
  - [ ] 9.3 Add progress output for location discovery
    - Show which patterns are being located
    - Show files being scanned
  - [ ] 9.4 Update scan summary output
    - Show locations discovered per pattern
    - Show manifest generation time

- [ ] 10. Implement export command
  - [ ] 10.1 Create `drift export` command
  - [ ] 10.2 Implement `--format json` (default)
    - Output full manifest as JSON
  - [ ] 10.3 Implement `--format ai-context`
    - Output optimized markdown for AI context windows
    - Include pattern summaries with locations
    - Include file index
    - Include dependency graph
  - [ ] 10.4 Implement `--format summary`
    - Human-readable summary of patterns and locations
  - [ ] 10.5 Add `--output` flag for file output
  - [ ] 10.6 Write tests for export command

- [ ] 11. Implement where command
  - [ ] 11.1 Create `drift where <pattern>` command
    - Find locations for a specific pattern
    - Support partial pattern name matching
  - [ ] 11.2 Output format
    - File path with line range
    - Semantic name (class/function)
    - Code snippet preview
  - [ ] 11.3 Write tests for where command

- [ ] 12. Checkpoint - CLI integration complete
  - `drift scan` discovers and stores locations
  - `drift export --format ai-context` produces useful output
  - `drift where "auth"` finds auth patterns

---

### Phase 6: AI-Optimized Output

- [ ] 13. Design AI context format
  - [ ] 13.1 Define optimal structure for LLM consumption
    - Concise but complete
    - Hierarchical (categories → patterns → locations)
    - Include actionable information (file paths, line numbers)
  - [ ] 13.2 Implement markdown generator
    - Pattern summaries with locations
    - File index table
    - Dependency relationships
  - [ ] 13.3 Implement token estimation
    - Estimate context window usage
    - Warn if output exceeds common limits (8k, 32k, 128k)
  - [ ] 13.4 Implement compression options
    - `--compact` for minimal output
    - `--full` for complete details
    - `--max-tokens` to limit output size

- [ ] 14. Checkpoint - AI output complete
  - AI context format is useful and concise
  - Token estimation works
  - Output fits in standard context windows

---

### Phase 7: Dependency Graph

- [ ] 15. Implement pattern dependencies
  - [ ] 15.1 Analyze imports between pattern files
    - If auth/middleware.py imports from exceptions.py
    - And exceptions.py contains Exception Taxonomy pattern
    - Then Auth Middleware depends on Exception Taxonomy
  - [ ] 15.2 Store dependencies in manifest
    - `dependencies`: patterns this pattern uses
    - `dependents`: patterns that use this pattern
  - [ ] 15.3 Implement `drift deps <pattern>` command
    - Show what a pattern depends on
    - Show what depends on this pattern
  - [ ] 15.4 Include dependencies in AI context output
  - [ ] 15.5 Write tests for dependency analysis

- [ ] 16. Checkpoint - Dependencies complete
  - Dependency graph is accurate
  - `drift deps` command works
  - AI context includes dependency info

---

### Phase 8: Polish & Documentation

- [ ] 17. Performance optimization
  - [ ] 17.1 Parallel file scanning for location discovery
  - [ ] 17.2 Cache AST parsing results
  - [ ] 17.3 Benchmark: 1000 files should complete in <5 seconds

- [ ] 18. Documentation
  - [ ] 18.1 Update README with location discovery features
  - [ ] 18.2 Document manifest format
  - [ ] 18.3 Document AI context format
  - [ ] 18.4 Add examples for common use cases

- [ ] 19. Final checkpoint
  - All tests pass
  - Performance targets met
  - Documentation complete
  - Ready for release

---

## Success Criteria

When complete, running `drift scan` on a Cheatcode2026 project will:

1. Discover all 18 patterns
2. Find exact file locations for each pattern
3. Extract semantic information (class names, method signatures)
4. Generate a manifest at `.drift/index/manifest.json`
5. Enable `drift export --format ai-context` for AI consumption

An AI agent can then:
```
Read .drift/index/manifest.json (or ai-context.md)
→ Instantly know all patterns and their locations
→ Navigate directly to relevant code
→ Understand dependencies between patterns
→ No exploration needed
```

---

## Example Output

### Manifest (JSON)
```json
{
  "version": "2.0.0",
  "generated": "2026-01-19T12:00:00Z",
  "patterns": {
    "cc2026-auth-middleware": {
      "locations": [{
        "file": "packages/backend/src/auth/middleware.py",
        "hash": "a1b2c3",
        "range": { "start": 15, "end": 67 },
        "type": "class",
        "name": "AuthMiddleware",
        "signature": "class AuthMiddleware:",
        "confidence": 0.95
      }],
      "dependencies": ["cc2026-exception-taxonomy"]
    }
  },
  "files": {
    "packages/backend/src/auth/middleware.py": {
      "hash": "a1b2c3",
      "patterns": ["cc2026-auth-middleware"]
    }
  }
}
```

### AI Context (Markdown)
```markdown
# Architecture Manifest

## Auth Patterns
- **Auth Middleware** → `packages/backend/src/auth/middleware.py:15-67`
  - Class: `AuthMiddleware`
  - Methods: `__call__`, `authenticate`
  - Depends on: Exception Taxonomy

## Error Patterns  
- **Exception Taxonomy** → `packages/backend/src/exceptions.py:1-120`
  - Base: `AppError`
  - Types: AuthenticationError, ValidationError, NotFoundError...
  - Used by: Auth Middleware, RBAC, API Routes
```

---

## Timeline Estimate

- Phase 1-2: Schema + Detection Rules (2-3 hours)
- Phase 3-4: Discovery Engine + Manifest (4-5 hours)
- Phase 5-6: CLI + AI Output (3-4 hours)
- Phase 7-8: Dependencies + Polish (2-3 hours)

**Total: ~12-15 hours**

This turns Drift from "pattern detection" into "architectural intelligence."
