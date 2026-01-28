/**
 * CIBench v2 Understanding Schema (Level 2)
 * 
 * THE NOVEL PART - This is what makes CIBench frontier-quality.
 * 
 * Measures actual understanding, not just pattern matching:
 * - Architectural Intent: WHY does this code exist?
 * - Causal Reasoning: What happens if X changes?
 * - Uncertainty Quantification: How confident should you be?
 * 
 * Key insight: Understanding is demonstrated through:
 * 1. Counterfactual reasoning (what would happen if...)
 * 2. Generative explanations (why does this exist...)
 * 3. Calibrated confidence (knowing what you don't know)
 */

// ============================================================================
// Architectural Intent
// ============================================================================

/**
 * Tests whether the tool understands WHY code is structured a certain way.
 * This goes beyond "what pattern is this" to "why was this pattern chosen".
 */
export interface ArchitecturalIntentGroundTruth {
  version: '2.0.0';
  
  /** Design decisions embedded in the code */
  decisions: ArchitecturalDecision[];
  
  /** Trade-offs made in the architecture */
  tradeoffs: ArchitecturalTradeoff[];
  
  /** Constraints that shaped the design */
  constraints: DesignConstraint[];
  
  /** Intent probes - questions about why */
  probes: IntentProbe[];
}

export interface ArchitecturalDecision {
  /** Unique ID */
  id: string;
  
  /** What was decided */
  decision: string;
  
  /** Why it was decided (the intent) */
  rationale: string;
  
  /** Alternatives that were NOT chosen */
  alternatives: {
    option: string;
    whyRejected: string;
  }[];
  
  /** Code locations that embody this decision */
  manifestations: {
    file: string;
    line: number;
    description: string;
  }[];
  
  /** Difficulty of inferring this decision */
  difficulty: 'obvious' | 'inferrable' | 'subtle' | 'hidden';
  
  /** Evidence strength (how much code supports this inference) */
  evidenceStrength: number;
}

export interface ArchitecturalTradeoff {
  /** Unique ID */
  id: string;
  
  /** What was traded off */
  description: string;
  
  /** What was gained */
  gained: string[];
  
  /** What was sacrificed */
  sacrificed: string[];
  
  /** Where this tradeoff is visible */
  locations: { file: string; line: number }[];
}

export interface DesignConstraint {
  /** Unique ID */
  id: string;
  
  /** The constraint */
  constraint: string;
  
  /** Source of constraint */
  source: 'technical' | 'business' | 'regulatory' | 'legacy' | 'team';
  
  /** How it manifests in code */
  manifestation: string;
  
  /** Locations affected */
  locations: { file: string; line: number }[];
}

export interface IntentProbe {
  /** Unique ID */
  id: string;
  
  /** The question about intent */
  question: string;
  
  /** Expected answer (or acceptable answers) */
  expectedAnswers: string[];
  
  /** Key concepts that must be mentioned */
  requiredConcepts: string[];
  
  /** Concepts that indicate misunderstanding */
  wrongConcepts: string[];
  
  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  
  /** Scoring rubric */
  rubric: IntentRubric;
}

export interface IntentRubric {
  /** Full credit criteria */
  fullCredit: string;
  
  /** Partial credit criteria */
  partialCredit: { criteria: string; points: number }[];
  
  /** Zero credit criteria */
  zeroCredit: string;
  
  /** Maximum points */
  maxPoints: number;
}

// ============================================================================
// Causal Reasoning
// ============================================================================

/**
 * Tests counterfactual reasoning: "What would happen if X changed?"
 * This is the gold standard for understanding - you can't fake causality.
 */
export interface CausalReasoningGroundTruth {
  version: '2.0.0';
  
  /** Counterfactual scenarios */
  counterfactuals: CounterfactualScenario[];
  
  /** Causal chains in the codebase */
  causalChains: CausalChain[];
  
  /** Intervention effects */
  interventions: InterventionEffect[];
}

export interface CounterfactualScenario {
  /** Unique ID */
  id: string;
  
  /** The hypothetical change */
  change: {
    type: 'add' | 'remove' | 'modify';
    target: { file: string; line: number };
    description: string;
  };
  
  /** Expected effects */
  expectedEffects: CounterfactualEffect[];
  
  /** Things that should NOT be affected */
  unaffected: {
    file: string;
    reason: string;
  }[];
  
  /** Difficulty of reasoning about this */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  
  /** Reasoning chain (for evaluation) */
  reasoningChain: string[];
}

export interface CounterfactualEffect {
  /** What would be affected */
  target: { file: string; line?: number };
  
  /** Type of effect */
  effectType: EffectType;
  
  /** Description of effect */
  description: string;
  
  /** Confidence in this effect */
  confidence: number;
  
  /** Causal distance (hops in dependency graph) */
  causalDistance: number;
}

export type EffectType =
  | 'compile-error'      // Would cause compilation failure
  | 'runtime-error'      // Would cause runtime failure
  | 'behavior-change'    // Would change behavior
  | 'performance-impact' // Would affect performance
  | 'security-impact'    // Would affect security
  | 'test-failure'       // Would cause test failure
  | 'no-effect';         // Surprisingly, no effect

export interface CausalChain {
  /** Unique ID */
  id: string;
  
  /** Description */
  description: string;
  
  /** Chain of causation */
  chain: {
    step: number;
    location: { file: string; line: number };
    action: string;
    consequence: string;
  }[];
  
  /** Root cause */
  rootCause: { file: string; line: number };
  
  /** Final effect */
  finalEffect: string;
}

export interface InterventionEffect {
  /** Unique ID */
  id: string;
  
  /** The intervention (change) */
  intervention: {
    type: 'add-logging' | 'add-validation' | 'change-type' | 'rename' | 'extract' | 'inline';
    target: { file: string; line: number };
    description: string;
  };
  
  /** Predicted effects */
  effects: {
    category: 'functionality' | 'performance' | 'maintainability' | 'security';
    description: string;
    magnitude: 'none' | 'minor' | 'moderate' | 'major';
  }[];
}

// ============================================================================
// Uncertainty Quantification
// ============================================================================

/**
 * Tests calibration: Does the tool know what it doesn't know?
 * A well-calibrated tool should be 80% confident on things it gets right 80% of the time.
 */
export interface UncertaintyGroundTruth {
  version: '2.0.0';
  
  /** Calibration test cases */
  calibrationTests: CalibrationTest[];
  
  /** Ambiguous scenarios (should have low confidence) */
  ambiguousScenarios: AmbiguousScenario[];
  
  /** Clear scenarios (should have high confidence) */
  clearScenarios: ClearScenario[];
  
  /** Expected calibration curve */
  expectedCalibration: CalibrationCurve;
}

export interface CalibrationTest {
  /** Unique ID */
  id: string;
  
  /** The question/task */
  task: string;
  
  /** Correct answer */
  correctAnswer: string;
  
  /** Expected confidence range */
  expectedConfidence: {
    min: number;
    max: number;
  };
  
  /** Why this confidence level is appropriate */
  confidenceRationale: string;
  
  /** Factors that should increase confidence */
  confidenceIncreasing: string[];
  
  /** Factors that should decrease confidence */
  confidenceDecreasing: string[];
}

export interface AmbiguousScenario {
  /** Unique ID */
  id: string;
  
  /** The scenario */
  scenario: string;
  
  /** Why it's ambiguous */
  ambiguitySource: AmbiguitySource;
  
  /** Possible interpretations */
  interpretations: {
    interpretation: string;
    probability: number;
  }[];
  
  /** Maximum reasonable confidence */
  maxReasonableConfidence: number;
}

export type AmbiguitySource =
  | 'dynamic-dispatch'     // Can't statically resolve
  | 'missing-context'      // Need more information
  | 'multiple-patterns'    // Could be multiple patterns
  | 'dead-code'            // Might be dead code
  | 'generated-code'       // Might be generated
  | 'framework-magic';     // Framework does something implicit

export interface ClearScenario {
  /** Unique ID */
  id: string;
  
  /** The scenario */
  scenario: string;
  
  /** Why it's clear */
  claritySource: string;
  
  /** Correct answer */
  correctAnswer: string;
  
  /** Minimum reasonable confidence */
  minReasonableConfidence: number;
}

export interface CalibrationCurve {
  /** Bins for calibration measurement */
  bins: {
    confidenceRange: { min: number; max: number };
    expectedAccuracy: number;
    tolerance: number;
  }[];
}

// ============================================================================
// Scoring for Understanding
// ============================================================================

export interface UnderstandingScore {
  /** Architectural intent score */
  architecturalIntent: {
    decisionRecognition: number;
    tradeoffIdentification: number;
    probeAccuracy: number;
    overall: number;
  };
  
  /** Causal reasoning score */
  causalReasoning: {
    counterfactualAccuracy: number;
    effectPrediction: number;
    causalChainReconstruction: number;
    overall: number;
  };
  
  /** Uncertainty quantification score */
  uncertainty: {
    calibrationError: number;  // Lower is better (ECE)
    ambiguityRecognition: number;
    confidenceAppropriatenss: number;
    overall: number;
  };
  
  /** Combined understanding score */
  overall: number;
}

/**
 * Expected Calibration Error (ECE) calculation
 * 
 * ECE = Σ (|bin_accuracy - bin_confidence| × bin_size / total_samples)
 * 
 * A perfectly calibrated model has ECE = 0
 */
export interface CalibrationMetrics {
  /** Expected Calibration Error */
  ece: number;
  
  /** Maximum Calibration Error */
  mce: number;
  
  /** Per-bin metrics */
  bins: {
    confidenceRange: { min: number; max: number };
    samples: number;
    accuracy: number;
    avgConfidence: number;
    calibrationError: number;
  }[];
  
  /** Reliability diagram data */
  reliabilityDiagram: {
    confidence: number[];
    accuracy: number[];
    ideal: number[];
  };
}
