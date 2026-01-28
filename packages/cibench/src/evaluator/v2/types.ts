/**
 * CIBench v2 Evaluator Types
 */

import type { EvaluationLevel, CategoryWeights } from '../../schema/v2/manifest.js';

// ============================================================================
// Evaluation Results
// ============================================================================

export interface V2EvaluationResult {
  /** Corpus ID */
  corpusId: string;
  
  /** Tool being evaluated */
  tool: {
    name: string;
    version: string;
  };
  
  /** Timestamp */
  timestamp: string;
  
  /** Overall score (0-100) */
  overallScore: number;
  
  /** Level scores */
  levels: {
    perception: LevelScore;
    understanding: LevelScore;
    application: LevelScore;
    validation: LevelScore;
  };
  
  /** Detailed breakdown */
  breakdown: V2ScoreBreakdown;
  
  /** Calibration metrics */
  calibration: CalibrationResult;
  
  /** Probe results */
  probes: ProbeResults;
  
  /** Metadata */
  metadata: EvaluationMetadata;
}

export interface LevelScore {
  /** Score for this level (0-100) */
  score: number;
  
  /** Weight of this level */
  weight: number;
  
  /** Weighted contribution to overall */
  weightedScore: number;
  
  /** Category breakdown */
  categories: Record<string, CategoryScore>;
}

export interface CategoryScore {
  /** Raw score (0-100) */
  score: number;
  
  /** Weight within level */
  weight: number;
  
  /** Precision */
  precision?: number;
  
  /** Recall */
  recall?: number;
  
  /** F1 */
  f1?: number;
  
  /** Additional metrics */
  metrics?: Record<string, number>;
}

export interface V2ScoreBreakdown {
  // Level 1: Perception
  patternRecognition: PatternScore;
  callGraphAccuracy: CallGraphScore;
  dataFlowTracking: DataFlowScore;
  
  // Level 2: Understanding
  architecturalIntent: IntentScore;
  causalReasoning: CausalScore;
  uncertaintyQuantification: UncertaintyScore;
  
  // Level 3: Application
  tokenEfficiency: EfficiencyScore;
  compositionalReasoning: CompositionalScore;
  iterativeRefinement: RefinementScore;
  negativeKnowledge: NegativeKnowledgeScore;
  
  // Level 4: Validation
  humanCorrelation: CorrelationScore;
}

// ============================================================================
// Level 1: Perception Scores
// ============================================================================

export interface PatternScore {
  /** Overall score */
  score: number;
  
  /** Pattern detection */
  detection: {
    precision: number;
    recall: number;
    f1: number;
    byCategory: Record<string, { precision: number; recall: number }>;
  };
  
  /** Outlier detection */
  outliers: {
    precision: number;
    recall: number;
    f1: number;
  };
  
  /** Relationship detection */
  relationships: {
    precision: number;
    recall: number;
  };
}

export interface CallGraphScore {
  /** Overall score */
  score: number;
  
  /** Function detection */
  functions: {
    precision: number;
    recall: number;
    f1: number;
  };
  
  /** Call edge detection */
  calls: {
    precision: number;
    recall: number;
    f1: number;
    byType: Record<string, { precision: number; recall: number }>;
  };
  
  /** Dynamic dispatch resolution */
  dynamicDispatch: {
    resolutionRate: number;
    accuracy: number;
  };
  
  /** Entry point detection */
  entryPoints: {
    precision: number;
    recall: number;
  };
}

export interface DataFlowScore {
  /** Overall score */
  score: number;
  
  /** Source detection */
  sources: {
    precision: number;
    recall: number;
  };
  
  /** Sink detection */
  sinks: {
    precision: number;
    recall: number;
  };
  
  /** Flow tracking */
  flows: {
    precision: number;
    recall: number;
    pathAccuracy: number;
  };
  
  /** Violation detection */
  violations: {
    precision: number;
    recall: number;
  };
}

// ============================================================================
// Level 2: Understanding Scores
// ============================================================================

export interface IntentScore {
  /** Overall score */
  score: number;
  
  /** Decision recognition */
  decisions: {
    recognized: number;
    total: number;
    accuracy: number;
  };
  
  /** Tradeoff identification */
  tradeoffs: {
    identified: number;
    total: number;
    accuracy: number;
  };
  
  /** Probe performance */
  probes: {
    averageScore: number;
    byDifficulty: Record<string, number>;
  };
}

export interface CausalScore {
  /** Overall score */
  score: number;
  
  /** Counterfactual accuracy */
  counterfactual: {
    effectPrediction: number;
    unaffectedPrediction: number;
    overallAccuracy: number;
  };
  
  /** Causal chain reconstruction */
  causalChains: {
    accuracy: number;
    completeness: number;
  };
  
  /** Intervention prediction */
  interventions: {
    accuracy: number;
    magnitudeAccuracy: number;
  };
}

export interface UncertaintyScore {
  /** Overall score */
  score: number;
  
  /** Expected Calibration Error (lower is better) */
  ece: number;
  
  /** Maximum Calibration Error */
  mce: number;
  
  /** Ambiguity recognition */
  ambiguityRecognition: {
    accuracy: number;
    appropriateConfidence: number;
  };
  
  /** Overconfidence rate */
  overconfidenceRate: number;
  
  /** Underconfidence rate */
  underconfidenceRate: number;
}

// ============================================================================
// Level 3: Application Scores
// ============================================================================

export interface EfficiencyScore {
  /** Overall score */
  score: number;
  
  /** Token efficiency */
  tokens: {
    used: number;
    optimal: number;
    efficiency: number;
  };
  
  /** Relevance */
  relevance: {
    criticalCoverage: number;
    importantCoverage: number;
    noiseRatio: number;
    weightedRelevance: number;
  };
}

export interface CompositionalScore {
  /** Overall score */
  score: number;
  
  /** Knowledge identification */
  knowledgeIdentification: {
    found: number;
    total: number;
    accuracy: number;
  };
  
  /** Composition accuracy */
  composition: {
    stepsCorrect: number;
    totalSteps: number;
    accuracy: number;
  };
  
  /** Output quality */
  outputQuality: number;
}

export interface RefinementScore {
  /** Overall score */
  score: number;
  
  /** Improvement rate */
  improvementRate: number;
  
  /** Final quality */
  finalQuality: number;
  
  /** Iterations needed */
  iterationsNeeded: number;
  
  /** Feedback utilization */
  feedbackUtilization: number;
}

export interface NegativeKnowledgeScore {
  /** Overall score */
  score: number;
  
  /** Avoidance recognition */
  avoidances: {
    recognized: number;
    total: number;
    accuracy: number;
  };
  
  /** Anti-pattern awareness */
  antiPatterns: {
    recognized: number;
    total: number;
    accuracy: number;
  };
  
  /** Danger zone respect */
  dangerZones: {
    respected: number;
    total: number;
    accuracy: number;
  };
}

// ============================================================================
// Level 4: Validation Scores
// ============================================================================

export interface CorrelationScore {
  /** Overall score */
  score: number;
  
  /** Correlation with human judgments */
  humanCorrelation: {
    pearson: number;
    spearman: number;
    kendall: number;
  };
  
  /** Agreement rate */
  agreementRate: number;
  
  /** Disagreement analysis */
  disagreements: {
    overestimated: number;
    underestimated: number;
    total: number;
  };
}

// ============================================================================
// Calibration
// ============================================================================

export interface CalibrationResult {
  /** Expected Calibration Error */
  ece: number;
  
  /** Maximum Calibration Error */
  mce: number;
  
  /** Brier score */
  brierScore: number;
  
  /** Per-bin results */
  bins: CalibrationBin[];
  
  /** Reliability diagram data */
  reliabilityDiagram: {
    confidence: number[];
    accuracy: number[];
    samples: number[];
  };
}

export interface CalibrationBin {
  /** Confidence range */
  range: { min: number; max: number };
  
  /** Number of samples */
  samples: number;
  
  /** Average confidence */
  avgConfidence: number;
  
  /** Actual accuracy */
  accuracy: number;
  
  /** Calibration error for this bin */
  error: number;
}

// ============================================================================
// Probes
// ============================================================================

export interface ProbeResults {
  /** Overall probe score */
  overallScore: number;
  
  /** By type */
  byType: {
    explanation: ProbeTypeResult;
    prediction: ProbeTypeResult;
    comparison: ProbeTypeResult;
    synthesis: ProbeTypeResult;
    adversarial: ProbeTypeResult;
  };
  
  /** By difficulty */
  byDifficulty: {
    easy: ProbeTypeResult;
    medium: ProbeTypeResult;
    hard: ProbeTypeResult;
    expert: ProbeTypeResult;
  };
  
  /** Individual results */
  individual: IndividualProbeResult[];
}

export interface ProbeTypeResult {
  /** Score */
  score: number;
  
  /** Count */
  count: number;
  
  /** Pass rate */
  passRate: number;
}

export interface IndividualProbeResult {
  /** Probe ID */
  probeId: string;
  
  /** Type */
  type: string;
  
  /** Difficulty */
  difficulty: string;
  
  /** Score */
  score: number;
  
  /** Passed */
  passed: boolean;
  
  /** Elements found */
  elementsFound: string[];
  
  /** Elements missed */
  elementsMissed: string[];
}

// ============================================================================
// Metadata
// ============================================================================

export interface EvaluationMetadata {
  /** Evaluation duration (ms) */
  duration: number;
  
  /** Levels evaluated */
  levelsEvaluated: EvaluationLevel[];
  
  /** Weights used */
  weights: CategoryWeights;
  
  /** Warnings */
  warnings: string[];
  
  /** Errors */
  errors: string[];
}
