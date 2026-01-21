# Tree-sitter Python Parser Integration

## Design Document v1.0

**Status:** Complete (All Phases)  
**Author:** Kiro  
**Date:** January 20, 2026  
**Estimated Effort:** 8-11 days

---

## Executive Summary

This document proposes integrating tree-sitter-python as an optional parser backend for drift's Python analysis capabilities. The integration will dramatically improve contract detection confidence (from ~0.3 to 0.8+), enable proper Pydantic model parsing, add Django framework support, and provide a foundation for future language expansions.

---

## Problem Statement

### Current Limitations

The existing `PythonParser` in `packages/core/src/parsers/python-parser.ts` uses regex-based parsing, which:

1. **Cannot parse complex Pydantic models:**
   - Nested models (`List[ItemModel]`, `Dict[str, ConfigModel]`)
   - Field validators and constraints (`Field(min_length=1, max_length=100)`)
   - Model inheritance chains
   - Generic types (`T = TypeVar('T')`)

2. **Results in low contract confidence:**
   - Current `fieldExtractionConfidence` averages 0.3-0.5
   - Many response fields typed as `unknown`
   - Misses optional/nullable distinctions

3. **Limited framework support:**
   - Only FastAPI and Flask route detection
   - No Django REST Framework support
   - No Starlette/Litestar support

4. **Poor type hint extraction:**
   - Cannot resolve type aliases
   - Misses complex union types
   - No support for `Literal` types

### Evidence from Current Contracts

From `drift_contracts` output on competitive-intelligence-api:

```
Contract: POST /members/compensation
  fieldExtractionConfidence: 0.3
  responseFields: [{ name: "success", type: "unknown" }]

Contract: GET /permissions/catalog  
  fieldExtractionConfidence: 0.3
  responseFields: [
    { name: "permissions", type: "unknown" },
    { name: "by_module", type: "unknown" }
  ]
```

---

## Proposed Solution

### Overview

Integrate `tree-sitter` and `tree-sitter-python` as an optional parser backend that:

1. Implements the existing `BaseParser` interface
2. Provides proper AST-based Python parsing
3. Falls back to regex parser if tree-sitter unavailable
4. Is feature-flagged for gradual rollout

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ParserManager                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Language Detection                      │   │
│  │         (detectLanguage from extension)              │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Parser Selection                        │   │
│  │  if (language === 'python' && treeSitterEnabled)    │   │
│  │    → TreeSitterPythonParser                         │   │
│  │  else if (language === 'python')                    │   │
│  │    → PythonParser (regex fallback)                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  AST Cache (LRU)                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Specification

### Phase 1: Tree-sitter Integration (2-3 days)

#### 1.1 Dependencies

Add to `packages/core/package.json`:

```json
{
  "dependencies": {
    "tree-sitter": "^0.21.0",
    "tree-sitter-python": "^0.21.0"
  },
  "optionalDependencies": {
    "tree-sitter": "^0.21.0",
    "tree-sitter-python": "^0.21.0"
  }
}
```

#### 1.2 New Files

```
packages/core/src/parsers/
├── tree-sitter/
│   ├── index.ts                    # Tree-sitter loader with fallback
│   ├── tree-sitter-python-parser.ts # Main parser implementation
│   ├── python-ast-converter.ts     # Convert tree-sitter AST to drift AST
│   └── types.ts                    # Tree-sitter specific types
```

#### 1.3 TreeSitterPythonParser Interface

```typescript
// packages/core/src/parsers/tree-sitter/tree-sitter-python-parser.ts

import { BaseParser } from '../base-parser.js';
import type { AST, ASTNode, Language, ParseResult } from '../types.js';

export interface TreeSitterParseOptions {
  /** Extract Pydantic model information */
  extractPydanticModels?: boolean;
  /** Extract type hints from annotations */
  extractTypeHints?: boolean;
  /** Resolve type aliases */
  resolveTypeAliases?: boolean;
  /** Maximum depth for nested type resolution */
  maxTypeDepth?: number;
}

export interface PydanticModelInfo {
  name: string;
  fields: PydanticFieldInfo[];
  bases: string[];
  validators: ValidatorInfo[];
  config: ModelConfigInfo | null;
  location: { line: number; column: number };
}

export interface PydanticFieldInfo {
  name: string;
  type: TypeInfo;
  default: string | null;
  constraints: FieldConstraints;
  optional: boolean;
  nullable: boolean;
}

export interface TypeInfo {
  raw: string;           // Original type string
  base: string;          // Base type (e.g., "List" from "List[str]")
  args: TypeInfo[];      // Generic arguments
  isOptional: boolean;
  isNullable: boolean;
  isLiteral: boolean;
  literalValues?: string[];
}

export interface FieldConstraints {
  minLength?: number;
  maxLength?: number;
  ge?: number;
  le?: number;
  gt?: number;
  lt?: number;
  regex?: string;
  alias?: string;
}

export class TreeSitterPythonParser extends BaseParser {
  readonly language: Language = 'python';
  readonly extensions: string[] = ['.py', '.pyw', '.pyi'];
  
  private parser: TreeSitterParser | null = null;
  private pythonLanguage: TreeSitterLanguage | null = null;
  
  constructor(options?: TreeSitterParseOptions);
  
  /** Check if tree-sitter is available */
  static isAvailable(): boolean;
  
  /** Parse Python source with full AST */
  parse(source: string, filePath?: string): TreeSitterPythonParseResult;
  
  /** Extract Pydantic models from parsed AST */
  extractPydanticModels(ast: AST): PydanticModelInfo[];
  
  /** Extract all type hints from the file */
  extractTypeHints(ast: AST): Map<string, TypeInfo>;
  
  /** Resolve a type string to TypeInfo */
  resolveType(typeStr: string, context: TypeResolutionContext): TypeInfo;
  
  /** Query AST using tree-sitter query syntax */
  query(ast: AST, pattern: string): ASTNode[];
}
```

#### 1.4 Feature Flag Configuration

```typescript
// packages/core/src/config/parser-config.ts

export interface ParserConfig {
  python: {
    /** Use tree-sitter parser if available (default: true) */
    useTreeSitter: boolean;
    /** Extract Pydantic models (default: true) */
    extractPydanticModels: boolean;
    /** Maximum depth for type resolution (default: 5) */
    maxTypeDepth: number;
  };
}

export const DEFAULT_PARSER_CONFIG: ParserConfig = {
  python: {
    useTreeSitter: true,
    extractPydanticModels: true,
    maxTypeDepth: 5,
  },
};
```

#### 1.5 Graceful Fallback

```typescript
// packages/core/src/parsers/tree-sitter/index.ts

let treeSitterAvailable = false;
let TreeSitter: typeof import('tree-sitter') | null = null;
let PythonLanguage: any = null;

try {
  TreeSitter = require('tree-sitter');
  PythonLanguage = require('tree-sitter-python');
  treeSitterAvailable = true;
} catch {
  // Tree-sitter not available, will use regex fallback
  console.debug('tree-sitter not available, using regex parser');
}

export function isTreeSitterAvailable(): boolean {
  return treeSitterAvailable;
}

export function createPythonParser(config: ParserConfig): BaseParser {
  if (config.python.useTreeSitter && treeSitterAvailable) {
    return new TreeSitterPythonParser(config.python);
  }
  return new PythonParser(); // Existing regex parser
}
```

---

### Phase 2: Enhanced Pydantic Parsing (2-3 days)

#### 2.1 Pydantic Model Extractor

```typescript
// packages/core/src/parsers/tree-sitter/pydantic-extractor.ts

export class PydanticExtractor {
  constructor(private parser: TreeSitterPythonParser) {}
  
  /**
   * Extract all Pydantic models from source
   * Handles: BaseModel, dataclass, TypedDict
   */
  extractModels(ast: AST): PydanticModelInfo[] {
    const models: PydanticModelInfo[] = [];
    
    // Query for class definitions
    const classQuery = `
      (class_definition
        name: (identifier) @class_name
        superclasses: (argument_list)? @bases
        body: (block) @body
      )
    `;
    
    // ... implementation
    return models;
  }
  
  /**
   * Parse a Pydantic field definition
   * Handles: name: Type, name: Type = default, name: Type = Field(...)
   */
  parseField(node: ASTNode): PydanticFieldInfo | null;
  
  /**
   * Extract Field() constraints
   * Handles: min_length, max_length, ge, le, gt, lt, regex, alias
   */
  parseFieldConstraints(fieldCall: ASTNode): FieldConstraints;
  
  /**
   * Resolve model inheritance chain
   * Returns fields from all parent models
   */
  resolveInheritance(model: PydanticModelInfo, allModels: Map<string, PydanticModelInfo>): PydanticFieldInfo[];
}
```

#### 2.2 Type Resolution

```typescript
// packages/core/src/parsers/tree-sitter/type-resolver.ts

export class TypeResolver {
  private typeAliases: Map<string, TypeInfo> = new Map();
  private importedTypes: Map<string, string> = new Map();
  
  /**
   * Resolve a type annotation to TypeInfo
   * 
   * Examples:
   *   "str" → { base: "string", args: [], isOptional: false }
   *   "Optional[str]" → { base: "string", args: [], isOptional: true }
   *   "List[ItemModel]" → { base: "array", args: [{ base: "ItemModel", ... }] }
   *   "Dict[str, Any]" → { base: "object", args: [...] }
   *   "Literal['active', 'pending']" → { base: "string", isLiteral: true, literalValues: [...] }
   */
  resolve(typeStr: string, depth: number = 0): TypeInfo;
  
  /**
   * Register a type alias for resolution
   * Example: UserId = str → typeAliases.set("UserId", { base: "string" })
   */
  registerAlias(name: string, type: TypeInfo): void;
  
  /**
   * Map Python types to contract types
   */
  private mapPythonType(pythonType: string): string {
    const typeMap: Record<string, string> = {
      'str': 'string',
      'int': 'number',
      'float': 'number',
      'bool': 'boolean',
      'list': 'array',
      'List': 'array',
      'dict': 'object',
      'Dict': 'object',
      'Any': 'any',
      'None': 'null',
      'date': 'string',      // ISO date string
      'datetime': 'string',  // ISO datetime string
      'UUID': 'string',
      'Decimal': 'number',
    };
    return typeMap[pythonType] || pythonType;
  }
}
```

#### 2.3 Nested Model Resolution

```typescript
/**
 * Resolve nested model references
 * 
 * Given:
 *   class Address(BaseModel):
 *     street: str
 *     city: str
 *   
 *   class User(BaseModel):
 *     name: str
 *     address: Address
 *     tags: List[str]
 * 
 * Returns for User:
 *   [
 *     { name: "name", type: { base: "string" } },
 *     { name: "address", type: { base: "Address" }, children: [
 *       { name: "street", type: { base: "string" } },
 *       { name: "city", type: { base: "string" } }
 *     ]},
 *     { name: "tags", type: { base: "array", args: [{ base: "string" }] } }
 *   ]
 */
resolveNestedModels(
  model: PydanticModelInfo, 
  allModels: Map<string, PydanticModelInfo>,
  visited: Set<string> = new Set()
): ContractField[];
```

#### 2.4 Generic Type Support

```typescript
/**
 * Handle generic Pydantic models
 * 
 * Example:
 *   T = TypeVar('T')
 *   
 *   class Response(BaseModel, Generic[T]):
 *     data: T
 *     success: bool
 *   
 *   class UserResponse(Response[User]):
 *     pass
 * 
 * When resolving UserResponse, T should be substituted with User
 */
resolveGenericModel(
  model: PydanticModelInfo,
  typeArgs: TypeInfo[],
  genericParams: string[]
): PydanticModelInfo;
```

---

### Phase 3: Django Support (2-3 days)

#### 3.1 Django REST Framework Detector

```typescript
// packages/detectors/src/contracts/django-endpoint-detector.ts

export class DjangoEndpointDetector extends BaseDetector {
  readonly id = 'contracts/django-endpoints';
  readonly category = 'api' as const;
  readonly supportedLanguages: Language[] = ['python'];
  
  /**
   * Detect Django REST Framework patterns:
   * 
   * 1. ViewSets:
   *    class UserViewSet(viewsets.ModelViewSet):
   *        queryset = User.objects.all()
   *        serializer_class = UserSerializer
   * 
   * 2. APIView:
   *    class UserList(APIView):
   *        def get(self, request): ...
   *        def post(self, request): ...
   * 
   * 3. @api_view decorator:
   *    @api_view(['GET', 'POST'])
   *    def user_list(request): ...
   * 
   * 4. Router URLs:
   *    router.register(r'users', UserViewSet)
   */
  async detect(context: DetectionContext): Promise<DetectionResult>;
}
```

#### 3.2 Django Serializer Extractor

```typescript
// packages/detectors/src/contracts/django-serializer-extractor.ts

export interface DjangoSerializerInfo {
  name: string;
  modelClass: string | null;
  fields: SerializerFieldInfo[];
  readOnlyFields: string[];
  extraKwargs: Record<string, FieldKwargs>;
  nestedSerializers: Map<string, string>;
}

export interface SerializerFieldInfo {
  name: string;
  fieldType: string;           // CharField, IntegerField, etc.
  required: boolean;
  readOnly: boolean;
  writeOnly: boolean;
  allowNull: boolean;
  source: string | null;       // Field source if different from name
  validators: string[];
}

/**
 * Extract serializer definitions
 * 
 * Example:
 *   class UserSerializer(serializers.ModelSerializer):
 *       full_name = serializers.SerializerMethodField()
 *       
 *       class Meta:
 *           model = User
 *           fields = ['id', 'email', 'full_name', 'created_at']
 *           read_only_fields = ['id', 'created_at']
 *           extra_kwargs = {
 *               'email': {'required': True}
 *           }
 */
export class DjangoSerializerExtractor {
  extractSerializers(ast: AST): DjangoSerializerInfo[];
  
  /** Map serializer fields to ContractField format */
  toContractFields(serializer: DjangoSerializerInfo): ContractField[];
}
```

#### 3.3 Django URL Pattern Detection

```typescript
/**
 * Detect URL patterns from urls.py
 * 
 * Patterns supported:
 *   path('users/', UserViewSet.as_view({'get': 'list', 'post': 'create'}))
 *   path('users/<int:pk>/', UserViewSet.as_view({'get': 'retrieve'}))
 *   router.register(r'users', UserViewSet, basename='user')
 *   re_path(r'^users/(?P<pk>\d+)/$', user_detail)
 */
export class DjangoURLExtractor {
  extractURLPatterns(ast: AST): URLPatternInfo[];
  
  /** Match URL patterns to ViewSets/Views */
  matchEndpoints(
    patterns: URLPatternInfo[],
    viewsets: DjangoViewSetInfo[],
    views: DjangoViewInfo[]
  ): ExtractedEndpoint[];
}
```

#### 3.4 Integration with Backend Endpoint Detector

```typescript
// Update packages/detectors/src/contracts/backend-endpoint-detector.ts

export class BackendEndpointDetector extends BaseDetector {
  private djangoDetector: DjangoEndpointDetector;
  
  async detect(context: DetectionContext): Promise<DetectionResult> {
    const { content, language, file } = context;
    
    if (language === 'python') {
      // Detect framework
      const framework = this.detectPythonFramework(content);
      
      switch (framework) {
        case 'django':
          return this.djangoDetector.detect(context);
        case 'fastapi':
          return this.extractFastAPIEndpoints(content, file);
        case 'flask':
          return this.extractFlaskEndpoints(content, file);
        default:
          // Try all detectors
          return this.extractPythonEndpoints(content, file);
      }
    }
    // ... rest of implementation
  }
  
  private detectPythonFramework(content: string): 'django' | 'fastapi' | 'flask' | 'unknown' {
    if (content.includes('from rest_framework') || content.includes('from django')) {
      return 'django';
    }
    if (content.includes('from fastapi') || content.includes('import fastapi')) {
      return 'fastapi';
    }
    if (content.includes('from flask') || content.includes('import flask')) {
      return 'flask';
    }
    return 'unknown';
  }
}
```

---

### Phase 4: Type Hint Extraction (1-2 days)

#### 4.1 Function Signature Extraction

```typescript
// packages/core/src/parsers/tree-sitter/function-extractor.ts

export interface FunctionSignature {
  name: string;
  parameters: ParameterInfo[];
  returnType: TypeInfo | null;
  decorators: DecoratorInfo[];
  isAsync: boolean;
  isGenerator: boolean;
  docstring: string | null;
}

export interface ParameterInfo {
  name: string;
  type: TypeInfo | null;
  default: string | null;
  kind: 'positional' | 'keyword' | 'var_positional' | 'var_keyword';
}

export interface DecoratorInfo {
  name: string;
  arguments: ArgumentInfo[];
  fullText: string;
}

/**
 * Extract function signatures with full type information
 * 
 * Example:
 *   @router.post("/users", response_model=UserResponse)
 *   async def create_user(
 *       user: UserCreate,
 *       db: Session = Depends(get_db),
 *       current_user: User = Depends(get_current_user)
 *   ) -> UserResponse:
 *       '''Create a new user'''
 *       ...
 * 
 * Extracts:
 *   - Decorator: router.post with path="/users", response_model=UserResponse
 *   - Parameters: user (UserCreate), db (Session), current_user (User)
 *   - Return type: UserResponse
 *   - Docstring: "Create a new user"
 */
export class FunctionExtractor {
  extractFunctions(ast: AST): FunctionSignature[];
  
  /** Extract parameter type, handling Depends() and other patterns */
  extractParameterType(param: ASTNode): TypeInfo | null;
  
  /** Extract return type from annotation or decorator */
  extractReturnType(func: ASTNode): TypeInfo | null;
}
```

#### 4.2 Async Pattern Detection

```typescript
/**
 * Detect async/await patterns for semantic analysis
 * 
 * Patterns detected:
 *   1. Missing await: calling async function without await
 *   2. Sync in async: calling blocking I/O in async context
 *   3. Async generators: functions with async yield
 */
export interface AsyncPatternInfo {
  asyncFunctions: Set<string>;
  awaitCalls: AwaitCallInfo[];
  potentialIssues: AsyncIssue[];
}

export interface AsyncIssue {
  type: 'missing_await' | 'sync_in_async' | 'blocking_call';
  location: { line: number; column: number };
  functionName: string;
  description: string;
}

export class AsyncPatternDetector {
  analyze(ast: AST): AsyncPatternInfo;
}
```

#### 4.3 Integration with Semantic Detectors

```typescript
// Update packages/detectors/src/base/semantic-detector.ts

export abstract class SemanticDetector extends BaseDetector {
  /**
   * Enhanced context extraction using tree-sitter AST
   * 
   * When tree-sitter is available, use AST for more accurate context:
   *   - Function scope detection
   *   - Class membership
   *   - Decorator context
   *   - Type annotation context
   */
  protected extractContext(
    content: string,
    match: RegExpMatchArray,
    ast?: AST
  ): ContextType {
    if (ast && this.isTreeSitterAST(ast)) {
      return this.extractContextFromAST(ast, match.index!);
    }
    return this.extractContextFromRegex(content, match);
  }
  
  private extractContextFromAST(ast: AST, position: number): ContextType {
    // Use AST to determine exact context
    // Much more accurate than regex-based detection
  }
}
```

---

## File Structure

```
packages/core/src/parsers/
├── base-parser.ts                    # Existing (unchanged)
├── python-parser.ts                  # Existing regex parser (fallback)
├── parser-manager.ts                 # Updated to support tree-sitter
├── types.ts                          # Updated with new types
└── tree-sitter/
    ├── index.ts                      # Tree-sitter loader
    ├── tree-sitter-python-parser.ts  # Main parser
    ├── python-ast-converter.ts       # AST conversion
    ├── pydantic-extractor.ts         # Pydantic model extraction
    ├── type-resolver.ts              # Type resolution
    ├── function-extractor.ts         # Function signature extraction
    └── types.ts                       # Tree-sitter types

packages/detectors/src/contracts/
├── backend-endpoint-detector.ts      # Updated with Django support
├── django-endpoint-detector.ts       # NEW: Django detection
├── django-serializer-extractor.ts    # NEW: Serializer extraction
├── django-url-extractor.ts           # NEW: URL pattern detection
└── types.ts                          # Updated with Django types

packages/core/src/config/
└── parser-config.ts                  # NEW: Parser configuration
```

---

## Configuration

### drift.config.json

```json
{
  "parsers": {
    "python": {
      "useTreeSitter": true,
      "extractPydanticModels": true,
      "maxTypeDepth": 5,
      "frameworks": {
        "django": true,
        "fastapi": true,
        "flask": true
      }
    }
  }
}
```

### Environment Variables

```bash
# Disable tree-sitter (use regex fallback)
DRIFT_PYTHON_USE_TREE_SITTER=false

# Enable verbose parsing logs
DRIFT_PARSER_DEBUG=true
```

---

## Testing Strategy

### Unit Tests

```typescript
// packages/core/src/parsers/tree-sitter/__tests__/tree-sitter-python-parser.test.ts

describe('TreeSitterPythonParser', () => {
  describe('Pydantic Model Extraction', () => {
    it('should extract simple model fields', () => {
      const source = `
class User(BaseModel):
    name: str
    age: int
    email: Optional[str] = None
      `;
      const result = parser.parse(source);
      const models = parser.extractPydanticModels(result.ast!);
      
      expect(models).toHaveLength(1);
      expect(models[0].fields).toEqual([
        { name: 'name', type: { base: 'string' }, optional: false },
        { name: 'age', type: { base: 'number' }, optional: false },
        { name: 'email', type: { base: 'string' }, optional: true, nullable: true },
      ]);
    });
    
    it('should handle nested models', () => {
      const source = `
class Address(BaseModel):
    street: str
    city: str

class User(BaseModel):
    name: str
    address: Address
    addresses: List[Address]
      `;
      // ... test nested resolution
    });
    
    it('should extract Field() constraints', () => {
      const source = `
class User(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    age: int = Field(ge=0, le=150)
    email: str = Field(regex=r'^[\\w.-]+@[\\w.-]+\\.\\w+$')
      `;
      // ... test constraint extraction
    });
    
    it('should handle model inheritance', () => {
      const source = `
class BaseUser(BaseModel):
    id: int
    created_at: datetime

class User(BaseUser):
    name: str
    email: str
      `;
      // ... test inheritance resolution
    });
    
    it('should handle generic models', () => {
      const source = `
T = TypeVar('T')

class Response(BaseModel, Generic[T]):
    data: T
    success: bool

class UserResponse(Response[User]):
    pass
      `;
      // ... test generic resolution
    });
  });
  
  describe('Type Resolution', () => {
    it('should resolve Optional types', () => {
      expect(resolver.resolve('Optional[str]')).toEqual({
        base: 'string',
        isOptional: true,
        isNullable: true,
      });
    });
    
    it('should resolve Union types', () => {
      expect(resolver.resolve('Union[str, int]')).toEqual({
        base: 'union',
        args: [{ base: 'string' }, { base: 'number' }],
      });
    });
    
    it('should resolve Literal types', () => {
      expect(resolver.resolve("Literal['active', 'pending', 'suspended']")).toEqual({
        base: 'string',
        isLiteral: true,
        literalValues: ['active', 'pending', 'suspended'],
      });
    });
    
    it('should resolve nested generics', () => {
      expect(resolver.resolve('Dict[str, List[int]]')).toEqual({
        base: 'object',
        args: [
          { base: 'string' },
          { base: 'array', args: [{ base: 'number' }] },
        ],
      });
    });
  });
});
```

### Integration Tests

```typescript
// packages/detectors/src/contracts/__tests__/backend-endpoint-detector.integration.test.ts

describe('BackendEndpointDetector Integration', () => {
  describe('FastAPI with Tree-sitter', () => {
    it('should extract endpoints with high confidence', async () => {
      const source = `
from fastapi import FastAPI, Depends
from pydantic import BaseModel
from typing import List, Optional

class UserCreate(BaseModel):
    name: str
    email: str
    age: Optional[int] = None

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    age: Optional[int]
    created_at: datetime

@app.post("/users", response_model=UserResponse)
async def create_user(user: UserCreate) -> UserResponse:
    ...
      `;
      
      const result = await detector.detect({
        content: source,
        language: 'python',
        file: 'api/routes/users.py',
      });
      
      expect(result.custom.extractedEndpoints).toHaveLength(1);
      expect(result.custom.extractedEndpoints[0]).toMatchObject({
        method: 'POST',
        path: '/users',
        requestFields: [
          { name: 'name', type: 'string', optional: false },
          { name: 'email', type: 'string', optional: false },
          { name: 'age', type: 'number', optional: true },
        ],
        responseFields: [
          { name: 'id', type: 'number', optional: false },
          { name: 'name', type: 'string', optional: false },
          { name: 'email', type: 'string', optional: false },
          { name: 'age', type: 'number', optional: true },
          { name: 'created_at', type: 'string', optional: false },
        ],
      });
      
      // Confidence should be high with tree-sitter
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });
  
  describe('Django REST Framework', () => {
    it('should extract ViewSet endpoints', async () => {
      const source = `
from rest_framework import viewsets, serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'created_at']
        read_only_fields = ['id', 'created_at']

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
      `;
      
      const result = await detector.detect({
        content: source,
        language: 'python',
        file: 'api/views.py',
      });
      
      // Should detect CRUD endpoints from ModelViewSet
      expect(result.custom.extractedEndpoints).toHaveLength(5); // list, create, retrieve, update, destroy
    });
  });
});
```

### Benchmark Tests

```typescript
// packages/core/src/parsers/tree-sitter/__tests__/benchmark.test.ts

describe('Parser Performance', () => {
  const largeFile = generateLargePythonFile(1000); // 1000 classes
  
  it('should parse large files efficiently', () => {
    const start = performance.now();
    const result = parser.parse(largeFile);
    const duration = performance.now() - start;
    
    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(1000); // Under 1 second
  });
  
  it('should be faster than regex parser for complex files', () => {
    const complexFile = generateComplexPydanticFile();
    
    const treeSitterStart = performance.now();
    treeSitterParser.parse(complexFile);
    const treeSitterDuration = performance.now() - treeSitterStart;
    
    const regexStart = performance.now();
    regexParser.parse(complexFile);
    const regexDuration = performance.now() - regexStart;
    
    // Tree-sitter should be comparable or faster
    expect(treeSitterDuration).toBeLessThan(regexDuration * 2);
  });
});
```

---

## Migration Path

### Backward Compatibility

1. **No breaking changes** - Existing regex parser remains default if tree-sitter unavailable
2. **Feature flag** - `useTreeSitter: false` disables new parser
3. **Same interface** - `TreeSitterPythonParser` implements `BaseParser`
4. **Same output format** - `ParseResult` and `ContractField` unchanged

### Rollout Strategy

1. **Phase 1 (Week 1):** Tree-sitter integration with feature flag disabled by default
2. **Phase 2 (Week 2):** Enable for new projects, monitor for issues
3. **Phase 3 (Week 3):** Enable by default, regex as fallback
4. **Phase 4 (Week 4):** Django support, full rollout

---

## Success Metrics

### Primary Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Field extraction confidence | 0.3-0.5 | 0.8+ | `drift_contracts` output |
| Fields typed as "unknown" | ~60% | <10% | Contract field analysis |
| Pydantic model coverage | ~40% | 95%+ | Model extraction tests |
| Django endpoint detection | 0% | 90%+ | Framework detection tests |

### Secondary Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Parse time (1000 line file) | <100ms | Benchmark tests |
| Memory usage | <50MB per file | Memory profiling |
| Cache hit ratio | >80% | ParserManager stats |
| Fallback rate | <5% | Error monitoring |

---

## Risks and Mitigations

### Risk 1: Tree-sitter Native Dependencies

**Risk:** Tree-sitter requires native compilation, may fail on some systems.

**Mitigation:**
- Use `optionalDependencies` in package.json
- Graceful fallback to regex parser
- Pre-built binaries for common platforms
- Clear error messages when unavailable

### Risk 2: Performance Regression

**Risk:** Tree-sitter parsing slower than regex for simple files.

**Mitigation:**
- Benchmark tests in CI
- Hybrid approach: regex for simple patterns, tree-sitter for complex
- AST caching with LRU eviction
- Incremental parsing for changed regions

### Risk 3: Django Pattern Complexity

**Risk:** Django has many patterns (CBV, FBV, ViewSets, routers) that are hard to detect.

**Mitigation:**
- Start with most common patterns (ModelViewSet, APIView)
- Iterative improvement based on real-world usage
- Allow manual endpoint annotation as fallback
- Document unsupported patterns

### Risk 4: Type Resolution Cycles

**Risk:** Circular type references could cause infinite loops.

**Mitigation:**
- Track visited types during resolution
- Maximum depth limit (default: 5)
- Graceful degradation to "unknown" type
- Cycle detection with clear error messages

---

## Dependencies

### New Dependencies

| Package | Version | Size | Purpose |
|---------|---------|------|---------|
| tree-sitter | ^0.21.0 | ~2MB | Core parsing engine |
| tree-sitter-python | ^0.21.0 | ~500KB | Python grammar |

### Peer Dependencies

None - tree-sitter is optional.

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @types/tree-sitter | ^0.21.0 | TypeScript types |

---

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Tree-sitter Integration | 2-3 days | Parser, fallback, feature flag |
| Phase 2: Pydantic Parsing | 2-3 days | Model extraction, type resolution |
| Phase 3: Django Support | 2-3 days | ViewSets, serializers, URLs |
| Phase 4: Type Hints | 1-2 days | Function signatures, async patterns |
| **Total** | **8-11 days** | |

---

## Approval Checklist

- [ ] Architecture review completed
- [ ] Security review (native dependencies)
- [ ] Performance benchmarks defined
- [ ] Test coverage requirements met (>80%)
- [ ] Documentation updated
- [ ] Migration path approved
- [ ] Rollout plan approved

---

## Appendix A: Tree-sitter Query Examples

```scheme
; Find all Pydantic model classes
(class_definition
  name: (identifier) @class_name
  superclasses: (argument_list
    (identifier) @base (#match? @base "BaseModel|Schema"))
  body: (block) @body)

; Find all FastAPI route decorators
(decorator
  (call
    function: (attribute
      object: (identifier) @obj (#match? @obj "app|router")
      attribute: (identifier) @method (#match? @method "get|post|put|patch|delete"))
    arguments: (argument_list
      (string) @path)))

; Find all type annotations
(typed_parameter
  name: (identifier) @param_name
  type: (_) @param_type)

; Find all Field() calls with constraints
(assignment
  left: (identifier) @field_name
  right: (call
    function: (identifier) @func (#eq? @func "Field")
    arguments: (argument_list) @args))
```

---

## Appendix B: Example Transformations

### Input (Python)

```python
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class Address(BaseModel):
    street: str
    city: str
    zip_code: str = Field(regex=r'^\d{5}$')

class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str
    age: Optional[int] = Field(None, ge=0, le=150)
    addresses: List[Address] = []

class UserResponse(UserCreate):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True
```

### Output (ContractField[])

```json
{
  "requestFields": [
    { "name": "name", "type": "string", "optional": false, "constraints": { "minLength": 1, "maxLength": 100 } },
    { "name": "email", "type": "string", "optional": false },
    { "name": "age", "type": "number", "optional": true, "nullable": true, "constraints": { "ge": 0, "le": 150 } },
    { 
      "name": "addresses", 
      "type": "array", 
      "optional": true,
      "children": [
        { "name": "street", "type": "string", "optional": false },
        { "name": "city", "type": "string", "optional": false },
        { "name": "zip_code", "type": "string", "optional": false, "constraints": { "regex": "^\\d{5}$" } }
      ]
    }
  ],
  "responseFields": [
    { "name": "id", "type": "number", "optional": false },
    { "name": "name", "type": "string", "optional": false },
    { "name": "email", "type": "string", "optional": false },
    { "name": "age", "type": "number", "optional": true, "nullable": true },
    { "name": "addresses", "type": "array", "optional": true, "children": [...] },
    { "name": "created_at", "type": "string", "optional": false }
  ]
}
```

---

**Document Status:** Ready for Review  
**Next Steps:** Await approval, then begin Phase 1 implementation


---

## Milestone Checkpoints & Acceptance Criteria

Each phase has specific checkpoints that must pass before proceeding to the next phase. This prevents "get to the end with 0 errors" scenarios.

### Phase 1 Checkpoints: Tree-sitter Integration

| Checkpoint | Acceptance Criteria | Test Command |
|------------|---------------------|--------------|
| **1.1 Dependencies Install** | tree-sitter and tree-sitter-python install without errors on macOS, Linux, Windows | `pnpm install` in packages/core |
| **1.2 Graceful Fallback** | When tree-sitter unavailable, regex parser is used without errors | `DRIFT_PYTHON_USE_TREE_SITTER=false pnpm test` |
| **1.3 Basic Parsing** | Parse simple Python file and produce valid AST | Unit test: `tree-sitter-python-parser.test.ts` |
| **1.4 BaseParser Interface** | TreeSitterPythonParser passes all BaseParser interface tests | `pnpm test -- --grep "BaseParser"` |
| **1.5 ParserManager Integration** | ParserManager correctly selects tree-sitter parser for .py files | Integration test |

**Phase 1 Exit Gate:**
```bash
# All must pass before Phase 2
pnpm test --filter @drift/core -- --grep "TreeSitter"
pnpm test --filter @drift/core -- --grep "PythonParser"
# Verify fallback works
DRIFT_PYTHON_USE_TREE_SITTER=false pnpm test --filter @drift/core
```

### Phase 2 Checkpoints: Enhanced Pydantic Parsing

| Checkpoint | Acceptance Criteria | Test Command |
|------------|---------------------|--------------|
| **2.1 Simple Models** | Extract fields from `class User(BaseModel): name: str` | Unit test |
| **2.2 Optional Types** | Correctly identify `Optional[str]` as optional=true, nullable=true | Unit test |
| **2.3 Nested Models** | Resolve `List[Address]` to include Address fields as children | Unit test |
| **2.4 Field Constraints** | Extract `Field(min_length=1)` constraints | Unit test |
| **2.5 Inheritance** | Resolve fields from parent classes | Unit test |
| **2.6 Generic Types** | Handle `Response[T]` with type substitution | Unit test |
| **2.7 Contract Integration** | Backend endpoint detector uses new parser, confidence > 0.7 | Integration test |

**Phase 2 Exit Gate:**
```bash
# All must pass before Phase 3
pnpm test --filter @drift/core -- --grep "Pydantic"
pnpm test --filter @drift/detectors -- --grep "backend-endpoint"

# Verify confidence improvement on real codebase
drift scan --paths test-repos/competitive-intelligence-api/api
# Check: fieldExtractionConfidence should be > 0.7 for most contracts
```

### Phase 3 Checkpoints: Django Support

| Checkpoint | Acceptance Criteria | Test Command |
|------------|---------------------|--------------|
| **3.1 Framework Detection** | Correctly identify Django vs FastAPI vs Flask | Unit test |
| **3.2 ViewSet Detection** | Extract CRUD endpoints from ModelViewSet | Unit test |
| **3.3 APIView Detection** | Extract endpoints from class-based APIView | Unit test |
| **3.4 Serializer Extraction** | Extract fields from ModelSerializer | Unit test |
| **3.5 URL Pattern Matching** | Match router.register to ViewSet | Unit test |
| **3.6 End-to-End Django** | Full scan of Django project produces valid contracts | Integration test |

**Phase 3 Exit Gate:**
```bash
# All must pass before Phase 4
pnpm test --filter @drift/detectors -- --grep "Django"

# Test on real Django project (if available)
# Or use test fixtures
pnpm test --filter @drift/detectors -- --grep "django-integration"
```

### Phase 4 Checkpoints: Type Hint Extraction

| Checkpoint | Acceptance Criteria | Test Command |
|------------|---------------------|--------------|
| **4.1 Function Signatures** | Extract parameters and return types | Unit test |
| **4.2 Decorator Parsing** | Extract decorator arguments (response_model, etc.) | Unit test |
| **4.3 Async Detection** | Identify async functions and await calls | Unit test |
| **4.4 Semantic Integration** | Semantic detectors use AST context when available | Integration test |

**Phase 4 Exit Gate:**
```bash
# All must pass before release
pnpm test --filter @drift/core -- --grep "FunctionExtractor"
pnpm test --filter @drift/detectors -- --grep "semantic"

# Full regression test
pnpm test
```

### Final Integration Checkpoint

Before merging to main:

```bash
# 1. All unit tests pass
pnpm test

# 2. All integration tests pass
pnpm test:integration

# 3. Benchmark tests pass (no performance regression)
pnpm test:benchmark

# 4. Real-world validation on competitive-intelligence-api
cd test-repos/competitive-intelligence-api
drift scan --verbose
# Verify:
#   - No errors in scan output
#   - Contract confidence > 0.7 average
#   - Django endpoints detected (if any)
#   - No regression in existing patterns

# 5. MCP tools work correctly
drift mcp &
# Test drift_contracts returns improved confidence scores

# 6. CLI commands work correctly
drift scan --verbose
drift status
drift contracts
```

---

## MCP Server Integration

### Updated MCP Tools

The existing `drift_contracts` tool will automatically benefit from improved parsing. Additionally, we'll add a new tool for parser diagnostics.

#### New Tool: `drift_parser_info`

```typescript
// Add to packages/mcp/src/server.ts TOOLS array

{
  name: 'drift_parser_info',
  description: 'Get information about parser capabilities and status. Shows which parsers are available and their features.',
  inputSchema: {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        enum: ['python', 'typescript', 'javascript', 'css', 'all'],
        description: 'Language to get parser info for (default: all)',
      },
    },
    required: [],
  },
}
```

#### Handler Implementation

```typescript
// Add to packages/mcp/src/server.ts

async function handleParserInfo(args: { language?: string }) {
  const { ParserManager, TreeSitterPythonParser } = await import('driftdetect-core');
  
  const info: Record<string, unknown> = {};
  
  // Python parser info
  if (!args.language || args.language === 'python' || args.language === 'all') {
    info.python = {
      treeSitterAvailable: TreeSitterPythonParser.isAvailable(),
      activeParser: TreeSitterPythonParser.isAvailable() ? 'tree-sitter' : 'regex',
      capabilities: {
        pydanticModels: TreeSitterPythonParser.isAvailable(),
        nestedTypes: TreeSitterPythonParser.isAvailable(),
        fieldConstraints: TreeSitterPythonParser.isAvailable(),
        inheritance: TreeSitterPythonParser.isAvailable(),
        generics: TreeSitterPythonParser.isAvailable(),
        django: TreeSitterPythonParser.isAvailable(),
        typeHints: TreeSitterPythonParser.isAvailable(),
      },
      supportedFrameworks: ['fastapi', 'flask', ...(TreeSitterPythonParser.isAvailable() ? ['django', 'starlette'] : [])],
    };
  }
  
  // TypeScript parser info
  if (!args.language || args.language === 'typescript' || args.language === 'all') {
    info.typescript = {
      activeParser: 'typescript-compiler-api',
      capabilities: {
        fullAST: true,
        typeInference: true,
        interfaces: true,
        generics: true,
      },
    };
  }
  
  return {
    content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
  };
}
```

#### Enhanced `drift_contracts` Output

The existing `drift_contracts` tool output will include parser information:

```typescript
// Update handleContracts in packages/mcp/src/server.ts

async function handleContracts(projectRoot: string, args: { status?: string }) {
  // ... existing code ...
  
  // Add parser info to response
  const parserInfo = {
    pythonParser: TreeSitterPythonParser.isAvailable() ? 'tree-sitter' : 'regex',
    expectedConfidence: TreeSitterPythonParser.isAvailable() ? 'high (0.7-0.9)' : 'low (0.3-0.5)',
  };
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        parserInfo,
        contracts,
      }, null, 2),
    }],
  };
}
```

---

## CLI Integration

### Updated `drift scan` Command

```typescript
// Update packages/cli/src/commands/scan.ts

export interface ScanCommandOptions {
  // ... existing options ...
  
  /** Use tree-sitter parser for Python (default: true if available) */
  treeSitter?: boolean;
  
  /** Show parser diagnostics */
  parserInfo?: boolean;
}

// Add to scanAction function:

// Show parser info if requested
if (options.parserInfo) {
  const { TreeSitterPythonParser } = await import('driftdetect-core');
  console.log();
  console.log(chalk.bold('Parser Information:'));
  console.log(`  Python parser: ${TreeSitterPythonParser.isAvailable() ? chalk.green('tree-sitter') : chalk.yellow('regex (fallback)')}`);
  if (!TreeSitterPythonParser.isAvailable()) {
    console.log(chalk.gray('  Install tree-sitter for better Python parsing:'));
    console.log(chalk.cyan('    pnpm add tree-sitter tree-sitter-python'));
  }
  console.log();
}

// Update contract scanning output to show confidence improvement
if (options.contracts !== false) {
  // ... existing contract scanning ...
  
  // Show confidence stats
  const avgConfidence = contractResult.contracts.reduce(
    (sum, c) => sum + c.confidence.fieldExtractionConfidence, 0
  ) / contractResult.contracts.length;
  
  console.log();
  console.log(chalk.gray(`  Average field extraction confidence: ${(avgConfidence * 100).toFixed(0)}%`));
  if (avgConfidence < 0.5) {
    console.log(chalk.yellow('  Tip: Install tree-sitter for better Python parsing'));
  }
}
```

### New CLI Command: `drift parser`

```typescript
// packages/cli/src/commands/parser.ts

import { Command } from 'commander';
import chalk from 'chalk';

export const parserCommand = new Command('parser')
  .description('Show parser information and diagnostics')
  .option('--test <file>', 'Test parsing a specific file')
  .action(async (options) => {
    const { TreeSitterPythonParser, PythonParser, ParserManager } = await import('driftdetect-core');
    
    console.log();
    console.log(chalk.bold('Drift Parser Status'));
    console.log(chalk.gray('─'.repeat(40)));
    
    // Python
    const treeSitterAvailable = TreeSitterPythonParser.isAvailable();
    console.log();
    console.log(chalk.bold('Python:'));
    console.log(`  Active parser:     ${treeSitterAvailable ? chalk.green('tree-sitter') : chalk.yellow('regex')}`);
    console.log(`  Tree-sitter:       ${treeSitterAvailable ? chalk.green('✓ available') : chalk.red('✗ not installed')}`);
    
    if (treeSitterAvailable) {
      console.log(chalk.green('  Capabilities:'));
      console.log(chalk.green('    ✓ Pydantic model extraction'));
      console.log(chalk.green('    ✓ Nested type resolution'));
      console.log(chalk.green('    ✓ Field constraints'));
      console.log(chalk.green('    ✓ Model inheritance'));
      console.log(chalk.green('    ✓ Generic types'));
      console.log(chalk.green('    ✓ Django REST Framework'));
      console.log(chalk.green('    ✓ Type hint extraction'));
    } else {
      console.log(chalk.yellow('  Limited capabilities (regex-based):'));
      console.log(chalk.yellow('    ✓ Basic route detection'));
      console.log(chalk.yellow('    ✓ Simple Pydantic models'));
      console.log(chalk.red('    ✗ Nested types'));
      console.log(chalk.red('    ✗ Field constraints'));
      console.log(chalk.red('    ✗ Django support'));
      console.log();
      console.log(chalk.gray('  To enable full Python support:'));
      console.log(chalk.cyan('    pnpm add tree-sitter tree-sitter-python'));
    }
    
    // Test file parsing if requested
    if (options.test) {
      console.log();
      console.log(chalk.bold(`Testing: ${options.test}`));
      
      const fs = await import('node:fs/promises');
      const content = await fs.readFile(options.test, 'utf-8');
      
      const manager = new ParserManager();
      // Register parsers...
      
      const result = manager.parse(options.test, content);
      
      if (result.success) {
        console.log(chalk.green('  ✓ Parsed successfully'));
        console.log(chalk.gray(`    Nodes: ${countNodes(result.ast)}`));
        
        if (options.test.endsWith('.py') && treeSitterAvailable) {
          const parser = new TreeSitterPythonParser();
          const models = parser.extractPydanticModels(result.ast!);
          console.log(chalk.gray(`    Pydantic models: ${models.length}`));
          for (const model of models) {
            console.log(chalk.gray(`      - ${model.name} (${model.fields.length} fields)`));
          }
        }
      } else {
        console.log(chalk.red('  ✗ Parse failed'));
        for (const error of result.errors) {
          console.log(chalk.red(`    ${error.message}`));
        }
      }
    }
    
    console.log();
  });
```

### Updated `drift contracts` Command

```typescript
// packages/cli/src/commands/contracts.ts

// Add confidence breakdown to output
console.log();
console.log(chalk.bold('Confidence Analysis:'));

const highConfidence = contracts.filter(c => c.confidence.fieldExtractionConfidence >= 0.7);
const mediumConfidence = contracts.filter(c => c.confidence.fieldExtractionConfidence >= 0.4 && c.confidence.fieldExtractionConfidence < 0.7);
const lowConfidence = contracts.filter(c => c.confidence.fieldExtractionConfidence < 0.4);

console.log(`  High (≥70%):    ${chalk.green(highConfidence.length)}`);
console.log(`  Medium (40-70%): ${chalk.yellow(mediumConfidence.length)}`);
console.log(`  Low (<40%):     ${chalk.red(lowConfidence.length)}`);

if (lowConfidence.length > highConfidence.length) {
  console.log();
  console.log(chalk.yellow('Tip: Many contracts have low confidence.'));
  console.log(chalk.gray('Run `drift parser` to check if tree-sitter is available.'));
}
```

---

## Package.json Updates

### packages/core/package.json

```json
{
  "dependencies": {
    // ... existing deps
  },
  "optionalDependencies": {
    "tree-sitter": "^0.21.0",
    "tree-sitter-python": "^0.21.0"
  },
  "devDependencies": {
    // ... existing deps
    "@types/tree-sitter": "^0.21.0"
  }
}
```

### packages/cli/package.json

```json
{
  "bin": {
    "drift": "./dist/bin/drift.js"
  },
  "scripts": {
    // ... existing scripts
  }
}
```

No changes needed - CLI automatically uses updated core package.

### packages/mcp/package.json

```json
{
  "dependencies": {
    "driftdetect-core": "workspace:*",
    // ... existing deps
  }
}
```

No changes needed - MCP automatically uses updated core package.

---

## Dashboard Integration

The dashboard will automatically show improved contract confidence. No code changes required, but we should update the UI to highlight confidence levels:

```typescript
// packages/dashboard/src/client/components/contracts/ContractStats.tsx

// Add confidence breakdown visualization
<div className="confidence-breakdown">
  <h4>Field Extraction Confidence</h4>
  <div className="confidence-bar">
    <div 
      className="high" 
      style={{ width: `${(highConfidence / total) * 100}%` }}
      title={`High: ${highConfidence}`}
    />
    <div 
      className="medium" 
      style={{ width: `${(mediumConfidence / total) * 100}%` }}
      title={`Medium: ${mediumConfidence}`}
    />
    <div 
      className="low" 
      style={{ width: `${(lowConfidence / total) * 100}%` }}
      title={`Low: ${lowConfidence}`}
    />
  </div>
  {lowConfidence > highConfidence && (
    <p className="tip">
      💡 Install tree-sitter for better Python parsing
    </p>
  )}
</div>
```


---

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test-tree-sitter.yml

name: Tree-sitter Python Parser Tests

on:
  push:
    paths:
      - 'packages/core/src/parsers/tree-sitter/**'
      - 'packages/detectors/src/contracts/**'
  pull_request:
    paths:
      - 'packages/core/src/parsers/tree-sitter/**'
      - 'packages/detectors/src/contracts/**'

jobs:
  test-with-tree-sitter:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20]
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        run: pnpm build
      
      - name: Test with tree-sitter
        run: pnpm test --filter @drift/core -- --grep "TreeSitter"
      
      - name: Test Pydantic extraction
        run: pnpm test --filter @drift/core -- --grep "Pydantic"
      
      - name: Test contract detection
        run: pnpm test --filter @drift/detectors -- --grep "backend-endpoint"
      
      - name: Integration test on real codebase
        run: |
          cd test-repos/competitive-intelligence-api
          ../../packages/cli/dist/bin/drift.js scan --verbose
          # Verify no errors in output

  test-fallback:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies (without tree-sitter)
        run: |
          pnpm install --ignore-optional
      
      - name: Test fallback to regex parser
        env:
          DRIFT_PYTHON_USE_TREE_SITTER: 'false'
        run: |
          pnpm build
          pnpm test --filter @drift/core -- --grep "PythonParser"
      
      - name: Verify graceful degradation
        run: |
          cd test-repos/competitive-intelligence-api
          ../../packages/cli/dist/bin/drift.js scan --verbose
          # Should complete without errors, just lower confidence

  benchmark:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        run: pnpm build
      
      - name: Run benchmarks
        run: pnpm test:benchmark
      
      - name: Check for performance regression
        run: |
          # Compare against baseline
          # Fail if >20% slower
```

---

## Summary

This design document provides a complete specification for integrating tree-sitter Python parsing into drift, including:

1. **Technical Implementation** - Detailed interfaces, types, and code structure
2. **Milestone Checkpoints** - Clear acceptance criteria for each phase to prevent end-to-end failures
3. **MCP Integration** - New `drift_parser_info` tool and enhanced `drift_contracts` output
4. **CLI Integration** - New `drift parser` command and updated scan/contracts commands
5. **Testing Strategy** - Unit, integration, and benchmark tests with CI workflow
6. **Migration Path** - Backward-compatible, feature-flagged rollout

**Key Benefits:**
- Contract confidence: 0.3 → 0.8+
- Django support: 0% → 90%+
- Non-breaking: Falls back to regex if tree-sitter unavailable
- Observable: Parser status visible in CLI, MCP, and dashboard

**Ready for approval.**
