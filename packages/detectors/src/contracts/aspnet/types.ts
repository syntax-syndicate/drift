/**
 * ASP.NET Contract Detection Types
 */

import type { ContractField, HttpMethod } from 'driftdetect-core';

/**
 * ASP.NET route attribute information
 */
export interface AspNetRouteAttribute {
  /** HTTP method (GET, POST, etc.) */
  method: HttpMethod;
  /** Route template */
  template: string | null;
  /** Attribute name (HttpGet, HttpPost, Route, etc.) */
  attributeName: string;
  /** Line number */
  line: number;
}

/**
 * ASP.NET controller information
 */
export interface AspNetController {
  /** Controller name */
  name: string;
  /** Base route from [Route] attribute */
  baseRoute: string | null;
  /** Whether it has [ApiController] attribute */
  isApiController: boolean;
  /** File path */
  file: string;
  /** Line number */
  line: number;
}

/**
 * ASP.NET action/endpoint information
 */
export interface AspNetAction {
  /** Action method name */
  name: string;
  /** HTTP method */
  method: HttpMethod;
  /** Route template (combined with controller route) */
  routeTemplate: string | null;
  /** Full resolved path */
  fullPath: string;
  /** Return type */
  returnType: string;
  /** Parameters */
  parameters: AspNetParameter[];
  /** Authorization attributes */
  authAttributes: AspNetAuthAttribute[];
  /** Line number */
  line: number;
}

/**
 * ASP.NET action parameter
 */
export interface AspNetParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: string;
  /** Source ([FromBody], [FromQuery], [FromRoute], etc.) */
  source: 'body' | 'query' | 'route' | 'header' | 'form' | 'services' | 'unknown';
  /** Whether parameter is optional */
  optional: boolean;
  /** Default value if any */
  defaultValue: string | null;
}

/**
 * ASP.NET authorization attribute
 */
export interface AspNetAuthAttribute {
  /** Attribute name (Authorize, AllowAnonymous, etc.) */
  name: string;
  /** Roles if specified */
  roles: string[];
  /** Policy if specified */
  policy: string | null;
  /** Authentication schemes */
  authenticationSchemes: string[];
}

/**
 * Extracted ASP.NET endpoint for contract matching
 */
export interface AspNetEndpoint {
  /** HTTP method */
  method: HttpMethod;
  /** Original route template */
  path: string;
  /** Normalized path for matching */
  normalizedPath: string;
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Response fields (from return type) */
  responseFields: ContractField[];
  /** Request body fields */
  requestFields: ContractField[];
  /** Framework identifier */
  framework: 'aspnet-core';
  /** Controller name */
  controller: string;
  /** Action name */
  action: string;
  /** Authorization info */
  authorization: AspNetAuthAttribute[];
}

/**
 * Result of ASP.NET endpoint extraction
 */
export interface AspNetExtractionResult {
  /** Extracted endpoints */
  endpoints: AspNetEndpoint[];
  /** Framework */
  framework: 'aspnet-core' | 'aspnet-minimal';
  /** Confidence score */
  confidence: number;
  /** Controllers found */
  controllers: AspNetController[];
}

/**
 * DTO/Record information for field extraction
 */
export interface AspNetDto {
  /** Type name */
  name: string;
  /** Namespace */
  namespace: string | null;
  /** Fields/properties */
  fields: ContractField[];
  /** Whether it's a record type */
  isRecord: boolean;
  /** Line number */
  line: number;
}
