/**
 * CIBench v2 Manifest Schema
 * 
 * Defines the benchmark corpus metadata and configuration.
 * v2 adds temporal metadata, complexity metrics, and validation requirements.
 */

export interface CIBenchManifest {
  /** Schema version */
  version: '2.0.0';
  
  /** Corpus metadata */
  corpus: CorpusMetadata;
  
  /** Evaluation configuration */
  evaluation: EvaluationConfig;
  
  /** Validation requirements */
  validation: ValidationRequirements;
}

export interface CorpusMetadata {
  /** Unique corpus ID */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description */
  description: string;
  
  /** Primary language */
  language: SupportedLanguage;
  
  /** Framework(s) used */
  frameworks: string[];
  
  /** Codebase size category */
  size: CodebaseSize;
  
  /** Actual metrics */
  metrics: CodebaseMetrics;
  
  /** Git history availability (for temporal reasoning) */
  gitHistory: GitHistoryMetadata;
  
  /** Architectural characteristics */
  architecture: ArchitectureMetadata;
}

export type SupportedLanguage = 
  | 'typescript' | 'javascript' | 'python' | 'go' 
  | 'java' | 'rust' | 'csharp' | 'php' | 'cpp';

export type CodebaseSize = 'small' | 'medium' | 'large' | 'enterprise';

export interface CodebaseMetrics {
  /** Total files */
  files: number;
  
  /** Lines of code (excluding comments/blanks) */
  loc: number;
  
  /** Number of modules/packages */
  modules: number;
  
  /** Cyclomatic complexity (average) */
  avgComplexity: number;
  
  /** Coupling metrics */
  coupling: {
    afferentAvg: number;
    efferentAvg: number;
    instabilityAvg: number;
  };
}

export interface GitHistoryMetadata {
  /** Whether git history is available */
  available: boolean;
  
  /** Number of commits */
  commits?: number;
  
  /** Time span (days) */
  timeSpan?: number;
  
  /** Number of contributors */
  contributors?: number;
  
  /** Major refactors/migrations in history */
  majorChanges?: MajorChange[];
}

export interface MajorChange {
  /** Commit SHA */
  commit: string;
  
  /** Description */
  description: string;
  
  /** Type of change */
  type: 'refactor' | 'migration' | 'architecture' | 'pattern-change';
  
  /** Files affected */
  filesAffected: number;
}

export interface ArchitectureMetadata {
  /** Architecture style */
  style: ArchitectureStyle;
  
  /** Layer structure */
  layers: string[];
  
  /** Key boundaries */
  boundaries: string[];
  
  /** Monorepo structure (if applicable) */
  monorepo?: {
    packages: string[];
    sharedDependencies: string[];
  };
}

export type ArchitectureStyle = 
  | 'layered' | 'hexagonal' | 'microservices' | 'monolith' 
  | 'event-driven' | 'serverless' | 'mixed';

// ============================================================================
// Evaluation Configuration
// ============================================================================

export interface EvaluationConfig {
  /** Enabled evaluation levels */
  levels: EvaluationLevel[];
  
  /** Category weights (must sum to 1.0) */
  weights: CategoryWeights;
  
  /** Timeout configuration */
  timeouts: TimeoutConfig;
  
  /** Scoring configuration */
  scoring: ScoringConfig;
}

export type EvaluationLevel = 
  | 'perception'      // Level 1: Pattern detection, call graphs
  | 'understanding'   // Level 2: Intent, causality, uncertainty
  | 'application'     // Level 3: Efficiency, composition, refinement
  | 'validation';     // Level 4: Human correlation

export interface CategoryWeights {
  // Level 1: Perception (30%)
  patternRecognition: number;
  callGraphAccuracy: number;
  
  // Level 2: Understanding (35%)
  architecturalIntent: number;
  causalReasoning: number;
  uncertaintyQuantification: number;
  
  // Level 3: Application (25%)
  tokenEfficiency: number;
  compositionalReasoning: number;
  iterativeRefinement: number;
  
  // Level 4: Validation (10%)
  humanCorrelation: number;
}

export const DEFAULT_WEIGHTS: CategoryWeights = {
  // Level 1: Perception (30%)
  patternRecognition: 0.15,
  callGraphAccuracy: 0.15,
  
  // Level 2: Understanding (35%)
  architecturalIntent: 0.15,
  causalReasoning: 0.12,
  uncertaintyQuantification: 0.08,
  
  // Level 3: Application (25%)
  tokenEfficiency: 0.10,
  compositionalReasoning: 0.10,
  iterativeRefinement: 0.05,
  
  // Level 4: Validation (10%)
  humanCorrelation: 0.10,
};

export interface TimeoutConfig {
  /** Per-category timeout (ms) */
  perCategory: number;
  
  /** Total evaluation timeout (ms) */
  total: number;
  
  /** Agentic task timeout (ms) */
  agenticTask: number;
}

export interface ScoringConfig {
  /** Minimum confidence for counted predictions */
  minConfidence: number;
  
  /** Partial credit configuration */
  partialCredit: {
    enabled: boolean;
    threshold: number;
  };
  
  /** Calibration scoring */
  calibration: {
    enabled: boolean;
    bins: number;
  };
}

// ============================================================================
// Validation Requirements
// ============================================================================

export interface ValidationRequirements {
  /** Minimum ground truth coverage */
  minCoverage: {
    patterns: number;
    callGraph: number;
    probes: number;
  };
  
  /** Required human validation */
  humanValidation: {
    required: boolean;
    minAnnotators: number;
    agreementThreshold: number;
  };
  
  /** Cross-validation requirements */
  crossValidation: {
    enabled: boolean;
    folds: number;
  };
}
