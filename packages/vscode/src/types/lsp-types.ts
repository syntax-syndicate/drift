/**
 * LSP-related type definitions
 */

import type { Severity, PatternStatus } from './extension-types.js';

/**
 * Pattern data from LSP
 */
export interface PatternData {
  id: string;
  name: string;
  category: string;
  confidence: number;
  status: PatternStatus;
  locationCount: number;
  description?: string;
}

/**
 * Violation data from LSP
 */
export interface ViolationData {
  id: string;
  patternId: string;
  severity: Severity;
  file: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  message: string;
  hasQuickFix: boolean;
  aiExplainAvailable: boolean;
  aiFixAvailable: boolean;
}

/**
 * Category summary from LSP
 */
export interface CategoryData {
  name: string;
  count: number;
  approvedCount: number;
  violationCount: number;
}

/**
 * File pattern data from LSP
 */
export interface FilePatternData {
  path: string;
  patternCount: number;
  violationCount: number;
  categories: string[];
}

/**
 * LSP health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
}

/**
 * LSP request types
 */
export type LSPRequestType =
  | 'drift/health'
  | 'drift/patterns/list'
  | 'drift/patterns/get'
  | 'drift/patterns/categories'
  | 'drift/violations/list'
  | 'drift/files/list'
  | 'drift/rescan';
