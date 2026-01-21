/**
 * Django Contract Detection Module
 *
 * Public exports for Django REST Framework endpoint detection.
 *
 * @module contracts/django
 */

// ============================================
// Main Detector
// ============================================

export { DjangoEndpointDetector, createDjangoEndpointDetector } from './django-endpoint-detector.js';

// ============================================
// Extractors
// ============================================

export { DjangoViewSetExtractor } from './viewset-extractor.js';
export { DjangoSerializerExtractor } from './serializer-extractor.js';
export { DjangoURLExtractor } from './url-extractor.js';

// ============================================
// Types
// ============================================

export type {
  DjangoViewSetInfo,
  DjangoAPIViewInfo,
  DjangoFunctionViewInfo,
  DjangoActionInfo,
  DjangoSerializerInfo,
  DjangoSerializerFieldInfo,
  DjangoFieldKwargs,
  DjangoURLPatternInfo,
  DjangoRouterInfo,
  DjangoRouterRegistration,
  DjangoExtractionResult,
} from './types.js';

export {
  DJANGO_FIELD_TYPE_MAP,
  VIEWSET_ACTION_METHODS,
  toContractField,
  toContractFields,
} from './types.js';
