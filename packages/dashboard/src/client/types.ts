/**
 * Drift Dashboard Client Types
 *
 * Shared type definitions for the dashboard client.
 */

// Pattern types
export type PatternStatus = 'discovered' | 'approved' | 'ignored';
export type PatternCategory =
  | 'api'
  | 'auth'
  | 'security'
  | 'errors'
  | 'logging'
  | 'data-access'
  | 'config'
  | 'testing'
  | 'performance'
  | 'components'
  | 'styling'
  | 'structural'
  | 'types'
  | 'accessibility'
  | 'documentation'
  | 'validation'
  | 'error-handling'
  | 'other';

export interface Pattern {
  id: string;
  name: string;
  category: PatternCategory;
  status: PatternStatus;
  confidence: {
    score: number;
    level: 'high' | 'medium' | 'low' | 'uncertain';
  };
  locationCount: number;
  outlierCount: number;
}

export interface PatternWithLocations extends Pattern {
  locations: SemanticLocation[];
  outliers: SemanticLocation[];
}

// Violation types
export type Severity = 'error' | 'warning' | 'info' | 'hint';

export interface Violation {
  id: string;
  patternId: string;
  patternName: string;
  severity: Severity;
  file: string;
  range: Range;
  message: string;
  expected: string;
  actual: string;
  codeSnippet?: string;
}

// Location types
export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface SemanticLocation {
  file: string;
  range: Range;
  name?: string;
  kind?: string;
  reason?: string;
}

// File tree types
export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  patternCount?: number;
  violationCount?: number;
  severity?: Severity;
}

export interface FileDetails {
  path: string;
  language: string;
  lineCount: number;
  patterns: Array<{
    id: string;
    name: string;
    category: PatternCategory;
    locations: SemanticLocation[];
  }>;
  violations: Violation[];
}

// Stats types
export interface DashboardStats {
  healthScore: number;
  patterns: {
    total: number;
    byStatus: Record<PatternStatus, number>;
    byCategory: Record<PatternCategory, number>;
  };
  violations: {
    total: number;
    bySeverity: Record<Severity, number>;
  };
  files: {
    total: number;
    scanned: number;
  };
  detectors: {
    active: number;
    total: number;
  };
  lastScan: string | null;
}

// Config types
export interface DetectorConfig {
  id: string;
  name: string;
  enabled: boolean;
  category: PatternCategory;
  options?: Record<string, unknown>;
}

export interface DriftConfig {
  version: string;
  detectors: DetectorConfig[];
  severityOverrides: Record<string, Severity>;
  ignorePatterns: string[];
  watchOptions?: {
    debounce: number;
    categories?: PatternCategory[];
  };
}

// Filter types
export interface PatternFilters {
  category?: PatternCategory;
  status?: PatternStatus;
  minConfidence?: number;
  search?: string;
}

export interface ViolationFilters {
  severity?: Severity;
  file?: string;
  patternId?: string;
  search?: string;
}

// Tab types
export type TabId = 'overview' | 'patterns' | 'violations' | 'files' | 'contracts' | 'galaxy' | 'settings';

// Connection status
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

// Contract types (BE↔FE mismatch detection)
export type ContractStatus = 'discovered' | 'verified' | 'mismatch' | 'ignored';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ContractField {
  name: string;
  type: string;
  optional: boolean;
  nullable?: boolean;
}

export interface FieldMismatch {
  fieldPath: string;
  mismatchType: 'missing_in_frontend' | 'missing_in_backend' | 'type_mismatch' | 'optionality_mismatch' | 'nullability_mismatch';
  description: string;
  severity: 'error' | 'warning' | 'info';
  backendField?: ContractField;
  frontendField?: ContractField;
}

export interface Contract {
  id: string;
  method: HttpMethod;
  endpoint: string;
  status: ContractStatus;
  backend: {
    file: string;
    line: number;
    framework: string;
    responseFields: ContractField[];
  };
  frontend: Array<{
    file: string;
    line: number;
    library: string;
    responseType?: string;
    responseFields: ContractField[];
  }>;
  mismatches: FieldMismatch[];
  mismatchCount: number;
  confidence: {
    score: number;
    level: 'high' | 'medium' | 'low' | 'uncertain';
  };
  metadata: {
    firstSeen: string;
    lastSeen: string;
    verifiedAt?: string;
  };
}

export interface ContractStats {
  totalContracts: number;
  byStatus: Record<ContractStatus, number>;
  byMethod: Record<HttpMethod, number>;
  totalMismatches: number;
  mismatchesByType: Record<string, number>;
}

export interface ContractFilters {
  status?: ContractStatus;
  method?: HttpMethod;
  hasMismatches?: boolean;
  search?: string;
}

// WebSocket message types
export type WebSocketMessage =
  | { type: 'violation'; payload: Violation }
  | { type: 'pattern_updated'; payload: { id: string; status: PatternStatus } }
  | { type: 'patterns_changed'; payload: { type: string; category: string; status: string } }
  | { type: 'stats_updated'; payload: DashboardStats }
  | { type: 'ping' }
  | { type: 'pong' };

// Trend types (pattern regression detection)
export interface PatternSnapshot {
  patternId: string;
  patternName: string;
  category: PatternCategory;
  confidence: number;
  locationCount: number;
  outlierCount: number;
  complianceRate: number;
  status: PatternStatus;
}

export interface CategorySummary {
  patternCount: number;
  avgConfidence: number;
  totalLocations: number;
  totalOutliers: number;
  complianceRate: number;
}

export interface HistorySnapshot {
  timestamp: string;
  date: string;
  patterns: PatternSnapshot[];
  summary: {
    totalPatterns: number;
    avgConfidence: number;
    totalLocations: number;
    totalOutliers: number;
    overallComplianceRate: number;
    byCategory: Record<string, CategorySummary>;
  };
}

export interface PatternTrend {
  patternId: string;
  patternName: string;
  category: PatternCategory;
  type: 'regression' | 'improvement' | 'stable';
  metric: 'confidence' | 'compliance' | 'outliers';
  previousValue: number;
  currentValue: number;
  change: number;
  changePercent: number;
  severity: 'critical' | 'warning' | 'info';
  firstSeen: string;
  details: string;
}

export interface TrendSummary {
  period: '7d' | '30d' | '90d';
  startDate: string;
  endDate: string;
  regressions: PatternTrend[];
  improvements: PatternTrend[];
  stable: number;
  overallTrend: 'improving' | 'declining' | 'stable';
  healthDelta: number;
  categoryTrends: Record<string, {
    trend: 'improving' | 'declining' | 'stable';
    avgConfidenceChange: number;
    complianceChange: number;
  }>;
}
