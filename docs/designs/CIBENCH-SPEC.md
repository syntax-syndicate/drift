# CIBench - Codebase Intelligence Benchmark

**Status**: v2 Draft  
**Author**: Drift Team  
**Created**: 2026-01-28  
**Updated**: 2026-01-28

## Executive Summary

CIBench is a frontier-quality benchmark for measuring codebase intelligence. Unlike existing benchmarks that test pattern matching, CIBench tests actual **understanding** through counterfactual reasoning, calibrated confidence, and generative probes.

## Motivation

### The Problem

Every code intelligence tool claims to "understand your codebase" but:
1. No objective way to measure understanding
2. Existing benchmarks test pattern matching, not comprehension
3. Tools can score well by memorization without understanding
4. No measurement of calibration (knowing what you don't know)

### Our Thesis

**Understanding is demonstrated through:**
1. **Counterfactual reasoning**: "What would happen if X changed?"
2. **Generative explanation**: "Why does this code exist?"
3. **Calibrated confidence**: "How sure should you be?"

You can't fake these. Pattern matching fails on counterfactuals.

## Four-Level Framework

### Level 1: Perception (30%)

Basic codebase perception - necessary but not sufficient.

| Category | Weight | What It Measures |
|----------|--------|------------------|
| Pattern Recognition | 15% | Detect patterns, conventions, outliers |
| Call Graph Accuracy | 15% | Map function calls, dynamic dispatch |

**Metrics**: Precision, Recall, F1

### Level 2: Understanding (35%) ⭐

The novel part - tests actual understanding.

| Category | Weight | What It Measures |
|----------|--------|------------------|
| Architectural Intent | 15% | WHY code is structured this way |
| Causal Reasoning | 12% | What happens if X changes |
| Uncertainty Quantification | 8% | Calibration, knowing unknowns |

**Metrics**: 
- Intent: Decision recognition accuracy, probe scores
- Causal: Counterfactual effect prediction, chain reconstruction
- Uncertainty: ECE, MCE, overconfidence rate

### Level 3: Application (25%)

Practical application of understanding.

| Category | Weight | What It Measures |
|----------|--------|------------------|
| Token Efficiency | 10% | Right context, minimal tokens |
| Compositional Reasoning | 10% | Combining knowledge pieces |
| Iterative Refinement | 5% | Improving with feedback |

**Metrics**:
- Efficiency: Relevance/tokens ratio, noise ratio
- Compositional: Knowledge identification, composition accuracy
- Refinement: Improvement rate, final quality

### Level 4: Validation (10%)

Ground truth validation.

| Category | Weight | What It Measures |
|----------|--------|------------------|
| Human Correlation | 10% | Agreement with expert judgment |

**Metrics**: Pearson, Spearman, Kendall correlation

## Key Innovations

### 1. Counterfactual Evaluation

Traditional: "What pattern is this?"
CIBench: "What would happen if we removed this function?"

```typescript
interface CounterfactualScenario {
  change: {
    type: 'add' | 'remove' | 'modify';
    target: { file: string; line: number };
  };
  expectedEffects: {
    target: { file: string };
    effectType: 'compile-error' | 'runtime-error' | 'behavior-change' | ...;
    confidence: number;
    causalDistance: number;
  }[];
  unaffected: { file: string; reason: string }[];
}
```

**Why it works**: Causal reasoning requires understanding, not just correlation.

### 2. Calibration Measurement

A well-calibrated tool should be right X% of the time when it says X% confident.

```typescript
interface CalibrationMetrics {
  ece: number;  // Expected Calibration Error (lower is better)
  mce: number;  // Maximum Calibration Error
  bins: {
    confidenceRange: { min: number; max: number };
    samples: number;
    accuracy: number;
    avgConfidence: number;
    error: number;  // |accuracy - avgConfidence|
  }[];
}
```

**Why it works**: Overconfident tools are dangerous. Calibration measures self-awareness.

### 3. Generative Probes

Instead of multiple choice, tools must generate explanations.

```typescript
interface ExplanationProbe {
  question: string;
  expectedElements: {
    concept: string;
    importance: 'required' | 'expected' | 'bonus';
    points: number;
  }[];
  misconceptions: {
    concept: string;
    penalty: number;
  }[];
}
```

**Why it works**: Generation requires understanding; pattern matching fails.

### 4. Adversarial Robustness

Probes designed to expose weaknesses:

- **Misleading names**: Variables named opposite to their purpose
- **Dead code**: Code that looks relevant but isn't used
- **Red herrings**: Distracting but irrelevant code
- **Outdated comments**: Comments that don't match code
- **Framework magic**: Implicit behavior

### 5. Negative Knowledge

Knowing what NOT to do:

```typescript
interface NegativeKnowledge {
  avoidances: { avoid: string; reason: string; alternative: string }[];
  antiPatterns: { pattern: string; problem: string; allowNew: boolean }[];
  dangerZones: { location: string; danger: string; precautions: string[] }[];
}
```

## Scoring Algorithm

### Overall Score

```
CIBench Score = Σ(level_score × level_weight)

Where:
  Level 1 (Perception):     30%
  Level 2 (Understanding):  35%
  Level 3 (Application):    25%
  Level 4 (Validation):     10%
```

### Calibration Score

```
Calibration Score = 100 × (1 - ECE)

Where ECE = Σ(|bin_accuracy - bin_confidence| × bin_size / total_samples)
```

### Token Efficiency Score

```
Efficiency = (relevance_score × optimal_tokens) / actual_tokens

Where:
  relevance_score = critical_coverage × 0.5 + important_coverage × 0.3 + helpful_coverage × 0.2
```

## Implementation Plan

### Phase 1: Foundation ✅
- [x] v2 Schema definitions
- [x] Four-level framework
- [x] Calibration measurement
- [x] Probe evaluation

### Phase 2: Corpus Creation (Week 2-3)
- [ ] TypeScript-Express corpus with full ground truth
- [ ] Counterfactual scenarios
- [ ] Generative probes
- [ ] Human validation

### Phase 3: Tool Adapters (Week 4)
- [ ] Drift adapter
- [ ] Generic adapter interface
- [ ] Output normalization

### Phase 4: Validation (Week 5-6)
- [ ] Human correlation study
- [ ] Inter-annotator agreement
- [ ] Score stability analysis

### Phase 5: Release (Week 7-8)
- [ ] Documentation
- [ ] Example corpora
- [ ] Leaderboard (optional)

## Success Criteria

1. **Discriminative**: Different tools produce meaningfully different scores
2. **Reproducible**: Same tool produces same score (±2%)
3. **Correlated**: Scores correlate with expert judgment (r > 0.7)
4. **Robust**: Adversarial probes expose real weaknesses

## Open Questions

1. **Human validation scale**: How many annotators per corpus?
2. **Counterfactual generation**: Manual or semi-automated?
3. **Probe difficulty calibration**: How to ensure consistent difficulty?
4. **Cross-language comparability**: Same score meaning across languages?

## References

- [SWE-bench](https://www.swebench.com/) - Code generation benchmark
- [HumanEval](https://github.com/openai/human-eval) - Code synthesis benchmark
- [Calibration in Deep Learning](https://arxiv.org/abs/1706.04599) - ECE methodology
- [Counterfactual Explanations](https://arxiv.org/abs/1711.00399) - Causal reasoning

## Appendix: Schema Overview

```
drift/packages/cibench/src/schema/v2/
├── index.ts           # Exports
├── manifest.ts        # Corpus metadata, evaluation config
├── perception.ts      # Level 1: Patterns, call graph, data flow
├── understanding.ts   # Level 2: Intent, causality, uncertainty
├── application.ts     # Level 3: Efficiency, composition, refinement
└── probes.ts          # Generative probes for testing understanding
```
