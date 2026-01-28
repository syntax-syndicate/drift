/**
 * CIBench Pattern Ground Truth Schema
 * 
 * Defines expected patterns in a benchmark codebase.
 */

export interface PatternGroundTruth {
  /** Schema version */
  version: '1.0.0';
  
  /** Expected patterns */
  patterns: ExpectedPattern[];
  
  /** Expected outliers (deviations from patterns) */
  outliers: ExpectedOutlier[];
  
  /** Patterns that should NOT be detected (false positive traps) */
  falsePositiveTraps: FalsePositiveTrap[];
}

export interface ExpectedPattern {
  /** Unique ID for this pattern */
  id: string;
  
  /** Pattern category */
  category: PatternCategory;
  
  /** Subcategory */
  subcategory: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description of the pattern */
  description: string;
  
  /** All locations where this pattern appears */
  locations: PatternLocation[];
  
  /** Minimum confidence a tool should have */
  expectedConfidence: 'high' | 'medium' | 'low';
  
  /** How important is detecting this pattern? */
  importance: 'critical' | 'important' | 'nice-to-have';
  
  /** Notes for annotators/evaluators */
  notes?: string;
}

export interface PatternLocation {
  /** File path relative to codebase root */
  file: string;
  
  /** Line number (1-indexed) */
  line: number;
  
  /** Column (1-indexed, optional) */
  column?: number;
  
  /** End line for multi-line patterns */
  endLine?: number;
  
  /** The actual code snippet (for verification) */
  snippet?: string;
}

export interface ExpectedOutlier {
  /** Which pattern this is an outlier of */
  patternId: string;
  
  /** Location of the outlier */
  location: PatternLocation;
  
  /** Why this is an outlier */
  reason: string;
  
  /** Severity of the deviation */
  severity: 'error' | 'warning' | 'info';
  
  /** Is this intentional (acceptable) or a bug? */
  intentional: boolean;
}

export interface FalsePositiveTrap {
  /** What a naive tool might incorrectly detect */
  wouldDetectAs: {
    category: PatternCategory;
    name: string;
  };
  
  /** Location of the trap */
  location: PatternLocation;
  
  /** Why this is NOT actually that pattern */
  explanation: string;
}

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
  | 'documentation';
