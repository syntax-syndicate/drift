/**
 * CIBench Agentic Grounding Ground Truth Schema
 * 
 * Defines test cases for "given a task, find the right context."
 * This is the killer category - measures how well a tool can ground
 * an agent's work in the actual codebase.
 */

export interface AgenticGroundTruth {
  /** Schema version */
  version: '1.0.0';
  
  /** Test tasks */
  tasks: AgenticTask[];
}

export interface AgenticTask {
  /** Unique ID */
  id: string;
  
  /** The task description (what a user might ask) */
  prompt: string;
  
  /** Category of task */
  category: TaskCategory;
  
  /** Difficulty */
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  
  /** Expected grounding - what the tool should identify */
  expectedGrounding: ExpectedGrounding;
  
  /** What makes this task interesting */
  testsFocus: AgenticFocus[];
  
  /** Notes for evaluators */
  notes?: string;
}

export type TaskCategory =
  | 'add-feature'         // Add new functionality
  | 'fix-bug'             // Fix a bug
  | 'refactor'            // Refactor existing code
  | 'add-test'            // Add test coverage
  | 'security-fix'        // Fix security issue
  | 'performance'         // Performance improvement
  | 'documentation'       // Add/update docs
  | 'migration';          // Migrate/upgrade something

export interface ExpectedGrounding {
  /** Files that are relevant to this task */
  relevantFiles: RelevantFile[];
  
  /** Patterns the agent should be aware of */
  relevantPatterns: RelevantPattern[];
  
  /** Constraints the agent must respect */
  constraints: Constraint[];
  
  /** Similar existing code to use as reference */
  similarCode: SimilarCode[];
  
  /** Files that should NOT be modified */
  doNotModify: DoNotModify[];
  
  /** Tests that should be run/updated */
  relevantTests: string[];
  
  /** Estimated scope */
  estimatedScope: {
    filesToModify: number;
    filesToCreate: number;
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
  };
}

export interface RelevantFile {
  /** File path */
  file: string;
  
  /** Why this file is relevant */
  relevance: FileRelevance;
  
  /** How important is this file to the task? */
  importance: 'critical' | 'important' | 'helpful' | 'context-only';
  
  /** Specific sections of interest */
  sectionsOfInterest?: {
    startLine: number;
    endLine: number;
    description: string;
  }[];
}

export type FileRelevance =
  | 'modify'              // This file needs to be modified
  | 'create-similar'      // Create a new file similar to this
  | 'pattern-example'     // Shows the pattern to follow
  | 'type-definition'     // Contains relevant types
  | 'test-reference'      // Test to update/reference
  | 'config'              // Configuration to update
  | 'dependency'          // Dependency of modified code
  | 'context';            // Background context

export interface RelevantPattern {
  /** Pattern ID (from patterns.json) */
  patternId: string;
  
  /** Why this pattern matters for the task */
  relevance: string;
  
  /** Should the agent follow or deviate from this pattern? */
  action: 'follow' | 'extend' | 'deviate';
  
  /** If deviate, why? */
  deviationReason?: string;
}

export interface Constraint {
  /** Type of constraint */
  type: ConstraintType;
  
  /** Description */
  description: string;
  
  /** Severity if violated */
  severity: 'blocker' | 'error' | 'warning';
  
  /** Where this constraint comes from */
  source: 'codebase-pattern' | 'explicit-rule' | 'security' | 'performance' | 'compatibility';
}

export type ConstraintType =
  | 'must-use-pattern'        // Must follow existing pattern
  | 'must-not-use'            // Must not use certain approach
  | 'requires-auth'           // Must include auth check
  | 'requires-validation'     // Must validate input
  | 'requires-error-handling' // Must handle errors
  | 'requires-logging'        // Must add logging
  | 'requires-test'           // Must add tests
  | 'backwards-compatible'    // Must maintain compatibility
  | 'performance-sensitive';  // Must consider performance

export interface SimilarCode {
  /** File path */
  file: string;
  
  /** Line range */
  startLine: number;
  endLine: number;
  
  /** Why this is a good reference */
  description: string;
  
  /** How similar should the new code be? */
  similarity: 'exact-pattern' | 'similar-structure' | 'inspiration-only';
}

export interface DoNotModify {
  /** File path */
  file: string;
  
  /** Why it shouldn't be modified */
  reason: string;
  
  /** What would go wrong if modified */
  consequence: string;
}

export type AgenticFocus =
  | 'file-discovery'          // Can find relevant files
  | 'pattern-matching'        // Can identify applicable patterns
  | 'constraint-awareness'    // Knows what constraints apply
  | 'similar-code-finding'    // Can find good examples
  | 'scope-estimation'        // Can estimate task scope
  | 'test-awareness'          // Knows what tests to run/update
  | 'cross-cutting'           // Handles cross-cutting concerns
  | 'negative-knowledge';     // Knows what NOT to do

/**
 * Scoring rubric for agentic grounding
 */
export interface AgenticScoringRubric {
  /** File relevance scoring */
  fileRelevance: {
    /** Found critical file */
    criticalFileFound: number;      // e.g., 10 points
    /** Found important file */
    importantFileFound: number;     // e.g., 5 points
    /** Found helpful file */
    helpfulFileFound: number;       // e.g., 2 points
    /** Suggested irrelevant file */
    irrelevantFilePenalty: number;  // e.g., -3 points
    /** Missed critical file */
    missedCriticalPenalty: number;  // e.g., -10 points
  };
  
  /** Pattern awareness scoring */
  patternAwareness: {
    /** Identified relevant pattern */
    patternIdentified: number;
    /** Missed critical pattern */
    missedPatternPenalty: number;
  };
  
  /** Constraint awareness scoring */
  constraintAwareness: {
    /** Identified blocker constraint */
    blockerIdentified: number;
    /** Missed blocker constraint */
    missedBlockerPenalty: number;
  };
  
  /** Efficiency scoring */
  efficiency: {
    /** Bonus for minimal context */
    minimalContextBonus: number;
    /** Penalty for excessive context */
    excessiveContextPenalty: number;
  };
}
