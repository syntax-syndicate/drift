/**
 * Contract Detectors - BE↔FE mismatch detection
 *
 * These detectors extract API endpoint definitions from backend code
 * and TypeScript types from frontend code, enabling cross-file
 * contract matching and mismatch detection.
 */

export * from './backend-endpoint-detector.js';
export * from './frontend-type-detector.js';
export * from './contract-matcher.js';
export * from './schema-parser.js';
export * from './types.js';

// Django REST Framework support
export * from './django/index.js';

// ASP.NET Core support
export * from './aspnet/index.js';
