/**
 * CIBench v2 Probes Schema
 * 
 * Generative probes for testing understanding.
 * Instead of just checking if the tool found the right answer,
 * we ask it to GENERATE explanations, predictions, and reasoning.
 * 
 * This is the key innovation: you can't fake understanding when
 * you have to generate coherent explanations.
 */

// ============================================================================
// Probe Types
// ============================================================================

export interface ProbeGroundTruth {
  version: '2.0.0';
  
  /** Explanation probes */
  explanationProbes: ExplanationProbe[];
  
  /** Prediction probes */
  predictionProbes: PredictionProbe[];
  
  /** Comparison probes */
  comparisonProbes: ComparisonProbe[];
  
  /** Synthesis probes */
  synthesisProbes: SynthesisProbe[];
  
  /** Adversarial probes */
  adversarialProbes: AdversarialProbe[];
}

// ============================================================================
// Explanation Probes
// ============================================================================

/**
 * "Explain why X" - tests understanding through generation
 */
export interface ExplanationProbe {
  /** Unique ID */
  id: string;
  
  /** The question */
  question: string;
  
  /** Target code/concept */
  target: {
    type: 'code' | 'pattern' | 'decision' | 'constraint';
    location?: { file: string; line: number };
    identifier?: string;
  };
  
  /** Expected explanation elements */
  expectedElements: ExplanationElement[];
  
  /** Concepts that indicate misunderstanding */
  misconceptions: Misconception[];
  
  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  
  /** Scoring rubric */
  rubric: ProbeRubric;
}

export interface ExplanationElement {
  /** The concept/fact that should be mentioned */
  concept: string;
  
  /** How important is this element */
  importance: 'required' | 'expected' | 'bonus';
  
  /** Points for including this */
  points: number;
  
  /** Acceptable phrasings */
  acceptablePhrases: string[];
}

export interface Misconception {
  /** The misconception */
  concept: string;
  
  /** Why it's wrong */
  whyWrong: string;
  
  /** Penalty for including this */
  penalty: number;
}

export interface ProbeRubric {
  /** Maximum points */
  maxPoints: number;
  
  /** Minimum points for "pass" */
  passThreshold: number;
  
  /** Coherence weight (0-1) */
  coherenceWeight: number;
  
  /** Completeness weight (0-1) */
  completenessWeight: number;
  
  /** Accuracy weight (0-1) */
  accuracyWeight: number;
}

// ============================================================================
// Prediction Probes
// ============================================================================

/**
 * "What would happen if X" - tests causal understanding
 */
export interface PredictionProbe {
  /** Unique ID */
  id: string;
  
  /** The scenario */
  scenario: string;
  
  /** The hypothetical change */
  change: {
    type: 'add' | 'remove' | 'modify' | 'rename';
    target: { file: string; line?: number };
    description: string;
  };
  
  /** Expected predictions */
  expectedPredictions: Prediction[];
  
  /** Things that should NOT be predicted */
  incorrectPredictions: IncorrectPrediction[];
  
  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  
  /** Scoring rubric */
  rubric: PredictionRubric;
}

export interface Prediction {
  /** What would happen */
  effect: string;
  
  /** Category of effect */
  category: 'compile' | 'runtime' | 'behavior' | 'performance' | 'security' | 'test';
  
  /** Confidence this would happen */
  likelihood: 'certain' | 'likely' | 'possible' | 'unlikely';
  
  /** Points for predicting this */
  points: number;
  
  /** Causal chain (for partial credit) */
  causalChain?: string[];
}

export interface IncorrectPrediction {
  /** The wrong prediction */
  effect: string;
  
  /** Why it's wrong */
  whyWrong: string;
  
  /** Penalty */
  penalty: number;
}

export interface PredictionRubric {
  /** Maximum points */
  maxPoints: number;
  
  /** Points for correct predictions */
  correctPredictionWeight: number;
  
  /** Penalty for incorrect predictions */
  incorrectPredictionPenalty: number;
  
  /** Bonus for causal chain explanation */
  causalChainBonus: number;
  
  /** Penalty for overconfidence */
  overconfidencePenalty: number;
}

// ============================================================================
// Comparison Probes
// ============================================================================

/**
 * "Compare X and Y" - tests relational understanding
 */
export interface ComparisonProbe {
  /** Unique ID */
  id: string;
  
  /** The question */
  question: string;
  
  /** Items to compare */
  items: {
    a: { type: string; identifier: string; location?: { file: string; line: number } };
    b: { type: string; identifier: string; location?: { file: string; line: number } };
  };
  
  /** Expected similarities */
  expectedSimilarities: ComparisonPoint[];
  
  /** Expected differences */
  expectedDifferences: ComparisonPoint[];
  
  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  
  /** Scoring rubric */
  rubric: ComparisonRubric;
}

export interface ComparisonPoint {
  /** The similarity/difference */
  point: string;
  
  /** Dimension of comparison */
  dimension: 'structure' | 'behavior' | 'purpose' | 'performance' | 'usage';
  
  /** Importance */
  importance: 'critical' | 'important' | 'minor';
  
  /** Points */
  points: number;
}

export interface ComparisonRubric {
  /** Maximum points */
  maxPoints: number;
  
  /** Weight for similarities */
  similarityWeight: number;
  
  /** Weight for differences */
  differenceWeight: number;
  
  /** Bonus for insightful comparisons */
  insightBonus: number;
}

// ============================================================================
// Synthesis Probes
// ============================================================================

/**
 * "Given X, Y, Z, what should we do?" - tests integration
 */
export interface SynthesisProbe {
  /** Unique ID */
  id: string;
  
  /** The task */
  task: string;
  
  /** Given information */
  givenInformation: GivenInfo[];
  
  /** Expected synthesis */
  expectedSynthesis: SynthesisExpectation;
  
  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  
  /** Scoring rubric */
  rubric: SynthesisRubric;
}

export interface GivenInfo {
  /** Type of information */
  type: 'pattern' | 'constraint' | 'requirement' | 'context' | 'example';
  
  /** The information */
  content: string;
  
  /** Source (if from codebase) */
  source?: { file: string; line: number };
}

export interface SynthesisExpectation {
  /** Type of expected output */
  outputType: 'plan' | 'code' | 'decision' | 'recommendation';
  
  /** Required elements in output */
  requiredElements: {
    element: string;
    points: number;
  }[];
  
  /** Constraints that must be respected */
  constraints: string[];
  
  /** Quality criteria */
  qualityCriteria: {
    criterion: string;
    weight: number;
  }[];
}

export interface SynthesisRubric {
  /** Maximum points */
  maxPoints: number;
  
  /** Element coverage weight */
  elementCoverageWeight: number;
  
  /** Constraint respect weight */
  constraintRespectWeight: number;
  
  /** Quality weight */
  qualityWeight: number;
  
  /** Coherence weight */
  coherenceWeight: number;
}

// ============================================================================
// Adversarial Probes
// ============================================================================

/**
 * Probes designed to expose weaknesses and biases.
 * A robust tool should handle these gracefully.
 */
export interface AdversarialProbe {
  /** Unique ID */
  id: string;
  
  /** Type of adversarial test */
  type: AdversarialType;
  
  /** The probe */
  probe: string;
  
  /** What makes this adversarial */
  adversarialElement: string;
  
  /** Expected behavior */
  expectedBehavior: ExpectedAdversarialBehavior;
  
  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
}

export type AdversarialType =
  | 'misleading-names'      // Variable names that mislead
  | 'dead-code'             // Code that looks relevant but isn't
  | 'red-herring'           // Distracting but irrelevant code
  | 'outdated-comments'     // Comments that don't match code
  | 'copy-paste-variation'  // Similar code with subtle differences
  | 'framework-magic'       // Implicit framework behavior
  | 'dynamic-dispatch'      // Runtime-determined behavior
  | 'circular-dependency'   // Circular references
  | 'generated-code'        // Auto-generated code
  | 'test-vs-production';   // Test code that looks like production

export interface ExpectedAdversarialBehavior {
  /** Should the tool be fooled? */
  shouldBeFooled: boolean;
  
  /** If not fooled, what should it recognize? */
  shouldRecognize?: string;
  
  /** Acceptable responses */
  acceptableResponses: string[];
  
  /** Unacceptable responses */
  unacceptableResponses: string[];
  
  /** Scoring */
  scoring: {
    correctBehavior: number;
    partialCredit: number;
    fooledPenalty: number;
  };
}

// ============================================================================
// Probe Evaluation
// ============================================================================

export interface ProbeEvaluationResult {
  /** Probe ID */
  probeId: string;
  
  /** Probe type */
  probeType: 'explanation' | 'prediction' | 'comparison' | 'synthesis' | 'adversarial';
  
  /** Tool's response */
  response: string;
  
  /** Score breakdown */
  score: {
    raw: number;
    normalized: number;
    breakdown: Record<string, number>;
  };
  
  /** Elements found */
  elementsFound: string[];
  
  /** Elements missed */
  elementsMissed: string[];
  
  /** Misconceptions detected */
  misconceptionsDetected: string[];
  
  /** Qualitative assessment */
  qualitative: {
    coherence: number;
    completeness: number;
    accuracy: number;
    insight: number;
  };
}

export interface ProbeSetResults {
  /** Overall probe score */
  overallScore: number;
  
  /** By probe type */
  byType: {
    explanation: { score: number; count: number };
    prediction: { score: number; count: number };
    comparison: { score: number; count: number };
    synthesis: { score: number; count: number };
    adversarial: { score: number; count: number };
  };
  
  /** By difficulty */
  byDifficulty: {
    easy: { score: number; count: number };
    medium: { score: number; count: number };
    hard: { score: number; count: number };
    expert: { score: number; count: number };
  };
  
  /** Individual results */
  results: ProbeEvaluationResult[];
  
  /** Calibration metrics (for prediction probes) */
  calibration?: {
    ece: number;
    overconfidenceRate: number;
    underconfidenceRate: number;
  };
}

// ============================================================================
// Probe Generation Helpers
// ============================================================================

/**
 * Template for generating probes from codebase analysis
 */
export interface ProbeTemplate {
  /** Template ID */
  id: string;
  
  /** Probe type */
  type: 'explanation' | 'prediction' | 'comparison' | 'synthesis' | 'adversarial';
  
  /** Question template (with placeholders) */
  questionTemplate: string;
  
  /** Required codebase features */
  requiredFeatures: string[];
  
  /** How to extract expected elements */
  elementExtraction: {
    source: 'pattern' | 'callgraph' | 'dataflow' | 'git-history' | 'manual';
    query: string;
  };
  
  /** Difficulty estimation */
  difficultyEstimation: {
    factors: string[];
    formula: string;
  };
}
