# CIBench - Codebase Intelligence Benchmark

The first benchmark for measuring how well tools **understand** codebases, not just navigate them.

## Why CIBench?

Everyone claims their tool "understands your codebase" but there's no objective way to measure it. SWE-bench measures code generation. CIBench measures code **comprehension**.

| SWE-bench | CIBench |
|-----------|---------|
| "Can you fix this bug?" | "Do you understand this codebase?" |
| Measures code generation | Measures code comprehension |
| Binary pass/fail | Graduated accuracy + calibration |
| Single-file focus | Whole-codebase focus |
| Pattern matching sufficient | Requires actual understanding |

## What Makes CIBench Novel?

### The Problem with Existing Benchmarks

Existing code benchmarks test **pattern matching**, not **understanding**. A tool can score well by:
- Memorizing common patterns
- Keyword matching
- Statistical correlation

But these don't prove the tool actually *understands* the code.

### Our Solution: Four-Level Evaluation

CIBench uses a hierarchical framework that progressively tests deeper understanding:

```
Level 4: Validation      ─── Does it correlate with human judgment?
Level 3: Application     ─── Can it apply understanding efficiently?
Level 2: Understanding   ─── Does it grasp intent and causality?
Level 1: Perception      ─── Can it detect patterns and structure?
```

## The Four Levels

### Level 1: Perception (30%)
Basic codebase perception - necessary but not sufficient.

- **Pattern Recognition**: Detect recurring patterns, conventions, outliers
- **Call Graph Accuracy**: Map function calls, including dynamic dispatch
- **Data Flow Tracking**: Trace data through the codebase

### Level 2: Understanding (35%) ⭐ THE NOVEL PART
This is what separates CIBench from other benchmarks.

- **Architectural Intent**: WHY does this code exist? What tradeoffs were made?
- **Causal Reasoning**: What would happen if X changed? (Counterfactual evaluation)
- **Uncertainty Quantification**: Does the tool know what it doesn't know? (Calibration)

### Level 3: Application (25%)
How well does understanding translate to practical use?

- **Token Efficiency**: Get the right context with minimal tokens
- **Compositional Reasoning**: Combine multiple knowledge pieces
- **Iterative Refinement**: Improve with feedback
- **Negative Knowledge**: Know what NOT to do

### Level 4: Validation (10%)
Ground truth validation.

- **Human Correlation**: Do scores correlate with expert judgment?

## Key Innovations

### 1. Counterfactual Evaluation
Instead of "what pattern is this?", we ask "what would happen if we changed X?"

```typescript
// Counterfactual scenario
{
  change: { type: 'remove', target: 'src/auth/middleware.ts:42' },
  expectedEffects: [
    { target: 'src/api/users.ts', effectType: 'runtime-error' },
    { target: 'src/api/admin.ts', effectType: 'security-impact' }
  ],
  unaffected: [
    { file: 'src/utils/format.ts', reason: 'No auth dependency' }
  ]
}
```

You can't fake causal understanding.

### 2. Calibration Measurement
A well-calibrated tool should be right 80% of the time when it says 80% confident.

We measure:
- **ECE** (Expected Calibration Error): Average miscalibration
- **MCE** (Maximum Calibration Error): Worst-case miscalibration
- **Overconfidence Rate**: High confidence but wrong
- **Underconfidence Rate**: Low confidence but right

### 3. Generative Probes
Instead of multiple choice, we ask tools to GENERATE explanations:

```typescript
// Explanation probe
{
  question: "Why does UserService use dependency injection instead of direct instantiation?",
  expectedElements: [
    { concept: "testability", importance: "required" },
    { concept: "loose coupling", importance: "expected" },
    { concept: "single responsibility", importance: "bonus" }
  ],
  misconceptions: [
    { concept: "performance optimization", penalty: 0.3 }
  ]
}
```

### 4. Adversarial Robustness
We include probes designed to expose weaknesses:

- Misleading variable names
- Dead code that looks relevant
- Outdated comments
- Framework "magic"

### 5. Negative Knowledge
Knowing what NOT to do is often more important than knowing what to do:

- Anti-patterns to avoid
- Danger zones not to modify
- Files that are noise, not signal

## Quick Start

```bash
# Install
pnpm add -D @drift/cibench

# Run benchmark
cibench run --tool drift --corpus typescript-express

# Run with specific levels
cibench run --tool drift --levels perception,understanding

# Compare tools
cibench compare drift cursor cody

# Generate report
cibench report --format markdown
```

## Scoring

```
CIBench Score = Σ(level_score × level_weight)

Level 1 (Perception):     30%
Level 2 (Understanding):  35%  ← The differentiator
Level 3 (Application):    25%
Level 4 (Validation):     10%
```

Each level has sub-categories with their own weights.

## Test Corpus

### Languages
- TypeScript (Express, NestJS)
- Python (FastAPI, Django)
- Go (Gin, net/http)
- Java (Spring Boot)
- Rust (Actix, Axum)

### Codebase Sizes
- **Small**: < 50 files
- **Medium**: 50-500 files
- **Large**: 500-5000 files
- **Monorepo**: Multiple packages

## Ground Truth Format

Each test codebase includes a `.cibench/` directory:

```
.cibench/
├── manifest.json              # Corpus metadata
├── perception/
│   ├── patterns.json          # Expected patterns
│   ├── callgraph.json         # Expected call relationships
│   └── dataflow.json          # Expected data flows
├── understanding/
│   ├── intent.json            # Architectural decisions
│   ├── causal.json            # Counterfactual scenarios
│   └── uncertainty.json       # Calibration tests
├── application/
│   ├── efficiency.json        # Token efficiency tasks
│   ├── compositional.json     # Multi-step reasoning
│   └── negative.json          # What NOT to do
├── probes/
│   ├── explanation.json       # Explanation probes
│   ├── prediction.json        # Prediction probes
│   └── adversarial.json       # Adversarial probes
└── validation/
    └── human-judgments.json   # Expert annotations
```

## Research Foundation

CIBench is designed to advance the field of code intelligence:

1. **Reproducible**: Same tool produces same score
2. **Discriminative**: Different tools produce different scores
3. **Meaningful**: Scores correlate with real-world usefulness
4. **Extensible**: Easy to add new probes and corpora

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to:
- Add new test codebases
- Create ground truth annotations
- Design new probe types
- Integrate new tools

## License

Apache 2.0
