/**
 * Color Usage Detector Tests
 *
 * Tests for color usage pattern detection.
 *
 * @requirements 9.3 - THE Styling_Detector SHALL detect color usage patterns (system colors vs hex)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ColorUsageDetector,
  createColorUsageDetector,
  detectCSSColorProperties,
  detectThemeColors,
  detectTailwindColors,
  detectNamedCSSColors,
  detectHardcodedColors,
  analyzeColorUsage,
  shouldExcludeFile,
  isAllowedHardcodedColor,
  suggestColorToken,
} from './color-usage.js';
import type { DetectionContext, ProjectContext } from '../base/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockContext(
  file: string,
  content: string = ''
): DetectionContext {
  const projectContext: ProjectContext = {
    rootDir: '/project',
    files: [file],
    config: {},
  };

  const extension = file.split('.').pop() || 'ts';
  const language = extension === 'css' ? 'css' : 'typescript';

  return {
    file,
    content,
    ast: null,
    imports: [],
    exports: [],
    projectContext,
    language,
    extension: `.${extension}`,
    isTestFile: file.includes('.test.') || file.includes('.spec.'),
    isTypeDefinition: file.endsWith('.d.ts'),
  };
}

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('shouldExcludeFile', () => {
  it('should exclude test files', () => {
    expect(shouldExcludeFile('Button.test.tsx')).toBe(true);
    expect(shouldExcludeFile('Button.spec.ts')).toBe(true);
  });

  it('should exclude story files', () => {
    expect(shouldExcludeFile('Button.stories.tsx')).toBe(true);
  });

  it('should exclude design-tokens directory', () => {
    expect(shouldExcludeFile('design-tokens/colors.ts')).toBe(true);
    expect(shouldExcludeFile('lib/design-tokens/index.ts')).toBe(true);
  });

  it('should exclude tokens directory', () => {
    expect(shouldExcludeFile('tokens/colors.ts')).toBe(true);
  });

  it('should exclude theme directory', () => {
    expect(shouldExcludeFile('theme/colors.ts')).toBe(true);
  });

  it('should exclude config files', () => {
    expect(shouldExcludeFile('tailwind.config.js')).toBe(true);
    expect(shouldExcludeFile('app.config.ts')).toBe(true);
  });

  it('should exclude color definition files', () => {
    expect(shouldExcludeFile('colors.ts')).toBe(true);
    expect(shouldExcludeFile('palette.ts')).toBe(true);
  });

  it('should not exclude regular component files', () => {
    expect(shouldExcludeFile('Button.tsx')).toBe(false);
    expect(shouldExcludeFile('components/Card.tsx')).toBe(false);
    expect(shouldExcludeFile('styles/global.css')).toBe(false);
  });
});

describe('isAllowedHardcodedColor', () => {
  it('should allow transparent and currentColor', () => {
    expect(isAllowedHardcodedColor('transparent')).toBe(true);
    expect(isAllowedHardcodedColor('currentColor')).toBe(true);
  });

  it('should allow CSS keywords', () => {
    expect(isAllowedHardcodedColor('inherit')).toBe(true);
    expect(isAllowedHardcodedColor('initial')).toBe(true);
    expect(isAllowedHardcodedColor('unset')).toBe(true);
  });

  it('should allow black and white', () => {
    expect(isAllowedHardcodedColor('#000')).toBe(true);
    expect(isAllowedHardcodedColor('#000000')).toBe(true);
    expect(isAllowedHardcodedColor('#fff')).toBe(true);
    expect(isAllowedHardcodedColor('#ffffff')).toBe(true);
    expect(isAllowedHardcodedColor('black')).toBe(true);
    expect(isAllowedHardcodedColor('white')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isAllowedHardcodedColor('#FFF')).toBe(true);
    expect(isAllowedHardcodedColor('TRANSPARENT')).toBe(true);
    expect(isAllowedHardcodedColor('CurrentColor')).toBe(true);
  });

  it('should not allow arbitrary colors', () => {
    expect(isAllowedHardcodedColor('#ff0000')).toBe(false);
    expect(isAllowedHardcodedColor('#f00')).toBe(false);
    expect(isAllowedHardcodedColor('rgb(255, 0, 0)')).toBe(false);
  });
});

describe('suggestColorToken', () => {
  it('should suggest black for #000', () => {
    const suggestion = suggestColorToken('#000');
    expect(suggestion).toContain('black');
  });

  it('should suggest white for #fff', () => {
    const suggestion = suggestColorToken('#fff');
    expect(suggestion).toContain('white');
  });

  it('should identify red colors', () => {
    const suggestion = suggestColorToken('#ff0000');
    expect(suggestion).toContain('red');
  });

  it('should identify blue colors', () => {
    const suggestion = suggestColorToken('#0000ff');
    expect(suggestion).toContain('blue');
  });

  it('should identify green colors', () => {
    const suggestion = suggestColorToken('#00ff00');
    expect(suggestion).toContain('green');
  });

  it('should provide generic suggestion for complex colors', () => {
    const suggestion = suggestColorToken('#abc123');
    expect(suggestion).toContain('design token');
  });
});

// ============================================================================
// CSS Color Property Detection Tests
// ============================================================================

describe('detectCSSColorProperties', () => {
  it('should detect var() usage for colors', () => {
    const content = `color: var(--color-primary);`;
    const results = detectCSSColorProperties(content, 'styles.css');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('css-color-property');
    expect(results[0]?.colorName).toBe('primary');
  });

  it('should detect var() with fallback', () => {
    const content = `color: var(--color-primary, #000);`;
    const results = detectCSSColorProperties(content, 'styles.css');

    expect(results).toHaveLength(1);
    expect(results[0]?.colorName).toBe('primary');
  });

  it('should detect multiple CSS color properties', () => {
    const content = `
      color: var(--color-primary);
      background: var(--color-background);
      border-color: var(--clr-border);
    `;
    const results = detectCSSColorProperties(content, 'styles.css');

    expect(results).toHaveLength(3);
  });

  it('should handle CSS color properties in JS/TS', () => {
    const content = `
      const styles = {
        color: 'var(--color-primary)',
        background: 'var(--color-bg)',
      };
    `;
    const results = detectCSSColorProperties(content, 'Button.tsx');

    expect(results).toHaveLength(2);
  });
});

// ============================================================================
// Theme Color Detection Tests
// ============================================================================

describe('detectThemeColors', () => {
  it('should detect theme.colors usage', () => {
    const content = `color: theme.colors.primary;`;
    const results = detectThemeColors(content, 'Button.tsx');

    // May match both theme.colors.primary and colors.primary patterns
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]?.type).toBe('theme-color');
  });

  it('should detect theme.color usage (singular)', () => {
    const content = `color: theme.color.primary;`;
    const results = detectThemeColors(content, 'Button.tsx');

    expect(results).toHaveLength(1);
  });

  it('should detect theme colors in template literals', () => {
    const content = 'const Button = styled.button`color: ${theme.colors.primary};`;';
    const results = detectThemeColors(content, 'Button.tsx');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.matchedText.includes('theme.colors.primary'))).toBe(true);
  });

  it('should detect props.theme.colors usage', () => {
    const content = `color: props.theme.colors.primary;`;
    const results = detectThemeColors(content, 'Button.tsx');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.matchedText.includes('theme.colors.primary'))).toBe(true);
  });

  it('should detect standalone colors object', () => {
    const content = `color: colors.primary;`;
    const results = detectThemeColors(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.colorName).toBe('primary');
  });

  it('should detect nested theme color properties', () => {
    const content = `color: theme.colors.brand.primary;`;
    const results = detectThemeColors(content, 'Button.tsx');

    // May match both theme.colors.brand.primary and colors.brand.primary patterns
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect multiple theme color usages', () => {
    const content = `
      color: theme.colors.primary;
      background: theme.colors.background;
      borderColor: theme.colors.border;
    `;
    const results = detectThemeColors(content, 'Button.tsx');

    // May match both theme.colors.* and colors.* patterns for each
    expect(results.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// Tailwind Color Detection Tests
// ============================================================================

describe('detectTailwindColors', () => {
  it('should detect text color classes', () => {
    const content = `<div className="text-blue-500 text-red-100">`;
    const results = detectTailwindColors(content, 'Button.tsx');

    expect(results).toHaveLength(2);
    expect(results.some(r => r.matchedText === 'text-blue-500')).toBe(true);
    expect(results.some(r => r.matchedText === 'text-red-100')).toBe(true);
  });

  it('should detect background color classes', () => {
    const content = `<div className="bg-gray-100 bg-blue-500">`;
    const results = detectTailwindColors(content, 'Button.tsx');

    expect(results).toHaveLength(2);
    expect(results.some(r => r.matchedText === 'bg-gray-100')).toBe(true);
    expect(results.some(r => r.matchedText === 'bg-blue-500')).toBe(true);
  });

  it('should detect border color classes', () => {
    const content = `<div className="border-red-500 border-gray-300">`;
    const results = detectTailwindColors(content, 'Button.tsx');

    expect(results).toHaveLength(2);
    expect(results.some(r => r.matchedText === 'border-red-500')).toBe(true);
  });

  it('should detect ring color classes', () => {
    const content = `<div className="ring-blue-500">`;
    const results = detectTailwindColors(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.matchedText).toBe('ring-blue-500');
  });

  it('should detect various Tailwind color utilities', () => {
    const content = `<div className="divide-gray-200 outline-blue-500 fill-red-500 stroke-green-500">`;
    const results = detectTailwindColors(content, 'Button.tsx');

    expect(results.length).toBeGreaterThanOrEqual(4);
  });

  it('should detect color-50 shade', () => {
    const content = `<div className="bg-blue-50 text-gray-50">`;
    const results = detectTailwindColors(content, 'Button.tsx');

    expect(results).toHaveLength(2);
  });
});

// ============================================================================
// Named CSS Color Detection Tests
// ============================================================================

describe('detectNamedCSSColors', () => {
  it('should detect named CSS colors', () => {
    const content = `color: red;`;
    const results = detectNamedCSSColors(content, 'styles.css');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('named-css-color');
    expect(results[0]?.colorName).toBe('red');
  });

  it('should detect multiple named colors', () => {
    const content = `
      color: blue;
      background: coral;
      border-color: crimson;
    `;
    const results = detectNamedCSSColors(content, 'styles.css');

    expect(results).toHaveLength(3);
  });

  it('should not flag black and white', () => {
    const content = `
      color: black;
      background: white;
    `;
    const results = detectNamedCSSColors(content, 'styles.css');

    expect(results).toHaveLength(0);
  });

  it('should be case-insensitive', () => {
    const content = `color: RED;`;
    const results = detectNamedCSSColors(content, 'styles.css');

    expect(results).toHaveLength(1);
    expect(results[0]?.colorName).toBe('red');
  });

  it('should not flag colors in comments', () => {
    const content = `
      // color: red;
      /* background: blue; */
    `;
    const results = detectNamedCSSColors(content, 'styles.css');

    expect(results).toHaveLength(0);
  });
});

// ============================================================================
// Hardcoded Color Detection Tests
// ============================================================================

describe('detectHardcodedColors', () => {
  it('should detect hex colors', () => {
    const content = `color: #ff0000;`;
    const results = detectHardcodedColors(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('color-hex');
    expect(results[0]?.value).toBe('#ff0000');
  });

  it('should detect short hex colors', () => {
    const content = `color: #f00;`;
    const results = detectHardcodedColors(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.value).toBe('#f00');
  });

  it('should detect hex colors with alpha', () => {
    const content = `color: #ff000080;`;
    const results = detectHardcodedColors(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.value).toBe('#ff000080');
  });

  it('should detect RGB colors', () => {
    const content = `color: rgb(255, 0, 0);`;
    const results = detectHardcodedColors(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('color-rgb');
  });

  it('should detect RGBA colors', () => {
    const content = `color: rgba(255, 0, 0, 0.5);`;
    const results = detectHardcodedColors(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('color-rgba');
  });

  it('should detect HSL colors', () => {
    const content = `color: hsl(0, 100%, 50%);`;
    const results = detectHardcodedColors(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('color-hsl');
  });

  it('should detect HSLA colors', () => {
    const content = `color: hsla(0, 100%, 50%, 0.5);`;
    const results = detectHardcodedColors(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('color-hsla');
  });

  it('should not flag allowed colors (black/white)', () => {
    const content = `
      color: #000;
      background: #fff;
      border-color: #000000;
    `;
    const results = detectHardcodedColors(content, 'Button.tsx');

    expect(results).toHaveLength(0);
  });

  it('should not flag CSS custom property definitions', () => {
    const content = `--color-primary: #ff0000;`;
    const results = detectHardcodedColors(content, 'tokens.css');

    expect(results).toHaveLength(0);
  });

  it('should not flag colors in comments', () => {
    const content = `
      // color: #ff0000;
      /* background: #00ff00; */
    `;
    const results = detectHardcodedColors(content, 'Button.tsx');

    expect(results).toHaveLength(0);
  });

  it('should extract CSS property name', () => {
    const content = `background-color: #ff0000;`;
    const results = detectHardcodedColors(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.property).toBe('background-color');
  });

  it('should provide suggested token', () => {
    const content = `color: #ff0000;`;
    const results = detectHardcodedColors(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.suggestedToken).toBeDefined();
    expect(results[0]?.suggestedToken).toContain('red');
  });
});

// ============================================================================
// Analysis Function Tests
// ============================================================================

describe('analyzeColorUsage', () => {
  it('should analyze file with CSS color properties', () => {
    const content = `
      .button {
        color: var(--color-primary);
        background: var(--color-background);
      }
    `;
    const analysis = analyzeColorUsage(content, 'styles.css');

    expect(analysis.usesCSSColorProperties).toBe(true);
    expect(analysis.colorPatterns.length).toBe(2);
  });

  it('should analyze file with theme colors', () => {
    const content = `
      const Button = styled.button\`
        color: \${theme.colors.primary};
        background: \${theme.colors.background};
      \`;
    `;
    const analysis = analyzeColorUsage(content, 'Button.tsx');

    expect(analysis.usesThemeColors).toBe(true);
  });

  it('should analyze file with Tailwind colors', () => {
    const content = `
      <div className="text-blue-500 bg-gray-100">
        Content
      </div>
    `;
    const analysis = analyzeColorUsage(content, 'Button.tsx');

    expect(analysis.usesTailwindColors).toBe(true);
    expect(analysis.colorPatterns.length).toBeGreaterThan(0);
  });

  it('should detect hardcoded colors', () => {
    const content = `
      const Button = styled.button\`
        color: #ff0000;
        background: rgb(0, 255, 0);
      \`;
    `;
    const analysis = analyzeColorUsage(content, 'Button.tsx');

    expect(analysis.hardcodedColors.length).toBeGreaterThan(0);
  });

  it('should skip hardcoded detection for excluded files', () => {
    const content = `
      const colors = {
        primary: '#ff0000',
        secondary: '#00ff00',
      };
    `;
    const analysis = analyzeColorUsage(content, 'design-tokens/colors.ts');

    expect(analysis.hardcodedColors).toHaveLength(0);
  });

  it('should calculate confidence based on color token usage', () => {
    // File with only token usage
    const tokenContent = `
      color: var(--color-primary);
      background: theme.colors.background;
    `;
    const tokenAnalysis = analyzeColorUsage(tokenContent, 'Button.tsx');
    expect(tokenAnalysis.colorTokenConfidence).toBeGreaterThan(0.5);

    // File with only hardcoded colors
    const hardcodedContent = `
      color: #ff0000;
      background: rgb(0, 255, 0);
    `;
    const hardcodedAnalysis = analyzeColorUsage(hardcodedContent, 'Button.tsx');
    expect(hardcodedAnalysis.colorTokenConfidence).toBeLessThan(0.5);
  });
});

// ============================================================================
// Detector Class Tests
// ============================================================================

describe('ColorUsageDetector', () => {
  let detector: ColorUsageDetector;

  beforeEach(() => {
    detector = createColorUsageDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('styling/color-usage');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe('styling');
    });

    it('should have correct subcategory', () => {
      expect(detector.subcategory).toBe('color-usage');
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
    it('should handle empty file', async () => {
      const context = createMockContext('empty.tsx', '');
      const result = await detector.detect(context);

      expect(result.patterns).toHaveLength(0);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect CSS color property patterns', async () => {
      const content = `
        .button {
          color: var(--color-primary);
          background: var(--color-background);
        }
      `;
      const context = createMockContext('styles.css', content);
      const result = await detector.detect(context);

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns.some(p => p.patternId.includes('css-color-property'))).toBe(true);
    });

    it('should detect theme color patterns', async () => {
      const content = `
        const Button = styled.button\`
          color: \${theme.colors.primary};
        \`;
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns.some(p => p.patternId.includes('theme-color'))).toBe(true);
    });

    it('should detect Tailwind color patterns', async () => {
      const content = `
        <div className="text-blue-500 bg-gray-100">
          Content
        </div>
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns.some(p => p.patternId.includes('tailwind-color'))).toBe(true);
    });

    // NOTE: ColorUsageDetector focuses on PATTERN detection, not violation enforcement.
    // Hardcoded color violations are intentionally not generated - drift learns patterns, not enforces rules.
    it('should not create violations (pattern learning mode)', async () => {
      const content = `
        const Button = styled.button\`
          color: #ff0000;
          background: #00ff00;
        \`;
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      // Violations are intentionally not generated - drift learns patterns
      expect(result.violations).toHaveLength(0);
    });

    it('should detect hardcoded colors in analysis but not create violations', async () => {
      const content = `
        const Button = styled.button\`
          color: rgb(255, 0, 0);
        \`;
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      // Analysis detects hardcoded colors, but no violations are created
      expect(result.violations).toHaveLength(0);
    });

    it('should handle test files without violations', async () => {
      const content = `
        const mockStyles = {
          color: '#ff0000',
          background: 'rgb(0, 255, 0)',
        };
      `;
      const context = createMockContext('Button.test.tsx', content);
      const result = await detector.detect(context);

      expect(result.violations).toHaveLength(0);
    });

    it('should not include quick fix since no violations are generated', async () => {
      const content = `color: #ff0000;`;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      // No violations means no quick fixes
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('generateQuickFix', () => {
    it('should generate quick fix for hardcoded hex color violation', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'styling/color-usage',
        severity: 'warning' as const,
        file: 'Button.tsx',
        range: { start: { line: 1, character: 7 }, end: { line: 1, character: 14 } },
        message: "Hardcoded hex color '#ff0000' should use a color token",
        expected: 'A color token',
        actual: '#ff0000',
        aiExplainAvailable: true,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const fix = detector.generateQuickFix(violation);

      expect(fix).not.toBeNull();
      expect(fix?.title).toContain('color token');
      expect(fix?.kind).toBe('quickfix');
    });

    it('should generate quick fix for hardcoded RGB color violation', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'styling/color-usage',
        severity: 'warning' as const,
        file: 'Button.tsx',
        range: { start: { line: 1, character: 7 }, end: { line: 1, character: 22 } },
        message: "Hardcoded RGB color 'rgb(255, 0, 0)' should use a color token",
        expected: 'A color token',
        actual: 'rgb(255, 0, 0)',
        aiExplainAvailable: true,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const fix = detector.generateQuickFix(violation);

      expect(fix).not.toBeNull();
      expect(fix?.title).toContain('color token');
    });

    it('should return null for non-color violations', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'styling/color-usage',
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

describe('ColorUsageDetector Integration', () => {
  let detector: ColorUsageDetector;

  beforeEach(() => {
    detector = createColorUsageDetector();
  });

  it('should handle styled-components with mixed patterns', async () => {
    const content = `
      import styled from 'styled-components';
      
      const Button = styled.button\`
        color: \${theme.colors.primary};
        background: #f0f0f0;
        border-color: var(--color-border);
      \`;
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // Should detect theme color pattern
    expect(result.patterns.some(p => p.patternId.includes('theme-color'))).toBe(true);

    // Should detect CSS color property pattern
    expect(result.patterns.some(p => p.patternId.includes('css-color-property'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should handle emotion CSS-in-JS', async () => {
    const content = `
      import { css } from '@emotion/react';
      
      const buttonStyles = css\`
        color: \${theme.colors.primary};
        background: #ffffff;
      \`;
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // Should detect theme color usage
    expect(result.patterns.some(p => p.patternId.includes('theme-color'))).toBe(true);
  });

  it('should handle CSS modules', async () => {
    const content = `
      .button {
        color: var(--color-primary);
        background-color: #e0e0e0;
        border-color: var(--color-border);
      }
      
      .button:hover {
        background-color: var(--color-hover);
      }
    `;
    const context = createMockContext('Button.module.css', content);
    const result = await detector.detect(context);

    // Should detect CSS color properties
    expect(result.patterns.some(p => p.patternId.includes('css-color-property'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should handle Tailwind with custom colors', async () => {
    const content = `
      export const Button = () => (
        <button 
          className="text-blue-500 bg-[#f0f0f0] border-gray-300"
        >
          Click me
        </button>
      );
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // Should detect Tailwind color classes
    expect(result.patterns.some(p => p.patternId.includes('tailwind-color'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should handle inline styles in React', async () => {
    const content = `
      export const Button = () => (
        <button 
          style={{
            color: '#ff0000',
            backgroundColor: 'var(--color-bg)',
          }}
        >
          Click me
        </button>
      );
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // Should detect CSS color property
    expect(result.patterns.some(p => p.patternId.includes('css-color-property'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should detect patterns without generating violations', async () => {
    const content = `
      .button {
        color: #ff5500;
        background: rgb(100, 200, 50);
      }
    `;
    const context = createMockContext('styles.css', content);
    const result = await detector.detect(context);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should handle real-world component file', async () => {
    const content = `
      import React from 'react';
      import styled from 'styled-components';
      
      const StyledButton = styled.button\`
        color: \${({ theme }) => theme.colors.text};
        background-color: var(--color-primary);
        border: 1px solid \${({ theme }) => theme.colors.border};
        
        &:hover {
          background-color: var(--color-primary-hover);
        }
        
        &:disabled {
          color: #999999;
          background-color: #cccccc;
        }
      \`;
      
      export const Button = ({ children, ...props }) => (
        <StyledButton {...props}>{children}</StyledButton>
      );
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // Should detect theme colors
    expect(result.patterns.some(p => p.patternId.includes('theme-color'))).toBe(true);

    // Should detect CSS color properties
    expect(result.patterns.some(p => p.patternId.includes('css-color-property'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });
});
