/**
 * CIBench v2 Perception Schema (Level 1)
 * 
 * Measures basic codebase perception: pattern detection, call graphs,
 * data flow tracking. This is "table stakes" - necessary but not sufficient.
 * 
 * v2 improvements:
 * - Confidence-weighted scoring
 * - Partial credit for near-misses
 * - Calibration measurement
 */

// ============================================================================
// Pattern Recognition
// ============================================================================

export interface PatternGroundTruth {
  version: '2.0.0';
  patterns: ExpectedPattern[];
  outliers: ExpectedOutlier[];
  
  /** v2: Pattern relationships */
  relationships: PatternRelationship[];
  
  /** v2: Pattern evolution (if git history available) */
  evolution?: PatternEvolution[];
}

export interface ExpectedPattern {
  /** Unique ID */
  id: string;
  
  /** Pattern category */
  category: PatternCategory;
  
  /** Pattern name */
  name: string;
  
  /** Description */
  description: string;
  
  /** All locations where this pattern appears */
  locations: PatternLocation[];
  
  /** v2: Confidence in ground truth (for calibration) */
  groundTruthConfidence: number;
  
  /** v2: Difficulty of detection */
  detectionDifficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'expert';
  
  /** v2: Why this pattern exists (architectural intent) */
  intent?: string;
}

export type PatternCategory =
  | 'api' | 'auth' | 'data-access' | 'error-handling'
  | 'logging' | 'validation' | 'caching' | 'config'
  | 'testing' | 'security' | 'performance' | 'structural';

export interface PatternLocation {
  file: string;
  line: number;
  endLine?: number;
  
  /** v2: Confidence this is a true instance */
  confidence?: number;
  
  /** v2: Variant of the pattern (if applicable) */
  variant?: string;
}

export interface ExpectedOutlier {
  /** Pattern this deviates from */
  patternId: string;
  
  /** Location of outlier */
  location: PatternLocation;
  
  /** Why it's an outlier */
  reason: string;
  
  /** v2: Is this intentional or accidental? */
  intentional: boolean;
  
  /** v2: Severity of the deviation */
  severity: 'info' | 'warning' | 'error';
}

export interface PatternRelationship {
  /** Source pattern */
  from: string;
  
  /** Target pattern */
  to: string;
  
  /** Relationship type */
  type: 'depends-on' | 'extends' | 'conflicts-with' | 'co-occurs' | 'replaces';
  
  /** Strength of relationship */
  strength: number;
}

export interface PatternEvolution {
  /** Pattern ID */
  patternId: string;
  
  /** Commit where pattern was introduced */
  introducedAt: string;
  
  /** Commits where pattern was modified */
  modifications: {
    commit: string;
    description: string;
    locationsAdded: number;
    locationsRemoved: number;
  }[];
}

// ============================================================================
// Call Graph
// ============================================================================

export interface CallGraphGroundTruth {
  version: '2.0.0';
  functions: ExpectedFunction[];
  calls: ExpectedCall[];
  entryPoints: ExpectedEntryPoint[];
  
  /** v2: Dynamic dispatch scenarios */
  dynamicDispatch: DynamicDispatchScenario[];
  
  /** v2: Cross-boundary calls */
  boundaryTransitions: BoundaryTransition[];
}

export interface ExpectedFunction {
  /** Unique ID (file:name or qualified name) */
  id: string;
  
  /** File path */
  file: string;
  
  /** Function name */
  name: string;
  
  /** Line number */
  line: number;
  
  /** Function type */
  type: FunctionType;
  
  /** v2: Visibility/scope */
  visibility: 'public' | 'private' | 'internal' | 'protected';
  
  /** v2: Complexity metrics */
  complexity?: {
    cyclomatic: number;
    cognitive: number;
  };
}

export type FunctionType =
  | 'function' | 'method' | 'constructor' | 'getter' | 'setter'
  | 'lambda' | 'callback' | 'handler' | 'middleware';

export interface ExpectedCall {
  /** Caller function ID */
  caller: string;
  
  /** Callee function ID */
  callee: string;
  
  /** Call site location */
  callSite: {
    file: string;
    line: number;
  };
  
  /** Can this be statically resolved? */
  staticResolvable: boolean;
  
  /** v2: Call type */
  callType: CallType;
  
  /** v2: Confidence in ground truth */
  confidence: number;
}

export type CallType =
  | 'direct'           // Direct function call
  | 'method'           // Method call on known type
  | 'virtual'          // Virtual/interface dispatch
  | 'callback'         // Callback invocation
  | 'dynamic'          // Dynamic dispatch (eval, reflection)
  | 'async'            // Async/await
  | 'event';           // Event emission/handling

export interface ExpectedEntryPoint {
  /** Function ID */
  functionId: string;
  
  /** Entry point type */
  type: EntryPointType;
  
  /** Route/trigger (if applicable) */
  trigger?: string;
}

export type EntryPointType =
  | 'http-handler' | 'cli-command' | 'event-handler'
  | 'scheduled-job' | 'websocket-handler' | 'main';

export interface DynamicDispatchScenario {
  /** Scenario ID */
  id: string;
  
  /** Description */
  description: string;
  
  /** Call site */
  callSite: { file: string; line: number };
  
  /** Possible targets */
  possibleTargets: string[];
  
  /** How to resolve (for evaluation) */
  resolutionHint: string;
  
  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard' | 'impossible';
}

export interface BoundaryTransition {
  /** Call ID */
  callId: string;
  
  /** Source boundary */
  from: string;
  
  /** Target boundary */
  to: string;
  
  /** Data passed across boundary */
  dataTransferred?: string[];
}

// ============================================================================
// Data Flow
// ============================================================================

export interface DataFlowGroundTruth {
  version: '2.0.0';
  sources: DataSource[];
  sinks: DataSink[];
  flows: DataFlow[];
  
  /** v2: Sensitive data classification */
  sensitiveData: SensitiveDataClassification[];
  
  /** v2: Boundary violations */
  violations: BoundaryViolation[];
}

export interface DataSource {
  id: string;
  type: SourceType;
  location: { file: string; line: number };
  dataType?: string;
  sensitivity: 'public' | 'internal' | 'sensitive' | 'secret';
}

export type SourceType =
  | 'user-input' | 'database' | 'api-response' | 'file'
  | 'environment' | 'config' | 'session';

export interface DataSink {
  id: string;
  type: SinkType;
  location: { file: string; line: number };
  requiresSanitization: boolean;
}

export type SinkType =
  | 'database-write' | 'api-response' | 'log' | 'file-write'
  | 'external-api' | 'email' | 'render';

export interface DataFlow {
  /** Source ID */
  source: string;
  
  /** Sink ID */
  sink: string;
  
  /** Path through code */
  path: { file: string; line: number }[];
  
  /** Transformations applied */
  transformations: string[];
  
  /** Is this flow safe? */
  safe: boolean;
  
  /** v2: Confidence in ground truth */
  confidence: number;
}

export interface SensitiveDataClassification {
  /** Data identifier */
  dataId: string;
  
  /** Classification */
  classification: 'PII' | 'credentials' | 'financial' | 'health' | 'internal';
  
  /** Locations where this data appears */
  locations: { file: string; line: number }[];
}

export interface BoundaryViolation {
  /** Violation ID */
  id: string;
  
  /** Description */
  description: string;
  
  /** Flow that violates boundary */
  flowId: string;
  
  /** Severity */
  severity: 'warning' | 'error' | 'critical';
}
