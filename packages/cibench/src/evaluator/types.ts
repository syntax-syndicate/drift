/**
 * CIBench Evaluator Types
 * 
 * Types for tool outputs and evaluation results.
 */

import type { BenchmarkCategory } from '../schema/manifest.js';

// ============================================================================
// Tool Output Types (what tools produce)
// ============================================================================

/**
 * Standardized output format that tools must produce
 */
export interface ToolOutput {
  /** Tool identifier */
  tool: string;
  
  /** Tool version */
  version: string;
  
  /** Timestamp */
  timestamp: string;
  
  /** Pattern detection results */
  patterns?: ToolPatternOutput;
  
  /** Call graph results */
  callGraph?: ToolCallGraphOutput;
  
  /** Impact analysis results */
  impact?: ToolImpactOutput[];
  
  /** Data flow results */
  dataFlow?: ToolDataFlowOutput;
  
  /** Convention inference results */
  conventions?: ToolConventionOutput;
  
  /** Agentic grounding results */
  agentic?: ToolAgenticOutput[];
}

export interface ToolPatternOutput {
  patterns: {
    id: string;
    category: string;
    name: string;
    locations: { file: string; line: number; column?: number }[];
    confidence: number;
  }[];
  outliers: {
    patternId: string;
    location: { file: string; line: number };
    reason: string;
  }[];
}

export interface ToolCallGraphOutput {
  functions: {
    id: string;
    name: string;
    file: string;
    line: number;
  }[];
  calls: {
    caller: string;
    callee: string;
    file: string;
    line: number;
  }[];
  entryPoints: string[];
}

export interface ToolImpactOutput {
  testCaseId: string;
  directlyAffected: { file: string; symbol: string; line: number }[];
  transitivelyAffected: { file: string; symbol: string; line: number }[];
  affectedTests: string[];
}

export interface ToolDataFlowOutput {
  sources: { id: string; file: string; line: number; type: string }[];
  sinks: { id: string; file: string; line: number; type: string }[];
  flows: { sourceId: string; sinkId: string; path: { file: string; line: number }[] }[];
  violations: { sourceId: string; sinkId: string; type: string }[];
}

export interface ToolConventionOutput {
  conventions: {
    id: string;
    category: string;
    name: string;
    rule: string;
    examples: { file: string; line: number }[];
  }[];
}

export interface ToolAgenticOutput {
  taskId: string;
  relevantFiles: { file: string; relevance: string; importance: string }[];
  relevantPatterns: { patternId: string; relevance: string }[];
  constraints: { type: string; description: string }[];
  similarCode: { file: string; startLine: number; endLine: number }[];
}

// ============================================================================
// Evaluation Result Types
// ============================================================================

/**
 * Complete evaluation result
 */
export interface EvaluationResult {
  /** Tool being evaluated */
  tool: string;
  
  /** Corpus used */
  corpus: string;
  
  /** Timestamp */
  timestamp: string;
  
  /** Overall score (0-100) */
  overallScore: number;
  
  /** Scores by category */
  categoryScores: Record<BenchmarkCategory, CategoryScore>;
  
  /** Detailed results */
  details: EvaluationDetails;
  
  /** Summary statistics */
  summary: EvaluationSummary;
}

export interface CategoryScore {
  /** Score for this category (0-100) */
  score: number;
  
  /** Weight in overall score */
  weight: number;
  
  /** Weighted contribution to overall */
  weightedScore: number;
  
  /** Breakdown */
  breakdown: {
    precision: number;
    recall: number;
    f1: number;
  };
}

export interface EvaluationDetails {
  patterns?: PatternEvaluationDetail;
  callGraph?: CallGraphEvaluationDetail;
  impact?: ImpactEvaluationDetail;
  dataFlow?: DataFlowEvaluationDetail;
  conventions?: ConventionEvaluationDetail;
  agentic?: AgenticEvaluationDetail;
}

export interface PatternEvaluationDetail {
  /** True positives (correctly identified patterns) */
  truePositives: { patternId: string; locations: number }[];
  
  /** False positives (incorrectly identified patterns) */
  falsePositives: { patternId: string; locations: number }[];
  
  /** False negatives (missed patterns) */
  falseNegatives: { patternId: string; locations: number }[];
  
  /** Outlier detection accuracy */
  outlierAccuracy: {
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
  };
}

export interface CallGraphEvaluationDetail {
  /** Function detection */
  functions: {
    found: number;
    expected: number;
    precision: number;
    recall: number;
  };
  
  /** Call edge detection */
  calls: {
    found: number;
    expected: number;
    precision: number;
    recall: number;
  };
  
  /** Resolution rate for resolvable calls */
  resolutionRate: number;
  
  /** Entry point detection */
  entryPoints: {
    found: number;
    expected: number;
    precision: number;
    recall: number;
  };
}

export interface ImpactEvaluationDetail {
  /** Per-test-case results */
  testCases: {
    id: string;
    directAffectedPrecision: number;
    directAffectedRecall: number;
    transitiveAffectedPrecision: number;
    transitiveAffectedRecall: number;
    testMappingAccuracy: number;
  }[];
  
  /** Aggregate */
  aggregate: {
    directPrecision: number;
    directRecall: number;
    transitivePrecision: number;
    transitiveRecall: number;
  };
}

export interface DataFlowEvaluationDetail {
  /** Source detection */
  sources: { precision: number; recall: number };
  
  /** Sink detection */
  sinks: { precision: number; recall: number };
  
  /** Flow path accuracy */
  flows: { precision: number; recall: number };
  
  /** Violation detection */
  violations: { precision: number; recall: number };
}

export interface ConventionEvaluationDetail {
  /** Convention detection */
  conventions: {
    found: number;
    expected: number;
    precision: number;
    recall: number;
  };
  
  /** Per-convention accuracy */
  perConvention: {
    conventionId: string;
    detected: boolean;
    ruleAccuracy: number; // How well the inferred rule matches
  }[];
}

export interface AgenticEvaluationDetail {
  /** Per-task results */
  tasks: {
    taskId: string;
    fileRelevanceScore: number;
    patternAwarenessScore: number;
    constraintAwarenessScore: number;
    similarCodeScore: number;
    overallScore: number;
  }[];
  
  /** Aggregate */
  aggregate: {
    avgFileRelevance: number;
    avgPatternAwareness: number;
    avgConstraintAwareness: number;
    avgSimilarCode: number;
  };
}

export interface EvaluationSummary {
  /** Total test cases */
  totalTestCases: number;
  
  /** Passed test cases */
  passedTestCases: number;
  
  /** Pass rate */
  passRate: number;
  
  /** Strengths identified */
  strengths: string[];
  
  /** Weaknesses identified */
  weaknesses: string[];
  
  /** Recommendations */
  recommendations: string[];
}
