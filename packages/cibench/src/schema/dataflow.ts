/**
 * CIBench Data Flow Ground Truth Schema
 * 
 * Defines test cases for tracking sensitive data through the codebase.
 */

export interface DataFlowGroundTruth {
  /** Schema version */
  version: '1.0.0';
  
  /** Sensitive data sources */
  sources: DataSource[];
  
  /** Sensitive data sinks */
  sinks: DataSink[];
  
  /** Expected data flow paths */
  flows: DataFlowPath[];
  
  /** Boundary violations */
  violations: BoundaryViolation[];
}

export interface DataSource {
  /** Unique ID */
  id: string;
  
  /** Type of source */
  type: SourceType;
  
  /** Location */
  location: {
    file: string;
    line: number;
    symbol?: string;
  };
  
  /** What data this source provides */
  dataType: SensitiveDataType;
  
  /** Description */
  description: string;
}

export type SourceType =
  | 'database-field'      // Field from database
  | 'api-input'           // User input from API
  | 'env-variable'        // Environment variable
  | 'config-file'         // Configuration file
  | 'user-session'        // Session data
  | 'file-upload'         // Uploaded file
  | 'external-api';       // Data from external API

export type SensitiveDataType =
  | 'pii'                 // Personally identifiable information
  | 'credentials'         // Passwords, API keys, tokens
  | 'financial'           // Payment info, account numbers
  | 'health'              // Medical/health data
  | 'location'            // GPS, addresses
  | 'authentication'      // Auth tokens, session IDs
  | 'internal';           // Internal-only data

export interface DataSink {
  /** Unique ID */
  id: string;
  
  /** Type of sink */
  type: SinkType;
  
  /** Location */
  location: {
    file: string;
    line: number;
    symbol?: string;
  };
  
  /** Description */
  description: string;
  
  /** Is this sink safe for sensitive data? */
  isSafe: boolean;
  
  /** What makes it safe/unsafe */
  safetyReason?: string;
}

export type SinkType =
  | 'log-output'          // Logging
  | 'api-response'        // HTTP response
  | 'database-write'      // Database insert/update
  | 'file-write'          // File system write
  | 'external-api'        // External API call
  | 'email'               // Email content
  | 'cache'               // Cache storage
  | 'message-queue';      // Message queue

export interface DataFlowPath {
  /** Source ID */
  sourceId: string;
  
  /** Sink ID */
  sinkId: string;
  
  /** The path data takes */
  path: DataFlowStep[];
  
  /** Is this flow expected/intentional? */
  isIntentional: boolean;
  
  /** Is this flow safe? */
  isSafe: boolean;
  
  /** If unsafe, what's the risk? */
  risk?: {
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
  };
}

export interface DataFlowStep {
  /** File */
  file: string;
  
  /** Line */
  line: number;
  
  /** Function/method */
  symbol: string;
  
  /** What happens to the data here */
  transformation?: DataTransformation;
}

export type DataTransformation =
  | 'pass-through'        // Data passes unchanged
  | 'sanitized'           // Data is sanitized/escaped
  | 'encrypted'           // Data is encrypted
  | 'hashed'              // Data is hashed
  | 'masked'              // Data is masked (e.g., last 4 digits)
  | 'filtered'            // Some fields removed
  | 'aggregated'          // Data is aggregated
  | 'logged';             // Data is logged (potential leak)

export interface BoundaryViolation {
  /** Unique ID */
  id: string;
  
  /** The flow that violates boundaries */
  flowSourceId: string;
  flowSinkId: string;
  
  /** What boundary is violated */
  violationType: ViolationType;
  
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  
  /** Description */
  description: string;
  
  /** Location where violation occurs */
  location: {
    file: string;
    line: number;
  };
}

export type ViolationType =
  | 'pii-to-log'              // PII written to logs
  | 'credentials-exposed'      // Credentials in response/log
  | 'cross-tenant'            // Data leaks between tenants
  | 'unauthorized-access'      // Accessed without auth check
  | 'unencrypted-storage'     // Sensitive data stored unencrypted
  | 'external-leak';          // Sensitive data sent externally
