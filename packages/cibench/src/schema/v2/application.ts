/**
 * CIBench v2 Application Schema (Level 3)
 * 
 * Measures how well understanding translates to practical application:
 * - Token Efficiency: Getting the right context with minimal tokens
 * - Compositional Reasoning: Combining multiple pieces of knowledge
 * - Iterative Refinement: Improving with feedback
 * - Negative Knowledge: Knowing what NOT to look at
 */

// ============================================================================
// Token Efficiency
// ============================================================================

/**
 * Measures how efficiently a tool can gather relevant context.
 * The best tool gets the most relevant information with the fewest tokens.
 */
export interface TokenEfficiencyGroundTruth {
  version: '2.0.0';
  
  /** Tasks with known optimal context */
  tasks: EfficiencyTask[];
  
  /** Baseline measurements */
  baselines: EfficiencyBaseline[];
}

export interface EfficiencyTask {
  /** Unique ID */
  id: string;
  
  /** Task description */
  task: string;
  
  /** Category */
  category: TaskCategory;
  
  /** Optimal context (what a perfect tool would retrieve) */
  optimalContext: OptimalContext;
  
  /** Noise files (should NOT be retrieved) */
  noiseFiles: NoiseFile[];
  
  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
}

export type TaskCategory =
  | 'add-feature' | 'fix-bug' | 'refactor' | 'add-test'
  | 'security-fix' | 'performance' | 'documentation';

export interface OptimalContext {
  /** Files that must be included */
  requiredFiles: {
    file: string;
    relevance: 'critical' | 'important' | 'helpful';
    sections?: { startLine: number; endLine: number }[];
    tokenEstimate: number;
  }[];
  
  /** Patterns that should be identified */
  requiredPatterns: string[];
  
  /** Constraints that must be known */
  requiredConstraints: string[];
  
  /** Total optimal token count */
  optimalTokens: number;
  
  /** Maximum acceptable token count */
  maxAcceptableTokens: number;
}

export interface NoiseFile {
  /** File path */
  file: string;
  
  /** Why it's noise (not relevant) */
  reason: string;
  
  /** How tempting it is to include (false positive risk) */
  temptation: 'low' | 'medium' | 'high';
  
  /** Token cost if included */
  tokenCost: number;
}

export interface EfficiencyBaseline {
  /** Baseline name */
  name: string;
  
  /** Strategy */
  strategy: 'naive-grep' | 'file-tree' | 'random' | 'all-files';
  
  /** Expected token count */
  expectedTokens: number;
  
  /** Expected relevance score */
  expectedRelevance: number;
}

// ============================================================================
// Compositional Reasoning
// ============================================================================

/**
 * Tests ability to combine multiple pieces of knowledge.
 * Real tasks require synthesizing information from multiple sources.
 */
export interface CompositionalGroundTruth {
  version: '2.0.0';
  
  /** Multi-step reasoning tasks */
  tasks: CompositionalTask[];
  
  /** Knowledge dependencies */
  dependencies: KnowledgeDependency[];
}

export interface CompositionalTask {
  /** Unique ID */
  id: string;
  
  /** Task description */
  task: string;
  
  /** Required knowledge pieces */
  requiredKnowledge: KnowledgePiece[];
  
  /** How pieces must be combined */
  composition: CompositionStep[];
  
  /** Expected output */
  expectedOutput: {
    type: 'code' | 'explanation' | 'plan' | 'decision';
    criteria: string[];
  };
  
  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
}

export interface KnowledgePiece {
  /** Unique ID */
  id: string;
  
  /** Type of knowledge */
  type: KnowledgeType;
  
  /** Source location */
  source: { file: string; line?: number };
  
  /** The knowledge itself */
  content: string;
  
  /** Is this knowledge explicit or implicit? */
  explicit: boolean;
}

export type KnowledgeType =
  | 'pattern'           // A coding pattern
  | 'constraint'        // A constraint/rule
  | 'type-definition'   // Type information
  | 'api-contract'      // API contract
  | 'business-rule'     // Business logic
  | 'convention'        // Naming/style convention
  | 'dependency';       // Dependency relationship

export interface CompositionStep {
  /** Step number */
  step: number;
  
  /** Knowledge pieces used */
  inputs: string[];
  
  /** Operation performed */
  operation: CompositionOperation;
  
  /** Output of this step */
  output: string;
}

export type CompositionOperation =
  | 'combine'           // Combine multiple pieces
  | 'infer'             // Infer from pieces
  | 'apply'             // Apply pattern to context
  | 'validate'          // Validate against constraint
  | 'transform'         // Transform based on convention
  | 'resolve-conflict'; // Resolve conflicting information

export interface KnowledgeDependency {
  /** Knowledge piece that depends */
  dependent: string;
  
  /** Knowledge piece depended on */
  dependency: string;
  
  /** Type of dependency */
  type: 'requires' | 'extends' | 'conflicts' | 'supersedes';
}

// ============================================================================
// Iterative Refinement
// ============================================================================

/**
 * Tests ability to improve with feedback.
 * Good tools should get better when given hints or corrections.
 */
export interface RefinementGroundTruth {
  version: '2.0.0';
  
  /** Refinement scenarios */
  scenarios: RefinementScenario[];
}

export interface RefinementScenario {
  /** Unique ID */
  id: string;
  
  /** Initial task */
  initialTask: string;
  
  /** Expected initial attempt (may be imperfect) */
  expectedInitialAttempt: {
    quality: 'poor' | 'partial' | 'good';
    missingElements: string[];
    incorrectElements: string[];
  };
  
  /** Feedback sequence */
  feedbackSequence: FeedbackStep[];
  
  /** Expected final quality */
  expectedFinalQuality: number;
  
  /** Maximum iterations to reach quality */
  maxIterations: number;
}

export interface FeedbackStep {
  /** Step number */
  step: number;
  
  /** Feedback provided */
  feedback: {
    type: FeedbackType;
    content: string;
  };
  
  /** Expected improvement */
  expectedImprovement: {
    elementsFixed: string[];
    newElementsAdded: string[];
    qualityIncrease: number;
  };
}

export type FeedbackType =
  | 'error-message'     // Compilation/runtime error
  | 'test-failure'      // Test failure output
  | 'review-comment'    // Human review comment
  | 'hint'              // Helpful hint
  | 'constraint'        // Constraint violation
  | 'example';          // Example of correct approach

// ============================================================================
// Negative Knowledge
// ============================================================================

/**
 * Tests knowing what NOT to do - often more important than knowing what to do.
 * Prevents wasted tokens, wrong patterns, and dangerous changes.
 */
export interface NegativeKnowledgeGroundTruth {
  version: '2.0.0';
  
  /** Things to avoid */
  avoidances: Avoidance[];
  
  /** Anti-patterns in the codebase */
  antiPatterns: AntiPattern[];
  
  /** Dangerous areas */
  dangerZones: DangerZone[];
}

export interface Avoidance {
  /** Unique ID */
  id: string;
  
  /** What to avoid */
  avoid: string;
  
  /** Why to avoid it */
  reason: string;
  
  /** Context where this applies */
  context: string;
  
  /** What to do instead */
  alternative: string;
  
  /** Severity if violated */
  severity: 'suggestion' | 'warning' | 'error' | 'critical';
}

export interface AntiPattern {
  /** Unique ID */
  id: string;
  
  /** The anti-pattern */
  pattern: string;
  
  /** Why it's bad */
  problem: string;
  
  /** Locations where it exists (legacy) */
  existingLocations: { file: string; line: number }[];
  
  /** Should new code follow this? */
  allowNew: boolean;
  
  /** Preferred alternative */
  alternative: string;
}

export interface DangerZone {
  /** Unique ID */
  id: string;
  
  /** File or area */
  location: { file: string; startLine?: number; endLine?: number };
  
  /** Why it's dangerous */
  danger: string;
  
  /** What could go wrong */
  consequences: string[];
  
  /** Required precautions if modifying */
  precautions: string[];
  
  /** Danger level */
  level: 'caution' | 'warning' | 'danger' | 'critical';
}

// ============================================================================
// Application Scoring
// ============================================================================

export interface ApplicationScore {
  /** Token efficiency score */
  tokenEfficiency: {
    /** Relevance of retrieved context (0-1) */
    relevance: number;
    /** Token efficiency ratio (optimal/actual) */
    efficiency: number;
    /** Noise ratio (noise tokens / total tokens) */
    noiseRatio: number;
    /** Overall score */
    overall: number;
  };
  
  /** Compositional reasoning score */
  compositional: {
    /** Knowledge piece identification */
    knowledgeIdentification: number;
    /** Composition accuracy */
    compositionAccuracy: number;
    /** Output quality */
    outputQuality: number;
    /** Overall score */
    overall: number;
  };
  
  /** Iterative refinement score */
  refinement: {
    /** Improvement rate per iteration */
    improvementRate: number;
    /** Final quality achieved */
    finalQuality: number;
    /** Iterations needed */
    iterationsNeeded: number;
    /** Overall score */
    overall: number;
  };
  
  /** Negative knowledge score */
  negativeKnowledge: {
    /** Avoidance recognition */
    avoidanceRecognition: number;
    /** Anti-pattern awareness */
    antiPatternAwareness: number;
    /** Danger zone respect */
    dangerZoneRespect: number;
    /** Overall score */
    overall: number;
  };
  
  /** Combined application score */
  overall: number;
}

/**
 * Token efficiency calculation
 * 
 * Efficiency = (relevance_score × optimal_tokens) / actual_tokens
 * 
 * Where:
 * - relevance_score = weighted sum of retrieved relevant content
 * - optimal_tokens = minimum tokens needed for task
 * - actual_tokens = tokens actually used
 */
export interface TokenEfficiencyMetrics {
  /** Tokens used */
  tokensUsed: number;
  
  /** Optimal tokens */
  optimalTokens: number;
  
  /** Efficiency ratio */
  efficiency: number;
  
  /** Relevance breakdown */
  relevance: {
    criticalFound: number;
    criticalTotal: number;
    importantFound: number;
    importantTotal: number;
    helpfulFound: number;
    helpfulTotal: number;
    noiseIncluded: number;
  };
  
  /** Weighted relevance score */
  weightedRelevance: number;
}
