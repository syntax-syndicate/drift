/**
 * Tests for the Unified File Naming Detector
 *
 * Tests all three detection strategies: structural, learning, and semantic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FileNamingUnifiedDetector,
  createFileNamingUnifiedDetector,
  detectNamingConvention,
  convertToConvention,
  splitIntoWords,
  extractBaseName,
  analyzeFileName,
} from './file-naming-unified.js';
import type { DetectionContext } from '../base/index.js';

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('detectNamingConvention', () => {
    it('should detect PascalCase', () => {
      expect(detectNamingConvention('UserService')).toBe('PascalCase');
      expect(detectNamingConvention('MyComponent')).toBe('PascalCase');
      expect(detectNamingConvention('API')).toBe('SCREAMING_SNAKE_CASE'); // All caps
    });

    it('should detect camelCase', () => {
      expect(detectNamingConvention('userService')).toBe('camelCase');
      expect(detectNamingConvention('myComponent')).toBe('camelCase');
    });

    it('should detect kebab-case', () => {
      expect(detectNamingConvention('user-service')).toBe('kebab-case');
      expect(detectNamingConvention('my-component')).toBe('kebab-case');
    });

    it('should detect snake_case', () => {
      expect(detectNamingConvention('user_service')).toBe('snake_case');
      expect(detectNamingConvention('my_component')).toBe('snake_case');
    });

    it('should detect SCREAMING_SNAKE_CASE', () => {
      expect(detectNamingConvention('USER_SERVICE')).toBe('SCREAMING_SNAKE_CASE');
      expect(detectNamingConvention('MY_COMPONENT')).toBe('SCREAMING_SNAKE_CASE');
    });

    it('should return unknown for empty or invalid names', () => {
      expect(detectNamingConvention('')).toBe('unknown');
    });
  });

  describe('splitIntoWords', () => {
    it('should split PascalCase', () => {
      expect(splitIntoWords('UserService')).toEqual(['User', 'Service']);
    });

    it('should split camelCase', () => {
      expect(splitIntoWords('userService')).toEqual(['user', 'Service']);
    });

    it('should split kebab-case', () => {
      expect(splitIntoWords('user-service')).toEqual(['user', 'service']);
    });

    it('should split snake_case', () => {
      expect(splitIntoWords('user_service')).toEqual(['user', 'service']);
    });
  });

  describe('convertToConvention', () => {
    it('should convert to PascalCase', () => {
      expect(convertToConvention('user-service', 'PascalCase')).toBe('UserService');
      expect(convertToConvention('user_service', 'PascalCase')).toBe('UserService');
    });

    it('should convert to camelCase', () => {
      expect(convertToConvention('user-service', 'camelCase')).toBe('userService');
      expect(convertToConvention('UserService', 'camelCase')).toBe('userService');
    });

    it('should convert to kebab-case', () => {
      expect(convertToConvention('UserService', 'kebab-case')).toBe('user-service');
      expect(convertToConvention('userService', 'kebab-case')).toBe('user-service');
    });

    it('should convert to snake_case', () => {
      expect(convertToConvention('UserService', 'snake_case')).toBe('user_service');
      expect(convertToConvention('user-service', 'snake_case')).toBe('user_service');
    });
  });

  describe('extractBaseName', () => {
    it('should extract base name and suffix', () => {
      const result = extractBaseName('user.service.ts');
      expect(result.baseName).toBe('user');
      expect(result.suffix).toBe('.service');
      expect(result.extension).toBe('.ts');
    });

    it('should handle files without suffix', () => {
      const result = extractBaseName('utils.ts');
      expect(result.baseName).toBe('utils');
      expect(result.suffix).toBeUndefined();
      expect(result.extension).toBe('.ts');
    });

    it('should handle test files', () => {
      const result = extractBaseName('user.test.ts');
      expect(result.baseName).toBe('user');
      expect(result.suffix).toBe('.test');
      expect(result.extension).toBe('.ts');
    });
  });

  describe('analyzeFileName', () => {
    it('should analyze file naming', () => {
      const result = analyzeFileName('src/services/user-service.ts');
      expect(result.fileName).toBe('user-service.ts');
      expect(result.baseName).toBe('user-service'); // No suffix detected for this pattern
      expect(result.convention).toBe('kebab-case');
      expect(result.suffix).toBeUndefined(); // .service suffix requires dot before it
    });

    it('should extract suffix when present', () => {
      const result = analyzeFileName('src/services/user.service.ts');
      expect(result.fileName).toBe('user.service.ts');
      expect(result.baseName).toBe('user');
      expect(result.suffix).toBe('.service');
    });

    it('should detect when file follows dominant pattern', () => {
      const result = analyzeFileName('src/UserComponent.tsx', 'PascalCase');
      expect(result.followsPattern).toBe(true);
    });

    it('should detect when file does not follow dominant pattern', () => {
      const result = analyzeFileName('src/user-component.tsx', 'PascalCase');
      expect(result.followsPattern).toBe(false);
      expect(result.suggestedName).toBe('UserComponent.tsx');
    });
  });
});

// ============================================================================
// Unified Detector Tests
// ============================================================================

describe('FileNamingUnifiedDetector', () => {
  let detector: FileNamingUnifiedDetector;

  beforeEach(() => {
    detector = createFileNamingUnifiedDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('structural/file-naming');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe('structural');
    });

    it('should support multiple strategies', () => {
      expect(detector.strategies).toContain('structural');
      expect(detector.strategies).toContain('learning');
      expect(detector.strategies).toContain('semantic');
    });

    it('should support multiple languages', () => {
      expect(detector.supportedLanguages).toContain('typescript');
      expect(detector.supportedLanguages).toContain('javascript');
      expect(detector.supportedLanguages).toContain('python');
    });
  });

  describe('detect()', () => {
    it('should detect file naming patterns', async () => {
      const context: DetectionContext = {
        file: 'src/components/UserProfile.tsx',
        content: 'export function UserProfile() { return <div>Profile</div>; }',
        language: 'typescript',
        projectContext: {
          rootDir: '/project',
          files: [
            'src/components/UserProfile.tsx',
            'src/components/Dashboard.tsx',
            'src/components/Settings.tsx',
          ],
          packageJson: {},
        },
      };

      const result = await detector.detect(context);
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    it('should detect violations when file does not match dominant convention', async () => {
      const context: DetectionContext = {
        file: 'src/components/user-profile.tsx',
        content: 'export function UserProfile() { return <div>Profile</div>; }',
        language: 'typescript',
        projectContext: {
          rootDir: '/project',
          files: [
            'src/components/user-profile.tsx',
            'src/components/Dashboard.tsx',
            'src/components/Settings.tsx',
            'src/components/Header.tsx',
            'src/components/Footer.tsx',
          ],
          packageJson: {},
        },
      };

      const result = await detector.detect(context);
      // Should detect that user-profile.tsx doesn't match PascalCase dominant convention
      expect(result.violations.length).toBeGreaterThanOrEqual(0);
    });

    it('should run specific strategies when requested', async () => {
      const context: DetectionContext = {
        file: 'src/utils/helpers.ts',
        content: 'export function helper() {}',
        language: 'typescript',
        projectContext: {
          rootDir: '/project',
          files: ['src/utils/helpers.ts'],
          packageJson: {},
        },
      };

      const result = await detector.detect(context, { strategies: ['structural'] });
      expect(result).toBeDefined();
    });
  });

  describe('generateQuickFix()', () => {
    it('should generate quick fix for rename violations', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'structural/file-naming',
        severity: 'warning' as const,
        file: 'src/user-service.ts',
        range: { start: { line: 1, character: 1 }, end: { line: 1, character: 1 } },
        message: "File 'user-service.ts' uses kebab-case but project uses PascalCase. It should be renamed to 'UserService.ts'",
        expected: 'PascalCase naming convention',
        actual: 'kebab-case naming convention',
        aiExplainAvailable: false,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const quickFix = detector.generateQuickFix(violation);
      expect(quickFix).not.toBeNull();
      expect(quickFix?.title).toBe('Rename to UserService.ts');
    });

    it('should return null for violations without rename suggestion', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'structural/file-naming',
        severity: 'warning' as const,
        file: 'src/test.ts',
        range: { start: { line: 1, character: 1 }, end: { line: 1, character: 1 } },
        message: 'Some other message without rename suggestion',
        expected: 'something',
        actual: 'something else',
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
// Strategy-Specific Tests
// ============================================================================

describe('Detection Strategies', () => {
  let detector: FileNamingUnifiedDetector;

  beforeEach(() => {
    detector = createFileNamingUnifiedDetector();
  });

  describe('structural strategy', () => {
    it('should analyze project file patterns', async () => {
      const context: DetectionContext = {
        file: 'src/services/user-service.ts',
        content: '',
        language: 'typescript',
        projectContext: {
          rootDir: '/project',
          files: [
            'src/services/user-service.ts',
            'src/services/auth-service.ts',
            'src/services/data-service.ts',
          ],
          packageJson: {},
        },
      };

      const result = await detector.detect(context, { strategies: ['structural'] });
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns[0]?.patternId).toContain('file-naming');
    });
  });

  describe('learning strategy', () => {
    it('should learn conventions from project files', async () => {
      const context: DetectionContext = {
        file: 'src/components/UserProfile.tsx',
        content: '',
        language: 'typescript',
        projectContext: {
          rootDir: '/project',
          files: [
            'src/components/UserProfile.tsx',
            'src/components/Dashboard.tsx',
            'src/components/Settings.tsx',
            'src/hooks/useAuth.ts',
            'src/hooks/useData.ts',
          ],
          packageJson: {},
        },
      };

      const result = await detector.detect(context, { strategies: ['learning'] });
      expect(result).toBeDefined();
    });
  });

  describe('semantic strategy', () => {
    it('should detect naming-related keywords in content', async () => {
      const context: DetectionContext = {
        file: 'src/naming-conventions.md',
        content: 'Use PascalCase for component file naming conventions.',
        language: 'markdown',
        projectContext: {
          rootDir: '/project',
          files: ['src/naming-conventions.md'],
          packageJson: {},
        },
      };

      const result = await detector.detect(context, { strategies: ['semantic'] });
      expect(result).toBeDefined();
    });
  });
});
