/**
 * CIBench Call Graph Ground Truth Schema
 * 
 * Defines expected call relationships in a benchmark codebase.
 */

export interface CallGraphGroundTruth {
  /** Schema version */
  version: '1.0.0';
  
  /** All functions/methods in the codebase */
  functions: FunctionDefinition[];
  
  /** All call relationships */
  calls: CallRelationship[];
  
  /** Entry points (functions called from outside the codebase) */
  entryPoints: EntryPoint[];
  
  /** Expected resolution statistics */
  expectedStats: {
    /** Total functions */
    totalFunctions: number;
    /** Total call sites */
    totalCallSites: number;
    /** Calls that should be resolvable */
    resolvableCalls: number;
    /** Calls that are inherently unresolvable (dynamic dispatch, etc.) */
    unresolvableCalls: number;
  };
}

export interface FunctionDefinition {
  /** Unique ID (typically file:name or file:class.method) */
  id: string;
  
  /** Function/method name */
  name: string;
  
  /** Containing class/struct (if method) */
  className?: string;
  
  /** File path */
  file: string;
  
  /** Line number */
  line: number;
  
  /** Is this exported/public? */
  isExported: boolean;
  
  /** Is this a test function? */
  isTest: boolean;
  
  /** Function type */
  type: 'function' | 'method' | 'constructor' | 'lambda' | 'callback';
  
  /** Parameters (for signature matching) */
  parameters?: ParameterInfo[];
  
  /** Return type (if known) */
  returnType?: string;
}

export interface ParameterInfo {
  name: string;
  type?: string;
  optional?: boolean;
}

export interface CallRelationship {
  /** Calling function ID */
  caller: string;
  
  /** Called function ID */
  callee: string;
  
  /** Location of the call site */
  callSite: {
    file: string;
    line: number;
    column?: number;
  };
  
  /** Type of call */
  callType: CallType;
  
  /** Is this call resolvable by static analysis? */
  staticResolvable: boolean;
  
  /** If not resolvable, why? */
  unresolvableReason?: UnresolvableReason;
  
  /** For interface calls, possible concrete implementations */
  possibleTargets?: string[];
}

export type CallType =
  | 'direct'           // foo()
  | 'method'           // obj.foo()
  | 'static-method'    // Class.foo()
  | 'constructor'      // new Foo()
  | 'callback'         // arr.map(foo)
  | 'dynamic'          // obj[name]()
  | 'interface'        // interface method call
  | 'virtual'          // virtual/override method
  | 'async'            // await foo()
  | 'goroutine'        // go foo()
  | 'defer';           // defer foo()

export type UnresolvableReason =
  | 'dynamic-dispatch'      // Interface/virtual method
  | 'reflection'            // Called via reflection
  | 'eval'                  // eval() or similar
  | 'external'              // External library
  | 'computed-name'         // obj[varName]()
  | 'higher-order'          // Function passed as argument
  | 'plugin-system';        // Plugin/extension mechanism

export interface EntryPoint {
  /** Function ID */
  functionId: string;
  
  /** Type of entry point */
  type: EntryPointType;
  
  /** Additional context */
  context?: string;
}

export type EntryPointType =
  | 'http-handler'      // HTTP route handler
  | 'cli-command'       // CLI command handler
  | 'event-handler'     // Event/message handler
  | 'cron-job'          // Scheduled job
  | 'test'              // Test function
  | 'main'              // Main/entry function
  | 'export'            // Exported for external use
  | 'callback'          // Registered as callback
  | 'lifecycle';        // Framework lifecycle hook
