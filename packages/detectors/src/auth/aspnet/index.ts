/**
 * ASP.NET Core Auth Detectors
 *
 * C#-specific authentication and authorization pattern detectors.
 */

export {
  AuthorizeAttributeDetector,
  createAuthorizeAttributeDetector,
  type AuthorizeAttributeInfo,
  type AuthorizationAnalysis,
} from './authorize-attribute-detector.js';

export {
  IdentityPatternsDetector,
  createIdentityPatternsDetector,
  type IdentityUsageInfo,
  type IdentityAnalysis,
} from './identity-patterns-detector.js';

export {
  JwtPatternsDetector,
  createJwtPatternsDetector,
  type JwtPatternInfo,
  type JwtAnalysis,
} from './jwt-patterns-detector.js';

export {
  PolicyHandlersDetector,
  createPolicyHandlersDetector,
  type PolicyHandlerInfo,
  type PolicyAnalysis,
} from './policy-handlers-detector.js';

export {
  ResourceAuthorizationDetector,
  createResourceAuthorizationDetector,
  type ResourceAuthInfo,
  type ResourceAuthAnalysis,
} from './resource-authorization-detector.js';

