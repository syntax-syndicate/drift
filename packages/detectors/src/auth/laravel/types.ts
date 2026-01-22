/**
 * Laravel Auth Type Definitions
 *
 * Types for Laravel authentication and authorization pattern detection.
 *
 * @module auth/laravel/types
 */

// ============================================================================
// Gate Types
// ============================================================================

/**
 * Gate definition from Gate::define()
 */
export interface GateDefinition {
  /** Ability name */
  name: string;
  /** Callback type (closure, class method, etc.) */
  callbackType: 'closure' | 'class' | 'invokable';
  /** Class name if class-based */
  className: string | null;
  /** Method name if class-based */
  methodName: string | null;
  /** Parameters extracted from callback */
  parameters: GateParameter[];
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Gate parameter
 */
export interface GateParameter {
  /** Parameter name */
  name: string;
  /** Type hint */
  type: string | null;
}

/**
 * Gate check usage
 */
export interface GateCheck {
  /** Check method (allows, denies, check, authorize, can) */
  method: 'allows' | 'denies' | 'check' | 'authorize' | 'can' | 'cannot';
  /** Check type (alias for method for backwards compatibility) */
  type: 'allows' | 'denies' | 'check' | 'authorize' | 'can' | 'cannot';
  /** Ability being checked */
  ability: string;
  /** Arguments passed */
  arguments: string[];
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Gate before/after hook
 */
export interface GateHook {
  /** Hook type */
  type: 'before' | 'after';
  /** Callback type */
  callbackType: 'closure' | 'class';
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

// ============================================================================
// Policy Types
// ============================================================================

/**
 * Policy class definition
 */
export interface PolicyInfo {
  /** Policy class name */
  name: string;
  /** Fully qualified name */
  fqn: string;
  /** Namespace */
  namespace: string | null;
  /** Model class this policy is for */
  modelClass: string | null;
  /** Policy methods */
  methods: PolicyMethod[];
  /** Whether policy uses HandlesAuthorization trait */
  usesHandlesAuthorization: boolean;
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Policy method
 */
export interface PolicyMethod {
  /** Method name (viewAny, view, create, update, delete, etc.) */
  name: string;
  /** Standard policy action or custom */
  isStandardAction: boolean;
  /** Parameters */
  parameters: PolicyParameter[];
  /** Return type */
  returnType: string | null;
  /** Line number */
  line: number;
}

/**
 * Policy parameter
 */
export interface PolicyParameter {
  /** Parameter name */
  name: string;
  /** Type hint */
  type: string | null;
  /** Whether it's the user parameter */
  isUser: boolean;
  /** Whether it's the model parameter */
  isModel: boolean;
}

/**
 * Policy registration
 */
export interface PolicyRegistration {
  /** Model class */
  modelClass: string;
  /** Policy class */
  policyClass: string;
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Middleware class definition
 */
export interface MiddlewareInfo {
  /** Middleware class name */
  name: string;
  /** Fully qualified name */
  fqn: string;
  /** Namespace */
  namespace: string | null;
  /** Whether it has handle method */
  hasHandle: boolean;
  /** Whether it has terminate method */
  hasTerminate: boolean;
  /** Parameters in handle method */
  handleParameters: string[];
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Middleware registration
 */
export interface MiddlewareRegistration {
  /** Middleware alias/key */
  alias: string;
  /** Middleware class */
  middlewareClass: string;
  /** Registration type */
  type: 'route' | 'global' | 'group';
  /** Group name if group type */
  groupName: string | null;
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Middleware usage on route
 */
export interface MiddlewareUsage {
  /** Middleware name/alias */
  middleware: string;
  /** All middlewares in this usage (for array usage) */
  middlewares: string[];
  /** Parameters passed to middleware */
  parameters: string[];
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

// ============================================================================
// Guard Types
// ============================================================================

/**
 * Auth guard definition
 */
export interface GuardInfo {
  /** Guard name */
  name: string;
  /** Driver (session, token, sanctum, passport) */
  driver: string;
  /** Provider name */
  provider: string | null;
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Guard usage
 */
export interface GuardUsage {
  /** Guard name */
  guard: string;
  /** Usage context */
  context: 'auth' | 'middleware' | 'route' | 'controller';
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

// ============================================================================
// Extraction Results
// ============================================================================

/**
 * Gate extraction result
 */
export interface GateExtractionResult {
  /** Gate definitions */
  definitions: GateDefinition[];
  /** Gate checks */
  checks: GateCheck[];
  /** Gate hooks */
  hooks: {
    before: GateHook[];
    after: GateHook[];
  };
  /** Confidence score */
  confidence: number;
}

/**
 * Can middleware usage
 */
export interface CanMiddleware {
  /** Ability being checked */
  ability: string;
  /** Model parameter */
  model: string | null;
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Policy extraction result
 */
export interface PolicyExtractionResult {
  /** Policy classes */
  policies: PolicyInfo[];
  /** Policy registrations */
  registrations: PolicyRegistration[];
  /** Authorize calls */
  authorizeCalls: AuthorizeCall[];
  /** Can middleware usages */
  canMiddleware: CanMiddleware[];
  /** Confidence score */
  confidence: number;
}

/**
 * Authorize call
 */
export interface AuthorizeCall {
  /** Ability being authorized */
  ability: string;
  /** Arguments */
  arguments: string[];
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Middleware group definition
 */
export interface MiddlewareGroup {
  /** Group name (web, api, etc.) */
  name: string;
  /** Middlewares in this group */
  middlewares: string[];
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Middleware extraction result
 */
export interface MiddlewareExtractionResult {
  /** Middleware classes */
  middlewares: MiddlewareInfo[];
  /** Middleware registrations */
  registrations: MiddlewareRegistration[];
  /** Middleware groups */
  groups: MiddlewareGroup[];
  /** Middleware usages */
  usages: MiddlewareUsage[];
  /** Confidence score */
  confidence: number;
}

/**
 * Complete Laravel auth analysis
 */
export interface LaravelAuthAnalysis {
  /** Gate analysis */
  gates: GateExtractionResult;
  /** Policy analysis */
  policies: PolicyExtractionResult;
  /** Middleware analysis */
  middleware: MiddlewareExtractionResult;
  /** Guard info */
  guards: GuardInfo[];
  /** Overall confidence */
  confidence: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Standard policy actions
 */
export const STANDARD_POLICY_ACTIONS = [
  'viewAny',
  'view',
  'create',
  'update',
  'delete',
  'restore',
  'forceDelete',
] as const;

export type StandardPolicyAction = typeof STANDARD_POLICY_ACTIONS[number];

/**
 * Check if action is a standard policy action
 */
export function isStandardPolicyAction(action: string): action is StandardPolicyAction {
  return STANDARD_POLICY_ACTIONS.includes(action as StandardPolicyAction);
}

/**
 * Built-in Laravel middleware
 */
export const BUILTIN_MIDDLEWARE = [
  'auth',
  'auth.basic',
  'auth.session',
  'cache.headers',
  'can',
  'guest',
  'password.confirm',
  'precognitive',
  'signed',
  'throttle',
  'verified',
] as const;
