/**
 * Typography Detector Tests
 *
 * Tests for typography scale detection and hardcoded typography value detection.
 *
 * @requirements 9.4 - THE Styling_Detector SHALL detect typography scale adherence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { DetectionContext } from '../base/index.js';
import {
  TypographyDetector,
  createTypographyDetector,
  // Helper functions
  shouldExcludeFile,
  isAllowedTypographyValue,
  isAllowedFontFamily,
  isOnTypographyScale,
  isOnLineHeightScale,
  isOnFontWeightScale,
  findNearestFontSize,
  findNearestLineHeight,
  findNearestFontWeight,
  detectCSSTypographyProperties,
  detectThemeTypography,
  detectTailwindTypography,
  detectTailwindArbitraryTypography,
  detectArbitraryFontSizes,
  detectArbitraryLineHeights,
  detectArbitraryFontWeights,
  detectHardcodedFontFamilies,
  analyzeTypography,
} from './typography.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock detection context for testing
 */
function createMockContext(file: string, content: string): DetectionContext {
  return {
    file,
    content,
    ast: null,
    imports: [],
    exports: [],
    language: file.endsWith('.css') ? 'css' : 'typescript',
    extension: file.split('.').pop() || '',
    isTestFile: false,
    isTypeDefinition: false,
    projectContext: {
      rootDir: '/project',
      files: [file],
      config: {},
    },
  };
}

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('Typography Helper Functions', () => {
  describe('shouldExcludeFile', () => {
    it('should exclude test files', () => {
      expect(shouldExcludeFile('Button.test.ts')).toBe(true);
      expect(shouldExcludeFile('Button.spec.tsx')).toBe(true);
    });

    it('should exclude story files', () => {
      expect(shouldExcludeFile('Button.stories.tsx')).toBe(true);
    });

    it('should exclude design token files', () => {
      expect(shouldExcludeFile('design-tokens/typography.ts')).toBe(true);
      expect(shouldExcludeFile('tokens/fonts.ts')).toBe(true);
    });

    it('should exclude theme files', () => {
      expect(shouldExcludeFile('theme/typography.ts')).toBe(true);
    });

    it('should exclude config files', () => {
      expect(shouldExcludeFile('tailwind.config.js')).toBe(true);
      expect(shouldExcludeFile('app.config.ts')).toBe(true);
    });

    it('should not exclude regular component files', () => {
      expect(shouldExcludeFile('Button.tsx')).toBe(false);
      expect(shouldExcludeFile('styles.css')).toBe(false);
    });
  });

  describe('isAllowedTypographyValue', () => {
    it('should allow inherit, initial, unset', () => {
      expect(isAllowedTypographyValue('inherit')).toBe(true);
      expect(isAllowedTypographyValue('initial')).toBe(true);
      expect(isAllowedTypographyValue('unset')).toBe(true);
    });

    it('should allow normal and none', () => {
      expect(isAllowedTypographyValue('normal')).toBe(true);
      expect(isAllowedTypographyValue('none')).toBe(true);
    });

    it('should not allow arbitrary values', () => {
      expect(isAllowedTypographyValue('13px')).toBe(false);
      expect(isAllowedTypographyValue('1.3')).toBe(false);
    });
  });

  describe('isAllowedFontFamily', () => {
    it('should allow system fonts', () => {
      expect(isAllowedFontFamily('system-ui')).toBe(true);
      expect(isAllowedFontFamily('-apple-system')).toBe(true);
      expect(isAllowedFontFamily('sans-serif')).toBe(true);
    });

    it('should allow font stacks with system fonts', () => {
      expect(isAllowedFontFamily('Arial, sans-serif')).toBe(true);
      expect(isAllowedFontFamily('"Helvetica Neue", system-ui')).toBe(true);
    });

    it('should not allow custom font families without system fallback', () => {
      expect(isAllowedFontFamily('Roboto')).toBe(false);
      expect(isAllowedFontFamily('"Custom Font"')).toBe(false);
    });
  });

  describe('isOnTypographyScale', () => {
    it('should recognize standard px font sizes', () => {
      expect(isOnTypographyScale(12, 'px')).toBe(true);
      expect(isOnTypographyScale(14, 'px')).toBe(true);
      expect(isOnTypographyScale(16, 'px')).toBe(true);
      expect(isOnTypographyScale(18, 'px')).toBe(true);
      expect(isOnTypographyScale(24, 'px')).toBe(true);
    });

    it('should reject arbitrary px font sizes', () => {
      expect(isOnTypographyScale(15, 'px')).toBe(false);
      expect(isOnTypographyScale(17, 'px')).toBe(false);
      expect(isOnTypographyScale(19, 'px')).toBe(false);
    });

    it('should recognize standard rem font sizes', () => {
      expect(isOnTypographyScale(1, 'rem')).toBe(true);
      expect(isOnTypographyScale(1.125, 'rem')).toBe(true);
      expect(isOnTypographyScale(1.5, 'rem')).toBe(true);
    });

    it('should reject arbitrary rem font sizes', () => {
      expect(isOnTypographyScale(1.1, 'rem')).toBe(false);
      expect(isOnTypographyScale(1.3, 'rem')).toBe(false);
    });
  });

  describe('isOnLineHeightScale', () => {
    it('should recognize standard line heights', () => {
      expect(isOnLineHeightScale(1)).toBe(true);
      expect(isOnLineHeightScale(1.25)).toBe(true);
      expect(isOnLineHeightScale(1.5)).toBe(true);
      expect(isOnLineHeightScale(1.75)).toBe(true);
      expect(isOnLineHeightScale(2)).toBe(true);
    });

    it('should reject arbitrary line heights', () => {
      expect(isOnLineHeightScale(1.3)).toBe(false);
      expect(isOnLineHeightScale(1.4)).toBe(false);
      expect(isOnLineHeightScale(1.6)).toBe(false);
    });
  });

  describe('isOnFontWeightScale', () => {
    it('should recognize standard font weights', () => {
      expect(isOnFontWeightScale(100)).toBe(true);
      expect(isOnFontWeightScale(400)).toBe(true);
      expect(isOnFontWeightScale(500)).toBe(true);
      expect(isOnFontWeightScale(700)).toBe(true);
      expect(isOnFontWeightScale(900)).toBe(true);
    });

    it('should reject arbitrary font weights', () => {
      expect(isOnFontWeightScale(450)).toBe(false);
      expect(isOnFontWeightScale(550)).toBe(false);
      expect(isOnFontWeightScale(650)).toBe(false);
    });
  });

  describe('findNearestFontSize', () => {
    it('should find nearest px font size', () => {
      expect(findNearestFontSize(15, 'px')).toBe(14);
      expect(findNearestFontSize(17, 'px')).toBe(16);
      expect(findNearestFontSize(19, 'px')).toBe(18);
    });

    it('should find nearest rem font size', () => {
      expect(findNearestFontSize(1.1, 'rem')).toBe(1.125);
      expect(findNearestFontSize(1.3, 'rem')).toBe(1.25);
    });
  });

  describe('findNearestLineHeight', () => {
    it('should find nearest line height', () => {
      expect(findNearestLineHeight(1.3)).toBe(1.25);
      expect(findNearestLineHeight(1.4)).toBe(1.375);
      expect(findNearestLineHeight(1.6)).toBe(1.625);
    });
  });

  describe('findNearestFontWeight', () => {
    it('should find nearest font weight', () => {
      expect(findNearestFontWeight(450)).toBe(400);
      expect(findNearestFontWeight(550)).toBe(500);
      expect(findNearestFontWeight(650)).toBe(600);
    });
  });
});

// ============================================================================
// Pattern Detection Tests
// ============================================================================

describe('Typography Pattern Detection', () => {
  describe('detectCSSTypographyProperties', () => {
    it('should detect CSS custom properties for font size', () => {
      const content = `
        .heading {
          font-size: var(--font-size-lg);
        }
      `;
      const results = detectCSSTypographyProperties(content, 'styles.css');

      expect(results.length).toBe(1);
      expect(results[0]?.type).toBe('css-typography-property');
      expect(results[0]?.matchedText).toContain('--font-size-lg');
    });

    it('should detect CSS custom properties for line height', () => {
      const content = `
        .text {
          line-height: var(--line-height-normal);
        }
      `;
      const results = detectCSSTypographyProperties(content, 'styles.css');

      expect(results.length).toBe(1);
      expect(results[0]?.matchedText).toContain('--line-height-normal');
    });

    it('should detect CSS custom properties for font weight', () => {
      const content = `
        .bold {
          font-weight: var(--font-weight-bold);
        }
      `;
      const results = detectCSSTypographyProperties(content, 'styles.css');

      expect(results.length).toBe(1);
      expect(results[0]?.matchedText).toContain('--font-weight-bold');
    });
  });

  describe('detectThemeTypography', () => {
    it('should detect theme.typography usage', () => {
      const content = `
        const styles = {
          fontSize: theme.typography.lg,
        };
      `;
      const results = detectThemeTypography(content, 'Button.tsx');

      // May match multiple patterns (theme.typography.lg and typography.lg)
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]?.type).toBe('theme-typography');
    });

    it('should detect theme.fontSizes usage', () => {
      const content = `
        const styles = {
          fontSize: theme.fontSizes.md,
        };
      `;
      const results = detectThemeTypography(content, 'Button.tsx');

      // May match multiple patterns (theme.fontSizes.md and fontSizes.md)
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]?.type).toBe('theme-typography');
    });

    it('should detect template literal theme usage', () => {
      const content = `
        const Button = styled.button\`
          font-size: \${theme.typography.sm};
        \`;
      `;
      const results = detectThemeTypography(content, 'Button.tsx');

      // May match multiple patterns
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('detectTailwindTypography', () => {
    it('should detect Tailwind font size classes', () => {
      const content = `
        <div className="text-sm text-lg text-xl">
          Content
        </div>
      `;
      const results = detectTailwindTypography(content, 'Button.tsx');

      expect(results.length).toBe(3);
      expect(results.every(r => r.type === 'tailwind-typography')).toBe(true);
    });

    it('should detect Tailwind font weight classes', () => {
      const content = `
        <div className="font-bold font-medium font-semibold">
          Content
        </div>
      `;
      const results = detectTailwindTypography(content, 'Button.tsx');

      expect(results.length).toBe(3);
    });

    it('should detect Tailwind line height classes', () => {
      const content = `
        <div className="leading-tight leading-normal leading-loose">
          Content
        </div>
      `;
      const results = detectTailwindTypography(content, 'Button.tsx');

      expect(results.length).toBe(3);
    });

    it('should detect Tailwind font family classes', () => {
      const content = `
        <div className="font-sans font-serif font-mono">
          Content
        </div>
      `;
      const results = detectTailwindTypography(content, 'Button.tsx');

      expect(results.length).toBe(3);
    });
  });
});

// ============================================================================
// Hardcoded Value Detection Tests
// ============================================================================

describe('Hardcoded Typography Detection', () => {
  describe('detectTailwindArbitraryTypography', () => {
    it('should detect Tailwind arbitrary font sizes', () => {
      const content = `
        <div className="text-[15px] text-[17px]">
          Content
        </div>
      `;
      const results = detectTailwindArbitraryTypography(content, 'Button.tsx');

      expect(results.length).toBe(2);
      expect(results[0]?.type).toBe('arbitrary-font-size');
    });

    it('should detect Tailwind arbitrary font weights', () => {
      const content = `
        <div className="font-[450]">
          Content
        </div>
      `;
      const results = detectTailwindArbitraryTypography(content, 'Button.tsx');

      expect(results.length).toBe(1);
      expect(results[0]?.type).toBe('arbitrary-font-weight');
    });

    it('should detect Tailwind arbitrary line heights', () => {
      const content = `
        <div className="leading-[1.3]">
          Content
        </div>
      `;
      const results = detectTailwindArbitraryTypography(content, 'Button.tsx');

      expect(results.length).toBe(1);
      expect(results[0]?.type).toBe('arbitrary-line-height');
    });
  });

  describe('detectArbitraryFontSizes', () => {
    it('should detect arbitrary px font sizes in CSS', () => {
      const content = `
        .heading {
          font-size: 15px;
        }
      `;
      const results = detectArbitraryFontSizes(content, 'styles.css');

      expect(results.length).toBe(1);
      expect(results[0]?.value).toBe('15px');
      expect(results[0]?.type).toBe('arbitrary-font-size');
    });

    it('should not flag standard scale font sizes', () => {
      const content = `
        .heading {
          font-size: 16px;
        }
      `;
      const results = detectArbitraryFontSizes(content, 'styles.css');

      expect(results.length).toBe(0);
    });

    it('should detect arbitrary rem font sizes', () => {
      const content = `
        .text {
          font-size: 1.1rem;
        }
      `;
      const results = detectArbitraryFontSizes(content, 'styles.css');

      expect(results.length).toBe(1);
      expect(results[0]?.value).toBe('1.1rem');
    });

    it('should skip CSS custom property definitions', () => {
      const content = `
        :root {
          --font-size-custom: 15px;
        }
      `;
      const results = detectArbitraryFontSizes(content, 'styles.css');

      expect(results.length).toBe(0);
    });
  });

  describe('detectArbitraryLineHeights', () => {
    it('should detect arbitrary line heights', () => {
      const content = `
        .text {
          line-height: 1.3;
        }
      `;
      const results = detectArbitraryLineHeights(content, 'styles.css');

      expect(results.length).toBe(1);
      expect(results[0]?.value).toBe('1.3');
      expect(results[0]?.type).toBe('arbitrary-line-height');
    });

    it('should not flag standard line heights', () => {
      const content = `
        .text {
          line-height: 1.5;
        }
      `;
      const results = detectArbitraryLineHeights(content, 'styles.css');

      expect(results.length).toBe(0);
    });
  });

  describe('detectArbitraryFontWeights', () => {
    it('should detect arbitrary font weights', () => {
      const content = `
        .bold {
          font-weight: 450;
        }
      `;
      const results = detectArbitraryFontWeights(content, 'styles.css');

      expect(results.length).toBe(1);
      expect(results[0]?.value).toBe('450');
      expect(results[0]?.type).toBe('arbitrary-font-weight');
    });

    it('should not flag standard font weights', () => {
      const content = `
        .bold {
          font-weight: 700;
        }
      `;
      const results = detectArbitraryFontWeights(content, 'styles.css');

      expect(results.length).toBe(0);
    });
  });

  describe('detectHardcodedFontFamilies', () => {
    it('should detect hardcoded font families', () => {
      const content = `
        .text {
          font-family: "Roboto";
        }
      `;
      const results = detectHardcodedFontFamilies(content, 'styles.css');

      expect(results.length).toBe(1);
      expect(results[0]?.type).toBe('hardcoded-font-family');
    });

    it('should not flag system font stacks', () => {
      const content = `
        .text {
          font-family: system-ui, sans-serif;
        }
      `;
      const results = detectHardcodedFontFamilies(content, 'styles.css');

      expect(results.length).toBe(0);
    });
  });
});

// ============================================================================
// Analysis Function Tests
// ============================================================================

describe('analyzeTypography', () => {
  it('should analyze file with typography patterns', () => {
    const content = `
      .heading {
        font-size: var(--font-size-lg);
        line-height: var(--line-height-normal);
      }
    `;
    const analysis = analyzeTypography(content, 'styles.css');

    expect(analysis.usesCSSTypographyProperties).toBe(true);
    expect(analysis.typographyPatterns.length).toBeGreaterThan(0);
    expect(analysis.typographyTokenConfidence).toBeGreaterThan(0);
  });

  it('should analyze file with hardcoded values', () => {
    const content = `
      .heading {
        font-size: 15px;
        line-height: 1.3;
      }
    `;
    const analysis = analyzeTypography(content, 'styles.css');

    expect(analysis.hardcodedValues.length).toBeGreaterThan(0);
    expect(analysis.typographyTokenConfidence).toBeLessThan(1);
  });

  it('should skip hardcoded detection for excluded files', () => {
    const content = `
      .heading {
        font-size: 15px;
      }
    `;
    const analysis = analyzeTypography(content, 'Button.test.tsx');

    expect(analysis.hardcodedValues.length).toBe(0);
  });

  it('should calculate confidence based on pattern ratio', () => {
    const content = `
      .heading {
        font-size: var(--font-size-lg);
        line-height: 1.3;
      }
    `;
    const analysis = analyzeTypography(content, 'styles.css');

    expect(analysis.typographyTokenConfidence).toBeGreaterThan(0);
    expect(analysis.typographyTokenConfidence).toBeLessThan(1);
  });
});

// ============================================================================
// Detector Class Tests
// ============================================================================

describe('TypographyDetector', () => {
  let detector: TypographyDetector;

  beforeEach(() => {
    detector = createTypographyDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('styling/typography');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe('styling');
    });

    it('should have correct subcategory', () => {
      expect(detector.subcategory).toBe('typography');
    });

    it('should support typescript, javascript, and css', () => {
      expect(detector.supportedLanguages).toContain('typescript');
      expect(detector.supportedLanguages).toContain('javascript');
      expect(detector.supportedLanguages).toContain('css');
    });

    it('should use regex detection method', () => {
      expect(detector.detectionMethod).toBe('regex');
    });
  });

  describe('detect', () => {
    it('should detect CSS typography property patterns', async () => {
      const content = `
        .heading {
          font-size: var(--font-size-lg);
          line-height: var(--line-height-normal);
        }
      `;
      const context = createMockContext('styles.css', content);
      const result = await detector.detect(context);

      expect(result.patterns.some(p => p.patternId.includes('css-property'))).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect theme typography patterns', async () => {
      const content = `
        const styles = {
          fontSize: theme.typography.lg,
          lineHeight: theme.lineHeights.normal,
        };
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      expect(result.patterns.some(p => p.patternId.includes('theme'))).toBe(true);
    });

    it('should detect Tailwind typography patterns', async () => {
      const content = `
        <div className="text-lg font-bold leading-normal">
          Content
        </div>
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      expect(result.patterns.some(p => p.patternId.includes('tailwind'))).toBe(true);
    });

    // NOTE: Drift is a pattern-learning tool, not a linter.
    // These tests verify that violations are NOT generated for arbitrary values.
    it('should not create violations for arbitrary font sizes (pattern learning mode)', async () => {
      const content = `
        .heading {
          font-size: 15px;
        }
      `;
      const context = createMockContext('styles.css', content);
      const result = await detector.detect(context);

      // Violations are intentionally not generated - drift learns patterns
      expect(result.violations.length).toBe(0);
    });

    it('should not create violations for arbitrary line heights (pattern learning mode)', async () => {
      const content = `
        .text {
          line-height: 1.3;
        }
      `;
      const context = createMockContext('styles.css', content);
      const result = await detector.detect(context);

      // Violations are intentionally not generated - drift learns patterns
      expect(result.violations.length).toBe(0);
    });

    it('should not create violations for arbitrary font weights (pattern learning mode)', async () => {
      const content = `
        .bold {
          font-weight: 450;
        }
      `;
      const context = createMockContext('styles.css', content);
      const result = await detector.detect(context);

      // Violations are intentionally not generated - drift learns patterns
      expect(result.violations.length).toBe(0);
    });

    it('should not create violations for standard typography values', async () => {
      const content = `
        .heading {
          font-size: 16px;
          line-height: 1.5;
          font-weight: 700;
        }
      `;
      const context = createMockContext('styles.css', content);
      const result = await detector.detect(context);

      expect(result.violations.length).toBe(0);
    });
  });

  describe('generateQuickFix', () => {
    it('should generate quick fix for arbitrary font size violation', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'styling/typography',
        severity: 'warning' as const,
        file: 'Button.tsx',
        range: { start: { line: 1, character: 9 }, end: { line: 1, character: 13 } },
        message: "Arbitrary font size '15px' doesn't follow the typography scale",
        expected: 'A typography token',
        actual: '15px',
        aiExplainAvailable: true,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const fix = detector.generateQuickFix(violation);

      expect(fix).not.toBeNull();
      expect(fix?.title).toContain('typography token');
      expect(fix?.kind).toBe('quickfix');
    });

    it('should generate quick fix for arbitrary line height violation', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'styling/typography',
        severity: 'warning' as const,
        file: 'Button.tsx',
        range: { start: { line: 1, character: 9 }, end: { line: 1, character: 12 } },
        message: "Arbitrary line height '1.3' doesn't follow the typography scale",
        expected: 'A typography token',
        actual: '1.3',
        aiExplainAvailable: true,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const fix = detector.generateQuickFix(violation);

      expect(fix).not.toBeNull();
      expect(fix?.title).toContain('typography token');
    });

    it('should return null for non-typography violations', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'styling/typography',
        severity: 'warning' as const,
        file: 'Button.tsx',
        range: { start: { line: 1, character: 1 }, end: { line: 1, character: 10 } },
        message: 'Some other violation message',
        expected: 'Something',
        actual: 'Something else',
        aiExplainAvailable: true,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const fix = detector.generateQuickFix(violation);

      expect(fix).toBeNull();
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('TypographyDetector Integration', () => {
  let detector: TypographyDetector;

  beforeEach(() => {
    detector = createTypographyDetector();
  });

  it('should handle styled-components with mixed patterns', async () => {
    const content = `
      import styled from 'styled-components';
      
      const Heading = styled.h1\`
        font-size: \${theme.typography.xl};
        line-height: 1.3;
        font-weight: var(--font-weight-bold);
      \`;
    `;
    const context = createMockContext('Heading.tsx', content);
    const result = await detector.detect(context);

    // Should detect theme typography pattern
    expect(result.patterns.some(p => p.patternId.includes('theme'))).toBe(true);

    // Should detect CSS typography property pattern
    expect(result.patterns.some(p => p.patternId.includes('css-property'))).toBe(true);

    // Should flag arbitrary line height
    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should handle Tailwind with arbitrary values', async () => {
    const content = `
      export const Heading = () => (
        <h1 
          className="text-lg font-bold text-[15px] leading-[1.3]"
        >
          Hello World
        </h1>
      );
    `;
    const context = createMockContext('Heading.tsx', content);
    const result = await detector.detect(context);

    // Should detect Tailwind typography pattern
    expect(result.patterns.some(p => p.patternId.includes('tailwind'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should handle CSS modules', async () => {
    const content = `
      .heading {
        font-size: var(--font-size-xl);
        line-height: 1.3;
        font-weight: var(--font-weight-bold);
      }
      
      .subheading {
        font-size: var(--font-size-lg);
      }
    `;
    const context = createMockContext('Heading.module.css', content);
    const result = await detector.detect(context);

    // Should detect CSS typography properties
    expect(result.patterns.some(p => p.patternId.includes('css-property'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations.length).toBe(0);
  });

  it('should handle inline styles in React', async () => {
    const content = `
      export const Heading = () => (
        <h1 
          style={{
            fontSize: '15px',
            lineHeight: 'var(--line-height-normal)',
          }}
        >
          Hello World
        </h1>
      );
    `;
    const context = createMockContext('Heading.tsx', content);
    const result = await detector.detect(context);

    // Should detect CSS typography property
    expect(result.patterns.some(p => p.patternId.includes('css-property'))).toBe(true);

    // Note: The '15px' in a string context may not be detected as a font-size
    // because it's not in a CSS property context. This is expected behavior.
    // The detector focuses on CSS/styled-components contexts.
  });

  it('should not generate violations (pattern learning mode)', async () => {
    const content = `
      .heading {
        font-size: 15px;
        line-height: 1.3;
        font-weight: 450;
      }
    `;
    const context = createMockContext('styles.css', content);
    const result = await detector.detect(context);

    // Drift is a pattern-learning tool, not a linter
    // Violations are intentionally not generated
    expect(result.violations.length).toBe(0);
  });

  it('should handle real-world component file', async () => {
    const content = `
      import React from 'react';
      import styled from 'styled-components';
      
      const Title = styled.h1\`
        font-size: \${theme.typography.xl};
        font-weight: \${theme.fontWeights.bold};
        line-height: \${theme.lineHeights.tight};
      \`;
      
      const Subtitle = styled.h2\`
        font-size: \${theme.typography.lg};
        font-weight: \${theme.fontWeights.medium};
      \`;
      
      export const Header = () => (
        <header className="text-lg font-bold">
          <Title>Welcome</Title>
          <Subtitle>Subtitle</Subtitle>
        </header>
      );
    `;
    const context = createMockContext('Header.tsx', content);
    const result = await detector.detect(context);

    // Should detect both theme and Tailwind patterns
    expect(result.patterns.length).toBeGreaterThan(0);
    
    // Should have reasonable confidence
    expect(result.confidence).toBeGreaterThan(0);
  });
});
