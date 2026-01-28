/**
 * CIBench Convention Inference Ground Truth Schema
 * 
 * Defines implicit conventions a tool should be able to infer.
 */

export interface ConventionGroundTruth {
  /** Schema version */
  version: '1.0.0';
  
  /** Conventions present in the codebase */
  conventions: Convention[];
  
  /** Intentional violations (acceptable deviations) */
  acceptableViolations: AcceptableViolation[];
}

export interface Convention {
  /** Unique ID */
  id: string;
  
  /** Category of convention */
  category: ConventionCategory;
  
  /** Human-readable name */
  name: string;
  
  /** Description of the convention */
  description: string;
  
  /** The rule, expressed as clearly as possible */
  rule: string;
  
  /** Examples that follow the convention */
  examples: ConventionExample[];
  
  /** How discoverable is this convention? */
  discoverability: 'obvious' | 'moderate' | 'subtle' | 'hidden';
  
  /** How consistently is it followed? */
  consistency: number; // 0-1, where 1 = always followed
  
  /** Is this convention documented anywhere? */
  isDocumented: boolean;
  
  /** If documented, where? */
  documentationLocation?: string;
}

export type ConventionCategory =
  | 'naming'              // Naming conventions
  | 'file-structure'      // File/folder organization
  | 'code-organization'   // How code is organized within files
  | 'error-handling'      // Error handling patterns
  | 'api-design'          // API design patterns
  | 'testing'             // Testing conventions
  | 'documentation'       // Documentation conventions
  | 'imports'             // Import organization
  | 'typing'              // Type annotation conventions
  | 'async'               // Async/await patterns
  | 'logging'             // Logging conventions
  | 'config';             // Configuration patterns

export interface ConventionExample {
  /** File path */
  file: string;
  
  /** Line number */
  line: number;
  
  /** The code that exemplifies the convention */
  code: string;
  
  /** Why this is a good example */
  explanation?: string;
}

export interface AcceptableViolation {
  /** Which convention is violated */
  conventionId: string;
  
  /** Location of the violation */
  location: {
    file: string;
    line: number;
  };
  
  /** Why this violation is acceptable */
  reason: string;
  
  /** Is this a legacy exception or intentional design? */
  type: 'legacy' | 'intentional' | 'external-requirement';
}

/**
 * Test case for convention inference
 */
export interface ConventionTestCase {
  /** Unique ID */
  id: string;
  
  /** Description */
  description: string;
  
  /** Given this new code... */
  newCode: {
    /** Proposed file path */
    file: string;
    /** Proposed code */
    code: string;
  };
  
  /** ...should the tool flag these convention violations? */
  expectedViolations: {
    conventionId: string;
    line: number;
    message: string;
  }[];
  
  /** ...or suggest these improvements? */
  expectedSuggestions: {
    conventionId: string;
    suggestion: string;
  }[];
}
