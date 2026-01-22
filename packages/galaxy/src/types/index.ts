/**
 * Galaxy Visualization Types
 * 
 * Core type definitions for the 3D database galaxy visualization.
 * All types are immutable and follow strict typing conventions.
 */

// ============================================================================
// Sensitivity & Security Types
// ============================================================================

/**
 * Data sensitivity classification levels
 */
export type SensitivityLevel = 
  | 'critical'    // Credentials, secrets, API keys
  | 'high'        // Financial, health data
  | 'medium'      // PII, personal data
  | 'low'         // Internal data
  | 'public';     // Public/safe data

/**
 * Security priority tiers (P0 = most critical)
 */
export type SecurityTier = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

/**
 * Data operation types
 */
export type DataOperation = 'read' | 'write' | 'delete' | 'unknown';

/**
 * Authentication level for entry points
 */
export type AuthLevel = 'public' | 'authenticated' | 'admin' | 'internal';

// ============================================================================
// Galaxy Node Types
// ============================================================================

/**
 * A database table represented as a planet in the galaxy
 */
export interface TableNode {
  /** Unique identifier */
  readonly id: string;
  /** Table name */
  readonly name: string;
  /** Schema/database name if applicable */
  readonly schema?: string;
  /** Estimated row count (affects size) */
  readonly rowCount: number;
  /** Access frequency (affects importance) */
  readonly accessCount: number;
  /** Highest sensitivity level of any field */
  readonly sensitivity: SensitivityLevel;
  /** Security tier based on data exposure */
  readonly securityTier: SecurityTier;
  /** Fields in this table */
  readonly fields: readonly FieldNode[];
  /** 3D position in galaxy (computed by layout engine) */
  position?: Vector3D;
  /** Domain cluster this table belongs to */
  readonly cluster?: string;
}

/**
 * A database field represented as a moon orbiting a table
 */
export interface FieldNode {
  /** Unique identifier */
  readonly id: string;
  /** Field/column name */
  readonly name: string;
  /** Parent table ID */
  readonly tableId: string;
  /** Data type */
  readonly dataType: string;
  /** Sensitivity classification */
  readonly sensitivity: SensitivityLevel;
  /** Is this a primary key */
  readonly isPrimaryKey: boolean;
  /** Is this a foreign key */
  readonly isForeignKey: boolean;
  /** Foreign key target if applicable */
  readonly foreignKeyTarget?: string;
  /** Access count for this specific field */
  readonly accessCount: number;
  /** Is this field tested */
  readonly isTested: boolean;
}

/**
 * An API entry point represented as a space station
 */
export interface EntryPointNode {
  /** Unique identifier */
  readonly id: string;
  /** Route path (e.g., /api/users) */
  readonly path: string;
  /** HTTP method */
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL';
  /** Authentication level required */
  readonly authLevel: AuthLevel;
  /** Security tier */
  readonly securityTier: SecurityTier;
  /** Source file */
  readonly file: string;
  /** Line number */
  readonly line: number;
  /** Framework (Express, FastAPI, etc.) */
  readonly framework: string;
  /** Tables this entry point can reach */
  readonly reachableTables: readonly string[];
  /** 3D position (computed) */
  position?: Vector3D;
}

/**
 * A code function that accesses data
 */
export interface FunctionNode {
  /** Unique identifier */
  readonly id: string;
  /** Function name */
  readonly name: string;
  /** Qualified name (Class.method) */
  readonly qualifiedName: string;
  /** Source file */
  readonly file: string;
  /** Line number */
  readonly line: number;
  /** Tables this function accesses directly */
  readonly directAccess: readonly string[];
  /** Is this function tested */
  readonly isTested: boolean;
}

// ============================================================================
// Connection Types
// ============================================================================

/**
 * A data access path (hyperspace lane) connecting entry points to tables
 */
export interface DataPath {
  /** Unique identifier */
  readonly id: string;
  /** Source node (entry point or function) */
  readonly sourceId: string;
  /** Source type */
  readonly sourceType: 'entryPoint' | 'function';
  /** Target table */
  readonly targetTableId: string;
  /** Target field (optional, for field-level access) */
  readonly targetFieldId?: string;
  /** Operation type */
  readonly operation: DataOperation;
  /** Access frequency */
  readonly frequency: number;
  /** Call chain depth */
  readonly depth: number;
  /** Is this path tested */
  readonly isTested: boolean;
  /** Intermediate functions in the path */
  readonly callChain: readonly string[];
  /** Sensitivity of data accessed */
  readonly sensitivity: SensitivityLevel;
}

/**
 * A foreign key relationship between tables
 */
export interface TableRelationship {
  /** Unique identifier */
  readonly id: string;
  /** Source table */
  readonly sourceTableId: string;
  /** Source field */
  readonly sourceFieldId: string;
  /** Target table */
  readonly targetTableId: string;
  /** Target field */
  readonly targetFieldId: string;
  /** Relationship type */
  readonly type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

// ============================================================================
// Galaxy State Types
// ============================================================================

/**
 * Complete galaxy data model
 */
export interface GalaxyData {
  /** All tables (planets) */
  readonly tables: readonly TableNode[];
  /** All entry points (space stations) */
  readonly entryPoints: readonly EntryPointNode[];
  /** All data access paths (hyperspace lanes) */
  readonly dataPaths: readonly DataPath[];
  /** Table relationships (gravitational links) */
  readonly relationships: readonly TableRelationship[];
  /** Statistics */
  readonly stats: GalaxyStats;
  /** Last updated timestamp */
  readonly lastUpdated: string;
}

/**
 * Galaxy statistics
 */
export interface GalaxyStats {
  /** Total tables */
  readonly tableCount: number;
  /** Total fields */
  readonly fieldCount: number;
  /** Total entry points */
  readonly entryPointCount: number;
  /** Total data paths */
  readonly pathCount: number;
  /** Sensitive field count by level */
  readonly sensitiveFields: Record<SensitivityLevel, number>;
  /** Untested paths count */
  readonly untestedPaths: number;
  /** Dead code functions */
  readonly deadCodeCount: number;
  /** Health score (0-100) */
  readonly healthScore: number;
}

// ============================================================================
// View & Interaction Types
// ============================================================================

/**
 * 3D vector for positions
 */
export interface Vector3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Camera state
 */
export interface CameraState {
  /** Camera position */
  readonly position: Vector3D;
  /** Look-at target */
  readonly target: Vector3D;
  /** Zoom level (1 = default) */
  readonly zoom: number;
}

/**
 * Selection state
 */
export interface SelectionState {
  /** Selected table ID */
  readonly selectedTable: string | null;
  /** Selected field ID */
  readonly selectedField: string | null;
  /** Selected entry point ID */
  readonly selectedEntryPoint: string | null;
  /** Selected data path ID */
  readonly selectedPath: string | null;
  /** Hovered node ID */
  readonly hoveredNode: string | null;
  /** Hovered node type */
  readonly hoveredType: 'table' | 'field' | 'entryPoint' | 'path' | null;
}

/**
 * View mode for the galaxy
 */
export type ViewMode = 
  | 'overview'      // Full galaxy view
  | 'security'      // Security-focused (sensitive data highlighted)
  | 'coverage'      // Test coverage view
  | 'blast-radius'  // Impact analysis view
  | 'timeline';     // Historical view

/**
 * Filter state
 */
export interface FilterState {
  /** Show only tables with this sensitivity or higher */
  readonly minSensitivity: SensitivityLevel | null;
  /** Show only paths with this operation */
  readonly operationType: DataOperation | null;
  /** Show only untested paths */
  readonly untestedOnly: boolean;
  /** Show only public entry points */
  readonly publicOnly: boolean;
  /** Search query */
  readonly searchQuery: string;
  /** Selected clusters */
  readonly clusters: readonly string[];
}

/**
 * Display settings
 */
export interface DisplaySettings {
  /** Show field moons */
  readonly showFields: boolean;
  /** Show data paths */
  readonly showPaths: boolean;
  /** Show relationships */
  readonly showRelationships: boolean;
  /** Show labels */
  readonly showLabels: boolean;
  /** Enable bloom effect */
  readonly enableBloom: boolean;
  /** Animation speed (0-1) */
  readonly animationSpeed: number;
  /** Path opacity (0-1) */
  readonly pathOpacity: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Real-time access event
 */
export interface AccessEvent {
  /** Event ID */
  readonly id: string;
  /** Timestamp */
  readonly timestamp: string;
  /** Table accessed */
  readonly tableId: string;
  /** Field accessed (optional) */
  readonly fieldId?: string;
  /** Operation type */
  readonly operation: DataOperation;
  /** Source entry point */
  readonly entryPointId?: string;
  /** Source file */
  readonly sourceFile: string;
  /** Source line */
  readonly sourceLine: number;
}

/**
 * Galaxy event for animations/effects
 */
export interface GalaxyEvent {
  /** Event type */
  readonly type: 'access' | 'violation' | 'alert';
  /** Target node ID */
  readonly targetId: string;
  /** Event data */
  readonly data: AccessEvent | ViolationEvent | AlertEvent;
  /** Timestamp */
  readonly timestamp: string;
}

/**
 * Violation event
 */
export interface ViolationEvent {
  /** Violation ID */
  readonly id: string;
  /** Severity */
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  /** Message */
  readonly message: string;
  /** Affected table */
  readonly tableId: string;
  /** Affected path */
  readonly pathId?: string;
}

/**
 * Alert event
 */
export interface AlertEvent {
  /** Alert ID */
  readonly id: string;
  /** Alert type */
  readonly type: 'security' | 'coverage' | 'drift';
  /** Message */
  readonly message: string;
  /** Affected nodes */
  readonly affectedNodes: readonly string[];
}
