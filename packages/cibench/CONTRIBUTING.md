# Contributing to CIBench

Thank you for your interest in contributing to the Codebase Intelligence Benchmark!

## Ways to Contribute

### 1. Add New Test Codebases

We need diverse, well-annotated codebases across languages and frameworks.

**Requirements for a new corpus:**
- Clear, realistic code (not toy examples)
- Comprehensive ground truth annotations
- At least 3 agentic task scenarios
- Documented annotation methodology

**Steps:**
1. Create a new directory under `corpus/`
2. Add the codebase source files
3. Create `.cibench/manifest.json` with metadata
4. Annotate patterns in `.cibench/patterns.json`
5. Annotate call graph in `.cibench/callgraph.json`
6. Add agentic tasks in `.cibench/agentic.json`
7. Submit PR with annotation notes

### 2. Improve Ground Truth Quality

Existing annotations may have errors or gaps. Help us improve them:

- Review existing annotations for accuracy
- Add missing patterns or call relationships
- Improve agentic task scenarios
- Document edge cases and tricky patterns

### 3. Add Tool Adapters

We need adapters for popular code intelligence tools:

- Cursor
- Cody (Sourcegraph)
- Continue
- Aider
- GitHub Copilot Workspace
- Your tool here!

**Adapter requirements:**
- Implement the `ToolAdapter` interface
- Produce standardized `ToolOutput`
- Document any tool-specific setup

### 4. Add New Benchmark Categories

Propose new evaluation categories:

- Define the category's purpose
- Create ground truth schema
- Implement scorer
- Add test cases to existing corpora

## Annotation Guidelines

### Pattern Annotation

1. **Be specific**: Each pattern should be clearly identifiable
2. **Include all instances**: Don't miss locations
3. **Document confidence**: Note if a pattern is subtle
4. **Mark outliers**: Deviations are as important as conformance

### Call Graph Annotation

1. **Include all functions**: Even small helpers
2. **Mark resolvability**: Note which calls can't be statically resolved
3. **Document entry points**: HTTP handlers, CLI commands, etc.
4. **Note dynamic dispatch**: Interface calls, callbacks, etc.

### Agentic Task Annotation

1. **Write realistic prompts**: What would a developer actually ask?
2. **Be comprehensive**: List ALL relevant files
3. **Prioritize correctly**: Critical vs helpful vs context-only
4. **Include constraints**: What must the agent NOT do?

## Quality Standards

- All annotations must be reviewed by at least one other person
- Ground truth should be verified against actual tool behavior
- Edge cases should be documented
- Annotation methodology should be reproducible

## Code of Conduct

- Be respectful and constructive
- Focus on improving the benchmark
- Acknowledge others' contributions
- Keep discussions technical

## Questions?

Open an issue or reach out to the maintainers.
