/**
 * Django Contract Detection Types
 *
 * Type definitions for Django REST Framework endpoint and serializer detection.
 *
 * @module contracts/django/types
 */

import type { ContractField, HttpMethod } from 'driftdetect-core';

// ============================================
// ViewSet Types
// ============================================

/**
 * Information about a Django REST Framework ViewSet.
 */
export interface DjangoViewSetInfo {
  /** ViewSet class name */
  name: string;
  /** Base class (ModelViewSet, ViewSet, etc.) */
  baseClass: string;
  /** Model class if ModelViewSet */
  modelClass: string | null;
  /** Serializer class name */
  serializerClass: string | null;
  /** Permission classes */
  permissionClasses: string[];
  /** Authentication classes */
  authenticationClasses: string[];
  /** Custom actions defined with @action decorator */
  customActions: DjangoActionInfo[];
  /** Queryset expression if defined */
  queryset: string | null;
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Information about a custom ViewSet action.
 */
export interface DjangoActionInfo {
  /** Action method name */
  name: string;
  /** HTTP methods (from @action decorator) */
  methods: HttpMethod[];
  /** URL path detail (True = /resource/{id}/action, False = /resource/action) */
  detail: boolean;
  /** Custom URL path if specified */
  urlPath: string | null;
  /** Custom URL name if specified */
  urlName: string | null;
  /** Line number */
  line: number;
}

// ============================================
// APIView Types
// ============================================

/**
 * Information about a Django REST Framework APIView.
 */
export interface DjangoAPIViewInfo {
  /** View class name */
  name: string;
  /** Base class (APIView, GenericAPIView, etc.) */
  baseClass: string;
  /** HTTP methods implemented (get, post, put, etc.) */
  methods: HttpMethod[];
  /** Serializer class if specified */
  serializerClass: string | null;
  /** Permission classes */
  permissionClasses: string[];
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

// ============================================
// Function-Based View Types
// ============================================

/**
 * Information about a function decorated with @api_view.
 */
export interface DjangoFunctionViewInfo {
  /** Function name */
  name: string;
  /** Allowed HTTP methods */
  methods: HttpMethod[];
  /** Permission classes from @permission_classes */
  permissionClasses: string[];
  /** Throttle classes from @throttle_classes */
  throttleClasses: string[];
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

// ============================================
// Serializer Types
// ============================================

/**
 * Information about a Django REST Framework Serializer.
 */
export interface DjangoSerializerInfo {
  /** Serializer class name */
  name: string;
  /** Base class (Serializer, ModelSerializer, etc.) */
  baseClass: string;
  /** Model class if ModelSerializer */
  modelClass: string | null;
  /** Explicitly defined fields */
  fields: DjangoSerializerFieldInfo[];
  /** Fields from Meta.fields */
  metaFields: string[] | 'all';
  /** Fields from Meta.exclude */
  excludeFields: string[];
  /** Read-only fields from Meta.read_only_fields */
  readOnlyFields: string[];
  /** Extra kwargs from Meta.extra_kwargs */
  extraKwargs: Record<string, DjangoFieldKwargs>;
  /** Nested serializers (field name -> serializer class) */
  nestedSerializers: Map<string, string>;
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Information about a serializer field.
 */
export interface DjangoSerializerFieldInfo {
  /** Field name */
  name: string;
  /** Field class (CharField, IntegerField, etc.) */
  fieldClass: string;
  /** Whether the field is required */
  required: boolean;
  /** Whether the field is read-only */
  readOnly: boolean;
  /** Whether the field is write-only */
  writeOnly: boolean;
  /** Whether the field allows null */
  allowNull: boolean;
  /** Whether the field allows blank (for strings) */
  allowBlank: boolean;
  /** Default value if specified */
  defaultValue: string | null;
  /** Source field if different from name */
  source: string | null;
  /** Help text */
  helpText: string | null;
  /** Max length for string fields */
  maxLength: number | null;
  /** Min length for string fields */
  minLength: number | null;
  /** Choices if specified */
  choices: string[] | null;
  /** Line number */
  line: number;
}

/**
 * Extra kwargs for a serializer field.
 */
export interface DjangoFieldKwargs {
  required?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  allowNull?: boolean;
  allowBlank?: boolean;
  maxLength?: number;
  minLength?: number;
  source?: string;
  helpText?: string;
}

// ============================================
// URL Pattern Types
// ============================================

/**
 * Information about a URL pattern.
 */
export interface DjangoURLPatternInfo {
  /** URL path pattern */
  path: string;
  /** Normalized path (with :param syntax) */
  normalizedPath: string;
  /** View class or function name */
  viewName: string;
  /** URL name for reverse() */
  urlName: string | null;
  /** Whether this is from a router */
  isRouter: boolean;
  /** Router basename if from router */
  basename: string | null;
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * Information about a router registration.
 */
export interface DjangoRouterInfo {
  /** Router variable name */
  routerName: string;
  /** Router class (DefaultRouter, SimpleRouter, etc.) */
  routerClass: string;
  /** Registered viewsets */
  registrations: DjangoRouterRegistration[];
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * A single router.register() call.
 */
export interface DjangoRouterRegistration {
  /** URL prefix */
  prefix: string;
  /** ViewSet class name */
  viewsetClass: string;
  /** Basename for URL names */
  basename: string | null;
  /** Line number */
  line: number;
}

// ============================================
// Extraction Result Types
// ============================================

/**
 * Result of Django endpoint extraction.
 */
export interface DjangoExtractionResult {
  /** Extracted ViewSets */
  viewsets: DjangoViewSetInfo[];
  /** Extracted APIViews */
  apiViews: DjangoAPIViewInfo[];
  /** Extracted function-based views */
  functionViews: DjangoFunctionViewInfo[];
  /** Extracted serializers */
  serializers: DjangoSerializerInfo[];
  /** Extracted URL patterns */
  urlPatterns: DjangoURLPatternInfo[];
  /** Extracted routers */
  routers: DjangoRouterInfo[];
  /** Overall confidence */
  confidence: number;
}

// ============================================
// Field Mapping
// ============================================

/**
 * Map Django field types to contract types.
 */
export const DJANGO_FIELD_TYPE_MAP: Record<string, string> = {
  // String fields
  CharField: 'string',
  TextField: 'string',
  EmailField: 'string',
  URLField: 'string',
  UUIDField: 'string',
  SlugField: 'string',
  IPAddressField: 'string',
  FilePathField: 'string',
  RegexField: 'string',
  
  // Numeric fields
  IntegerField: 'number',
  FloatField: 'number',
  DecimalField: 'number',
  
  // Boolean fields
  BooleanField: 'boolean',
  NullBooleanField: 'boolean',
  
  // Date/time fields (serialized as strings)
  DateField: 'string',
  DateTimeField: 'string',
  TimeField: 'string',
  DurationField: 'string',
  
  // Relational fields
  PrimaryKeyRelatedField: 'number',
  SlugRelatedField: 'string',
  HyperlinkedRelatedField: 'string',
  HyperlinkedIdentityField: 'string',
  
  // File fields
  FileField: 'string',
  ImageField: 'string',
  
  // Complex fields
  ListField: 'array',
  DictField: 'object',
  JSONField: 'any',
  
  // Serializer fields
  SerializerMethodField: 'unknown',
  ReadOnlyField: 'unknown',
  HiddenField: 'unknown',
};

/**
 * ViewSet actions and their HTTP methods.
 */
export const VIEWSET_ACTION_METHODS: Record<string, HttpMethod> = {
  list: 'GET',
  create: 'POST',
  retrieve: 'GET',
  update: 'PUT',
  partial_update: 'PATCH',
  destroy: 'DELETE',
};

/**
 * Convert Django serializer field to ContractField.
 */
export function toContractField(field: DjangoSerializerFieldInfo): ContractField {
  return {
    name: field.name,
    type: DJANGO_FIELD_TYPE_MAP[field.fieldClass] ?? 'unknown',
    optional: !field.required,
    nullable: field.allowNull,
    line: field.line,
  };
}

/**
 * Convert array of Django serializer fields to ContractFields.
 */
export function toContractFields(fields: DjangoSerializerFieldInfo[]): ContractField[] {
  return fields.map(toContractField);
}
