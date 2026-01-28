/**
 * CIBench Impact Analysis Ground Truth Schema
 * 
 * Defines test cases for "what breaks if I change X?"
 */

export interface ImpactGroundTruth {
  /** Schema version */
  version: '1.0.0';
  
  /** Test cases */
  testCases: ImpactTestCase[];
}

export interface ImpactTestCase {
  /** Unique ID */
  id: string;
  
  /** Human-readable description */
  description: string;
  
  /** The change being made */
  change: ProposedChange;
  
  /** Expected impact */
  expectedImpact: ExpectedImpact;
  
  /** Difficulty of this test case */
  difficulty: 'easy' | 'medium' | 'hard';
  
  /** What makes this case interesting */
  testsFocus: ImpactFocus[];
}

export interface ProposedChange {
  /** Type of change */
  type: ChangeType;
  
  /** Target of the change */
  target: {
    file: string;
    /** Function/class name if applicable */
    symbol?: string;
    line?: number;
  };
  
  /** Description of the change */
  description: string;
  
  /** For signature changes, the old and new signatures */
  signatureChange?: {
    before: string;
    after: string;
  };
}

export type ChangeType =
  | 'modify-function'       // Change function implementation
  | 'rename-function'       // Rename a function
  | 'change-signature'      // Add/remove/change parameters
  | 'change-return-type'    // Change return type
  | 'delete-function'       // Remove a function
  | 'modify-type'           // Change a type definition
  | 'rename-field'          // Rename a field/property
  | 'change-field-type'     // Change field type
  | 'delete-field'          // Remove a field
  | 'modify-constant'       // Change a constant value
  | 'change-import';        // Change import path

export interface ExpectedImpact {
  /** Directly affected (callers, type users, etc.) */
  directlyAffected: AffectedItem[];
  
  /** Transitively affected (callers of callers, etc.) */
  transitivelyAffected: AffectedItem[];
  
  /** Entry points that would be affected */
  affectedEntryPoints: string[];
  
  /** Tests that would need updating */
  affectedTests: string[];
  
  /** Would this be a breaking change for external consumers? */
  isBreakingChange: boolean;
  
  /** Estimated blast radius */
  blastRadius: 'minimal' | 'moderate' | 'significant' | 'severe';
}

export interface AffectedItem {
  /** File path */
  file: string;
  
  /** Symbol name (function, class, etc.) */
  symbol: string;
  
  /** Line number */
  line: number;
  
  /** How it's affected */
  affectedHow: AffectedReason;
  
  /** Would this cause a compile/runtime error? */
  wouldBreak: boolean;
}

export type AffectedReason =
  | 'calls-function'        // Calls the changed function
  | 'uses-type'             // Uses the changed type
  | 'extends-class'         // Extends the changed class
  | 'implements-interface'  // Implements the changed interface
  | 'imports-symbol'        // Imports the changed symbol
  | 'references-constant'   // References the changed constant
  | 'tests-function'        // Tests the changed function
  | 'transitive';           // Affected through another affected item

export type ImpactFocus =
  | 'direct-callers'        // Can find direct callers
  | 'transitive-callers'    // Can find callers of callers
  | 'type-propagation'      // Can track type changes
  | 'cross-file'            // Can track across files
  | 'cross-package'         // Can track across packages
  | 'interface-dispatch'    // Can handle interface implementations
  | 'test-mapping';         // Can map to affected tests
