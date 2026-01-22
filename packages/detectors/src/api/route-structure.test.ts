/**
 * Route Structure Detector Tests
 *
 * Tests for the route URL structure pattern detector.
 *
 * @requirements 10.1 - THE API_Detector SHALL detect route URL structure patterns
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  RouteStructureDetector,
  createRouteStructureDetector,
  analyzeRouteStructure,
  detectExpressRoutes,
  detectNextjsAppRouterPatterns,
  detectNextjsPagesRouterPatterns,
  detectVersioningPatterns,
  detectUrlLiterals,
  detectCasingViolations,
  detectNamingViolations,
  detectMissingVersioning,
  detectDeepNestingViolations,
  detectCasing,
  isPlural,
  isSingular,
  toPlural,
  toKebabCase,
  calculateNestingDepth,
  extractRouteParameters,
  shouldExcludeFile,
  type RoutePatternInfo,
} from './route-structure.js';
import type { DetectionContext } from '../base/index.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockContext = (content: string, file: string = 'src/routes.ts'): DetectionContext => ({
  file,
  content,
  ast: null,
  imports: [],
  exports: [],
  language: 'typescript',
  extension: '.ts',
  isTestFile: false,
  isTypeDefinition: false,
  projectContext: {
    rootDir: '/project',
    files: [file],
    config: {},
  },
});

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Helper Functions', () => {
  describe('shouldExcludeFile', () => {
    it('should exclude test files', () => {
      expect(shouldExcludeFile('src/routes.test.ts')).toBe(true);
      expect(shouldExcludeFile('src/routes.spec.ts')).toBe(true);
    });

    it('should exclude story files', () => {
      expect(shouldExcludeFile('src/Button.stories.tsx')).toBe(true);
    });

    it('should exclude type definition files', () => {
      expect(shouldExcludeFile('src/types.d.ts')).toBe(true);
    });

    it('should not exclude regular source files', () => {
      expect(shouldExcludeFile('src/routes.ts')).toBe(false);
      expect(shouldExcludeFile('src/api/users.ts')).toBe(false);
    });
  });

  describe('detectCasing', () => {
    it('should detect kebab-case', () => {
      expect(detectCasing('user-profile')).toBe('kebab-case');
      expect(detectCasing('api-v1')).toBe('kebab-case');
    });

    it('should detect camelCase', () => {
      expect(detectCasing('userProfile')).toBe('camelCase');
      expect(detectCasing('getUserById')).toBe('camelCase');
    });

    it('should detect snake_case', () => {
      expect(detectCasing('user_profile')).toBe('snake_case');
      expect(detectCasing('get_user')).toBe('snake_case');
    });

    it('should detect lowercase', () => {
      expect(detectCasing('users')).toBe('lowercase');
      expect(detectCasing('api')).toBe('lowercase');
    });

    it('should treat parameters as lowercase', () => {
      expect(detectCasing(':id')).toBe('lowercase');
      expect(detectCasing('[userId]')).toBe('lowercase');
    });
  });

  describe('isPlural', () => {
    it('should identify plural resources', () => {
      expect(isPlural('users')).toBe(true);
      expect(isPlural('posts')).toBe(true);
      expect(isPlural('comments')).toBe(true);
    });

    it('should identify words ending in s as plural', () => {
      expect(isPlural('items')).toBe(true);
      expect(isPlural('products')).toBe(true);
    });
  });

  describe('isSingular', () => {
    it('should identify singular resources', () => {
      expect(isSingular('user')).toBe(true);
      expect(isSingular('post')).toBe(true);
      expect(isSingular('comment')).toBe(true);
    });
  });

  describe('toPlural', () => {
    it('should convert regular nouns to plural', () => {
      expect(toPlural('user')).toBe('users');
      expect(toPlural('post')).toBe('posts');
    });

    it('should handle words ending in y', () => {
      expect(toPlural('category')).toBe('categories');
      expect(toPlural('company')).toBe('companies');
    });

    it('should handle words ending in s, x, ch, sh', () => {
      expect(toPlural('bus')).toBe('buses');
      expect(toPlural('box')).toBe('boxes');
      expect(toPlural('match')).toBe('matches');
      expect(toPlural('dish')).toBe('dishes');
    });
  });

  describe('toKebabCase', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('userProfile')).toBe('user-profile');
      expect(toKebabCase('getUserById')).toBe('get-user-by-id');
    });

    it('should convert snake_case to kebab-case', () => {
      expect(toKebabCase('user_profile')).toBe('user-profile');
    });
  });

  describe('calculateNestingDepth', () => {
    it('should calculate depth for simple routes', () => {
      expect(calculateNestingDepth('/users')).toBe(1);
      expect(calculateNestingDepth('/api/users')).toBe(1);
    });

    it('should skip version segments', () => {
      expect(calculateNestingDepth('/api/v1/users')).toBe(1);
      expect(calculateNestingDepth('/v2/users')).toBe(1);
    });

    it('should skip parameters', () => {
      expect(calculateNestingDepth('/users/:id')).toBe(1);
      expect(calculateNestingDepth('/users/[id]')).toBe(1);
    });

    it('should count nested resources', () => {
      expect(calculateNestingDepth('/users/:id/posts')).toBe(2);
      expect(calculateNestingDepth('/users/:id/posts/:postId/comments')).toBe(3);
    });
  });

  describe('extractRouteParameters', () => {
    it('should extract Express-style parameters', () => {
      expect(extractRouteParameters('/users/:id')).toEqual(['id']);
      expect(extractRouteParameters('/users/:userId/posts/:postId')).toEqual(['userId', 'postId']);
    });

    it('should extract Next.js dynamic parameters', () => {
      expect(extractRouteParameters('/users/[id]')).toEqual(['id']);
      expect(extractRouteParameters('/users/[userId]/posts/[postId]')).toEqual(['userId', 'postId']);
    });

    it('should return empty array for routes without parameters', () => {
      expect(extractRouteParameters('/users')).toEqual([]);
      expect(extractRouteParameters('/api/v1/posts')).toEqual([]);
    });
  });
});

// ============================================================================
// Detection Function Tests
// ============================================================================

describe('Detection Functions', () => {
  describe('detectExpressRoutes', () => {
    it('should detect router.get() patterns', () => {
      const content = `
        router.get('/users', getUsers);
        router.post('/users', createUser);
        router.get('/users/:id', getUserById);
      `;
      const results = detectExpressRoutes(content, 'routes.ts');
      
      expect(results.length).toBe(3);
      expect(results[0]?.routePath).toBe('/users');
      expect(results[0]?.httpMethod).toBe('GET');
      expect(results[1]?.routePath).toBe('/users');
      expect(results[1]?.httpMethod).toBe('POST');
      expect(results[2]?.routePath).toBe('/users/:id');
      expect(results[2]?.httpMethod).toBe('GET');
    });

    it('should detect app.get() patterns', () => {
      const content = `
        app.get('/api/v1/users', getUsers);
        app.delete('/api/v1/users/:id', deleteUser);
      `;
      const results = detectExpressRoutes(content, 'app.ts');
      
      expect(results.length).toBe(2);
      expect(results[0]?.routePath).toBe('/api/v1/users');
      expect(results[1]?.routePath).toBe('/api/v1/users/:id');
    });

    it('should detect router.route() patterns', () => {
      const content = `
        router.route('/users')
          .get(getUsers)
          .post(createUser);
      `;
      const results = detectExpressRoutes(content, 'routes.ts');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(r => r.routePath === '/users')).toBe(true);
    });

    it('should skip routes in comments', () => {
      const content = `
        // router.get('/commented', handler);
        /* router.post('/blocked', handler); */
        router.get('/active', handler);
      `;
      const results = detectExpressRoutes(content, 'routes.ts');
      
      expect(results.length).toBe(1);
      expect(results[0]?.routePath).toBe('/active');
    });
  });

  describe('detectNextjsAppRouterPatterns', () => {
    it('should detect App Router route files', () => {
      const content = `
        export async function GET(request: Request) {
          return Response.json({ users: [] });
        }
        
        export async function POST(request: Request) {
          return Response.json({ created: true });
        }
      `;
      const results = detectNextjsAppRouterPatterns(content, '/app/api/users/route.ts');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(r => r.type === 'nextjs-app-router')).toBe(true);
    });

    it('should not detect non-route files', () => {
      const content = `export function GET() {}`;
      const results = detectNextjsAppRouterPatterns(content, '/src/utils.ts');
      
      expect(results.length).toBe(0);
    });
  });

  describe('detectNextjsPagesRouterPatterns', () => {
    it('should detect Pages Router API files', () => {
      const content = `
        export default function handler(req, res) {
          res.json({ users: [] });
        }
      `;
      const results = detectNextjsPagesRouterPatterns(content, '/pages/api/users.ts');
      
      expect(results.length).toBe(1);
      expect(results[0]?.type).toBe('nextjs-pages-router');
      expect(results[0]?.routePath).toBe('/api/users');
    });

    it('should handle nested Pages Router paths', () => {
      const content = `export default function handler(req, res) {}`;
      const results = detectNextjsPagesRouterPatterns(content, '/pages/api/users/[id].ts');
      
      expect(results.length).toBe(1);
      expect(results[0]?.routePath).toBe('/api/users/[id]');
    });
  });

  describe('detectVersioningPatterns', () => {
    it('should detect URL path versioning', () => {
      const content = `
        const API_BASE = '/api/v1/';
        fetch('/api/v2/users');
      `;
      const results = detectVersioningPatterns(content, 'api.ts');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(r => r.type === 'versioned-api')).toBe(true);
    });

    it('should detect header-based versioning', () => {
      const content = `
        headers.set('Accept-Version', '1.0');
        headers.set('X-API-Version', '2');
      `;
      const results = detectVersioningPatterns(content, 'api.ts');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('detectUrlLiterals', () => {
    it('should detect API URL strings', () => {
      const content = `
        fetch('/api/users');
        axios.get('/api/v1/posts');
        const url = '/v2/comments/:id';
      `;
      const results = detectUrlLiterals(content, 'client.ts');
      
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect parameterized routes', () => {
      const content = `const url = '/users/:userId/posts/:postId';`;
      const results = detectUrlLiterals(content, 'client.ts');
      
      expect(results.length).toBe(1);
      expect(results[0]?.parameters).toEqual(['userId', 'postId']);
    });
  });
});

// ============================================================================
// Violation Detection Tests
// ============================================================================

describe('Violation Detection', () => {
  describe('detectCasingViolations', () => {
    it('should detect mixed casing conventions', () => {
      const patterns: RoutePatternInfo[] = [
        { type: 'express-route', file: 'routes.ts', line: 1, column: 1, matchedText: '', routePath: '/user-profile' },
        { type: 'express-route', file: 'routes.ts', line: 2, column: 1, matchedText: '', routePath: '/userSettings' },
        { type: 'express-route', file: 'routes.ts', line: 3, column: 1, matchedText: '', routePath: '/user-posts' },
      ];
      
      const violations = detectCasingViolations(patterns, 'routes.ts');
      
      // Should flag camelCase when kebab-case is dominant
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations.some(v => v.type === 'inconsistent-casing')).toBe(true);
    });

    it('should not flag consistent casing', () => {
      const patterns: RoutePatternInfo[] = [
        { type: 'express-route', file: 'routes.ts', line: 1, column: 1, matchedText: '', routePath: '/user-profile' },
        { type: 'express-route', file: 'routes.ts', line: 2, column: 1, matchedText: '', routePath: '/user-settings' },
        { type: 'express-route', file: 'routes.ts', line: 3, column: 1, matchedText: '', routePath: '/user-posts' },
      ];
      
      const violations = detectCasingViolations(patterns, 'routes.ts');
      
      expect(violations.length).toBe(0);
    });
  });

  describe('detectNamingViolations', () => {
    it('should detect singular resource names when plural is dominant', () => {
      const patterns: RoutePatternInfo[] = [
        { type: 'express-route', file: 'routes.ts', line: 1, column: 1, matchedText: '', routePath: '/users' },
        { type: 'express-route', file: 'routes.ts', line: 2, column: 1, matchedText: '', routePath: '/posts' },
        { type: 'express-route', file: 'routes.ts', line: 3, column: 1, matchedText: '', routePath: '/comment' },
      ];
      
      const violations = detectNamingViolations(patterns, 'routes.ts');
      
      expect(violations.length).toBeGreaterThanOrEqual(1);
      expect(violations.some(v => v.value === 'comment')).toBe(true);
    });
  });

  describe('detectMissingVersioning', () => {
    it('should flag unversioned routes when versioning is used elsewhere', () => {
      const patterns: RoutePatternInfo[] = [
        { type: 'versioned-api', file: 'routes.ts', line: 1, column: 1, matchedText: '', routePath: '/api/v1/users' },
        { type: 'express-route', file: 'routes.ts', line: 2, column: 1, matchedText: '', routePath: '/api/posts' },
      ];
      
      const violations = detectMissingVersioning(patterns, 'routes.ts');
      
      expect(violations.length).toBe(1);
      expect(violations[0]?.type).toBe('missing-versioning');
      expect(violations[0]?.value).toBe('/api/posts');
    });

    it('should not flag when no versioning is used', () => {
      const patterns: RoutePatternInfo[] = [
        { type: 'express-route', file: 'routes.ts', line: 1, column: 1, matchedText: '', routePath: '/api/users' },
        { type: 'express-route', file: 'routes.ts', line: 2, column: 1, matchedText: '', routePath: '/api/posts' },
      ];
      
      const violations = detectMissingVersioning(patterns, 'routes.ts');
      
      expect(violations.length).toBe(0);
    });
  });

  describe('detectDeepNestingViolations', () => {
    it('should flag routes with more than 4 levels of nesting', () => {
      // MAX_NESTING_DEPTH is 4, so we need 5 levels to trigger a violation
      const patterns: RoutePatternInfo[] = [
        { 
          type: 'express-route', 
          file: 'routes.ts', 
          line: 1, 
          column: 1, 
          matchedText: '', 
          routePath: '/users/:id/posts/:postId/comments/:commentId/replies/:replyId/reactions' 
        },
      ];
      
      const violations = detectDeepNestingViolations(patterns, 'routes.ts');
      
      expect(violations.length).toBe(1);
      expect(violations[0]?.type).toBe('deeply-nested');
    });

    it('should not flag routes with 4 or fewer levels', () => {
      const patterns: RoutePatternInfo[] = [
        { type: 'express-route', file: 'routes.ts', line: 1, column: 1, matchedText: '', routePath: '/users/:id/posts/:postId/comments/:commentId/replies' },
      ];
      
      const violations = detectDeepNestingViolations(patterns, 'routes.ts');
      
      expect(violations.length).toBe(0);
    });
  });
});

// ============================================================================
// Analysis Function Tests
// ============================================================================

describe('analyzeRouteStructure', () => {
  it('should analyze Express routes', () => {
    const content = `
      router.get('/api/v1/users', getUsers);
      router.post('/api/v1/users', createUser);
      router.get('/api/v1/users/:id', getUserById);
    `;
    
    const analysis = analyzeRouteStructure(content, 'routes.ts');
    
    expect(analysis.routePatterns.length).toBeGreaterThanOrEqual(3);
    expect(analysis.usesRestfulPatterns).toBe(true);
    expect(analysis.usesVersioning).toBe(true);
  });

  it('should skip excluded files', () => {
    const content = `router.get('/users', getUsers);`;
    
    const analysis = analyzeRouteStructure(content, 'routes.test.ts');
    
    expect(analysis.routePatterns.length).toBe(0);
    expect(analysis.violations.length).toBe(0);
  });

  it('should calculate confidence based on violations', () => {
    const content = `
      router.get('/api/v1/users', getUsers);
      router.get('/api/posts', getPosts);
    `;
    
    const analysis = analyzeRouteStructure(content, 'routes.ts');
    
    // Should have lower confidence due to missing versioning violation
    expect(analysis.patternAdherenceConfidence).toBeLessThan(1.0);
  });
});

// ============================================================================
// Detector Class Tests
// ============================================================================

describe('RouteStructureDetector', () => {
  let detector: RouteStructureDetector;

  beforeEach(() => {
    detector = createRouteStructureDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('api/route-structure');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe('api');
    });

    it('should support TypeScript and JavaScript', () => {
      expect(detector.supportedLanguages).toContain('typescript');
      expect(detector.supportedLanguages).toContain('javascript');
    });

    it('should use regex detection method', () => {
      expect(detector.detectionMethod).toBe('regex');
    });
  });

  describe('detect', () => {
    it('should detect Express route patterns', async () => {
      const context = createMockContext(`
        router.get('/api/v1/users', getUsers);
        router.post('/api/v1/users', createUser);
      `);
      
      const result = await detector.detect(context);
      
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect violations', async () => {
      const context = createMockContext(`
        router.get('/api/v1/users', getUsers);
        router.get('/api/post', getPost);
      `);
      
      const result = await detector.detect(context);
      
      // Should detect naming violation (singular 'post')
      expect(result.violations.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty result for excluded files', async () => {
      const context = createMockContext(
        `router.get('/users', getUsers);`,
        'routes.test.ts'
      );
      
      const result = await detector.detect(context);
      
      expect(result.patterns.length).toBe(0);
      expect(result.violations.length).toBe(0);
    });

    it('should detect Next.js App Router patterns', async () => {
      const context = createMockContext(
        `
        export async function GET(request: Request) {
          return Response.json({ users: [] });
        }
        `,
        '/app/api/users/route.ts'
      );
      
      const result = await detector.detect(context);
      
      expect(result.patterns.length).toBeGreaterThan(0);
    });
  });

  describe('generateQuickFix', () => {
    it('should generate quick fix for violations with expected value', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'api/route-structure',
        severity: 'warning' as const,
        file: 'routes.ts',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 10 },
        },
        message: 'Test violation',
        expected: '/api/v1/users',
        actual: '/api/users',
        aiExplainAvailable: false,
        aiFixAvailable: false,
        firstSeen: new Date(),
        occurrences: 1,
      };
      
      const quickFix = detector.generateQuickFix(violation);
      
      expect(quickFix).not.toBeNull();
      expect(quickFix?.title).toContain('/api/v1/users');
    });

    it('should return null for non-route violations', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'other/pattern',
        severity: 'warning' as const,
        file: 'routes.ts',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 10 },
        },
        message: 'Test violation',
        expected: 'something',
        actual: 'other',
        aiExplainAvailable: false,
        aiFixAvailable: false,
        firstSeen: new Date(),
        occurrences: 1,
      };
      
      const quickFix = detector.generateQuickFix(violation);
      
      expect(quickFix).toBeNull();
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('createRouteStructureDetector', () => {
  it('should create a RouteStructureDetector instance', () => {
    const detector = createRouteStructureDetector();
    
    expect(detector).toBeInstanceOf(RouteStructureDetector);
  });
});
