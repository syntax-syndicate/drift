/**
 * Design Tokens Detector Tests
 *
 * Tests for design token usage pattern detection.
 *
 * @requirements 9.1 - THE Styling_Detector SHALL detect design token usage vs hardcoded values
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DesignTokensDetector,
  createDesignTokensDetector,
  detectTokenImports,
  detectCSSCustomProperties,
  detectThemeObjectUsage,
  detectHardcodedColors,
  detectHardcodedSpacing,
  analyzeDesignTokens,
  shouldExcludeFile,
  isAllowedHardcodedValue,
} from './design-tokens.js';
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
    expect(shouldExcludeFile('tokens/spacing.ts')).toBe(true);
  });

  it('should exclude theme directory', () => {
    expect(shouldExcludeFile('theme/colors.ts')).toBe(true);
  });

  it('should exclude config files', () => {
    expect(shouldExcludeFile('tailwind.config.js')).toBe(true);
    expect(shouldExcludeFile('app.config.ts')).toBe(true);
  });

  it('should not exclude regular component files', () => {
    expect(shouldExcludeFile('Button.tsx')).toBe(false);
    expect(shouldExcludeFile('components/Card.tsx')).toBe(false);
    expect(shouldExcludeFile('styles/global.css')).toBe(false);
  });
});

describe('isAllowedHardcodedValue', () => {
  it('should allow common values', () => {
    expect(isAllowedHardcodedValue('0')).toBe(true);
    expect(isAllowedHardcodedValue('0px')).toBe(true);
    expect(isAllowedHardcodedValue('1px')).toBe(true);
    expect(isAllowedHardcodedValue('100%')).toBe(true);
  });

  it('should allow CSS keywords', () => {
    expect(isAllowedHardcodedValue('inherit')).toBe(true);
    expect(isAllowedHardcodedValue('initial')).toBe(true);
    expect(isAllowedHardcodedValue('unset')).toBe(true);
    expect(isAllowedHardcodedValue('auto')).toBe(true);
    expect(isAllowedHardcodedValue('none')).toBe(true);
  });

  it('should allow transparent and currentColor', () => {
    expect(isAllowedHardcodedValue('transparent')).toBe(true);
    expect(isAllowedHardcodedValue('currentColor')).toBe(true);
  });

  it('should allow black and white', () => {
    expect(isAllowedHardcodedValue('#000')).toBe(true);
    expect(isAllowedHardcodedValue('#000000')).toBe(true);
    expect(isAllowedHardcodedValue('#fff')).toBe(true);
    expect(isAllowedHardcodedValue('#ffffff')).toBe(true);
    expect(isAllowedHardcodedValue('black')).toBe(true);
    expect(isAllowedHardcodedValue('white')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isAllowedHardcodedValue('#FFF')).toBe(true);
    expect(isAllowedHardcodedValue('TRANSPARENT')).toBe(true);
  });

  it('should not allow arbitrary values', () => {
    expect(isAllowedHardcodedValue('#ff0000')).toBe(false);
    expect(isAllowedHardcodedValue('16px')).toBe(false);
    expect(isAllowedHardcodedValue('2rem')).toBe(false);
  });
});


// ============================================================================
// Token Import Detection Tests
// ============================================================================

describe('detectTokenImports', () => {
  it('should detect imports from design-tokens directory', () => {
    const content = `import { colors, spacing } from '@/design-tokens';`;
    const results = detectTokenImports(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('design-tokens-import');
    expect(results[0]?.tokenName).toBe('@/design-tokens');
  });

  it('should detect imports from design-tokens subdirectory', () => {
    const content = `import { primary } from '../design-tokens/colors';`;
    const results = detectTokenImports(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.tokenName).toBe('../design-tokens/colors');
  });

  it('should detect imports from tokens directory', () => {
    const content = `import * as tokens from './tokens';`;
    const results = detectTokenImports(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('design-tokens-import');
  });

  it('should detect imports from theme directory', () => {
    const content = `import theme from '@/theme';`;
    const results = detectTokenImports(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('design-tokens-import');
  });

  it('should detect multiple token imports', () => {
    const content = `
      import { colors } from '@/design-tokens';
      import { spacing } from '@/tokens';
    `;
    const results = detectTokenImports(content, 'Button.tsx');

    expect(results).toHaveLength(2);
  });

  it('should not detect regular imports', () => {
    const content = `import React from 'react';`;
    const results = detectTokenImports(content, 'Button.tsx');

    expect(results).toHaveLength(0);
  });
});

// ============================================================================
// CSS Custom Property Detection Tests
// ============================================================================

describe('detectCSSCustomProperties', () => {
  it('should detect var() usage', () => {
    const content = `color: var(--color-primary);`;
    const results = detectCSSCustomProperties(content, 'styles.css');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('css-custom-property');
    expect(results[0]?.tokenName).toBe('color-primary');
  });

  it('should detect var() with fallback', () => {
    const content = `color: var(--color-primary, #000);`;
    const results = detectCSSCustomProperties(content, 'styles.css');

    expect(results).toHaveLength(1);
    expect(results[0]?.tokenName).toBe('color-primary');
  });

  it('should detect multiple CSS custom properties', () => {
    const content = `
      color: var(--color-primary);
      background: var(--color-background);
      padding: var(--spacing-md);
    `;
    const results = detectCSSCustomProperties(content, 'styles.css');

    expect(results).toHaveLength(3);
  });

  it('should handle CSS custom properties in JS/TS', () => {
    const content = `
      const styles = {
        color: 'var(--color-primary)',
        background: 'var(--color-bg)',
      };
    `;
    const results = detectCSSCustomProperties(content, 'Button.tsx');

    expect(results).toHaveLength(2);
  });
});


// ============================================================================
// Theme Object Detection Tests
// ============================================================================

describe('detectThemeObjectUsage', () => {
  it('should detect theme.colors usage', () => {
    const content = `color: theme.colors.primary;`;
    const results = detectThemeObjectUsage(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('theme-object');
  });

  it('should detect theme.spacing usage', () => {
    const content = `padding: theme.spacing.md;`;
    const results = detectThemeObjectUsage(content, 'Button.tsx');

    expect(results).toHaveLength(1);
  });

  it('should detect theme object in template literals', () => {
    const content = 'const Button = styled.button`color: ${theme.colors.primary};`;';
    const results = detectThemeObjectUsage(content, 'Button.tsx');

    // Both the template literal pattern and regular pattern may match
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.matchedText.includes('theme.colors.primary'))).toBe(true);
  });

  it('should detect props.theme usage', () => {
    const content = `color: props.theme.colors.primary;`;
    const results = detectThemeObjectUsage(content, 'Button.tsx');

    // Both the props.theme pattern and regular theme pattern may match
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.matchedText.includes('theme.colors.primary'))).toBe(true);
  });

  it('should detect nested theme properties', () => {
    const content = `color: theme.colors.brand.primary;`;
    const results = detectThemeObjectUsage(content, 'Button.tsx');

    expect(results).toHaveLength(1);
  });

  it('should detect multiple theme usages', () => {
    const content = `
      color: theme.colors.primary;
      padding: theme.spacing.md;
      fontSize: theme.fontSizes.lg;
    `;
    const results = detectThemeObjectUsage(content, 'Button.tsx');

    expect(results).toHaveLength(3);
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
});


// ============================================================================
// Hardcoded Spacing Detection Tests
// ============================================================================

describe('detectHardcodedSpacing', () => {
  // NOTE: detectHardcodedSpacing only flags values NOT on standard spacing scales
  // Values like 16px, 24px, 1rem are considered acceptable (on standard scales)
  
  it('should detect arbitrary pixel values not on standard scale', () => {
    const content = `padding: 13px;`; // 13 is NOT on the 4px/8px scale
    const results = detectHardcodedSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('spacing-px');
    expect(results[0]?.value).toBe('13px');
  });

  it('should detect arbitrary rem values not on standard scale', () => {
    const content = `margin: 1.3rem;`; // 1.3 is NOT on the standard rem scale
    const results = detectHardcodedSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('spacing-rem');
  });

  it('should detect arbitrary em values not on standard scale', () => {
    const content = `padding: 1.7em;`; // 1.7 is NOT on the standard scale
    const results = detectHardcodedSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('spacing-em');
  });

  it('should not flag 0px or 1px', () => {
    const content = `
      border: 1px solid black;
      margin: 0px;
    `;
    const results = detectHardcodedSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(0);
  });

  it('should not flag CSS custom property definitions', () => {
    const content = `--spacing-md: 16px;`;
    const results = detectHardcodedSpacing(content, 'tokens.css');

    expect(results).toHaveLength(0);
  });

  it('should not flag media query breakpoints', () => {
    const content = `@media (min-width: 768px) { }`;
    const results = detectHardcodedSpacing(content, 'styles.css');

    expect(results).toHaveLength(0);
  });

  it('should not flag values on standard spacing scales', () => {
    // These are all on standard scales and should NOT be flagged
    const content = `
      padding: 16px 24px;
      margin: 8px;
    `;
    const results = detectHardcodedSpacing(content, 'Button.tsx');

    // All values are on standard scales, so no results
    expect(results).toHaveLength(0);
  });

  it('should provide suggested token for arbitrary values', () => {
    const content = `padding: 13px;`; // 13 is NOT on standard scale
    const results = detectHardcodedSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.suggestedToken).toBeDefined();
    expect(results[0]?.suggestedToken).toContain('spacing');
  });
});

// ============================================================================
// Analysis Function Tests
// ============================================================================

describe('analyzeDesignTokens', () => {
  it('should analyze file with token imports', () => {
    const content = `
      import { colors } from '@/design-tokens';
      
      const Button = styled.button\`
        color: \${colors.primary};
      \`;
    `;
    const analysis = analyzeDesignTokens(content, 'Button.tsx');

    expect(analysis.hasDesignTokenImport).toBe(true);
    expect(analysis.tokenUsages.length).toBeGreaterThan(0);
  });

  it('should analyze file with CSS custom properties', () => {
    const content = `
      .button {
        color: var(--color-primary);
        padding: var(--spacing-md);
      }
    `;
    const analysis = analyzeDesignTokens(content, 'styles.css');

    expect(analysis.usesCSSCustomProperties).toBe(true);
    expect(analysis.tokenUsages.length).toBe(2);
  });

  it('should analyze file with theme object', () => {
    const content = `
      const Button = styled.button\`
        color: \${theme.colors.primary};
        padding: \${theme.spacing.md};
      \`;
    `;
    const analysis = analyzeDesignTokens(content, 'Button.tsx');

    expect(analysis.usesThemeObject).toBe(true);
  });

  // NOTE: Hardcoded value detection is DISABLED in analyzeDesignTokens
  // The function focuses on pattern learning, not enforcement
  it('should not detect hardcoded values (pattern learning mode)', () => {
    const content = `
      const Button = styled.button\`
        color: #ff0000;
        padding: 16px;
      \`;
    `;
    const analysis = analyzeDesignTokens(content, 'Button.tsx');

    // Hardcoded detection is disabled - drift learns patterns, not enforces rules
    expect(analysis.hardcodedValues).toHaveLength(0);
  });

  it('should skip hardcoded detection for excluded files', () => {
    const content = `
      const colors = {
        primary: '#ff0000',
        secondary: '#00ff00',
      };
    `;
    const analysis = analyzeDesignTokens(content, 'design-tokens/colors.ts');

    expect(analysis.hardcodedValues).toHaveLength(0);
  });

  it('should calculate confidence based on token usage', () => {
    // File with only token usage
    const tokenContent = `
      import { colors } from '@/design-tokens';
      color: var(--color-primary);
    `;
    const tokenAnalysis = analyzeDesignTokens(tokenContent, 'Button.tsx');
    expect(tokenAnalysis.tokenUsageConfidence).toBeGreaterThan(0.5);

    // File with no token usage - confidence is 0.5 (neutral) since hardcoded detection is disabled
    const noTokenContent = `
      color: #ff0000;
      padding: 16px;
    `;
    const noTokenAnalysis = analyzeDesignTokens(noTokenContent, 'Button.tsx');
    // With hardcoded detection disabled, confidence is 0.5 (no styling detected)
    expect(noTokenAnalysis.tokenUsageConfidence).toBe(0.5);
  });
});


// ============================================================================
// Detector Class Tests
// ============================================================================

describe('DesignTokensDetector', () => {
  let detector: DesignTokensDetector;

  beforeEach(() => {
    detector = createDesignTokensDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('styling/design-tokens');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe('styling');
    });

    it('should have correct subcategory', () => {
      expect(detector.subcategory).toBe('design-tokens');
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

    it('should detect token import patterns', async () => {
      const content = `
        import { colors, spacing } from '@/design-tokens';
        
        export const Button = () => <button>Click</button>;
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns.some(p => p.patternId.includes('import'))).toBe(true);
    });

    it('should detect CSS custom property patterns', async () => {
      const content = `
        .button {
          color: var(--color-primary);
          background: var(--color-background);
        }
      `;
      const context = createMockContext('styles.css', content);
      const result = await detector.detect(context);

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns.some(p => p.patternId.includes('css-custom-property'))).toBe(true);
    });

    it('should detect theme object patterns', async () => {
      const content = `
        const Button = styled.button\`
          color: \${theme.colors.primary};
        \`;
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns.some(p => p.patternId.includes('theme-object'))).toBe(true);
    });

    // NOTE: DesignTokensDetector focuses on PATTERN detection, not violation enforcement.
    // Hardcoded value violations are intentionally not generated - drift learns patterns, not enforces rules.
    it('should not create violations for hardcoded colors (pattern learning mode)', async () => {
      const content = `
        const Button = styled.button\`
          color: #ff0000;
          background: rgb(0, 255, 0);
        \`;
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      // Violations are intentionally not generated - drift learns patterns
      expect(result.violations).toHaveLength(0);
    });

    it('should not create violations for hardcoded spacing (pattern learning mode)', async () => {
      const content = `
        const Button = styled.button\`
          padding: 16px;
          margin: 2rem;
        \`;
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      // Violations are intentionally not generated - drift learns patterns
      expect(result.violations).toHaveLength(0);
    });

    it('should not create violations for test files', async () => {
      const content = `
        const mockStyles = {
          color: '#ff0000',
          padding: '16px',
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
    it('should generate quick fix for hardcoded color violation', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'styling/design-tokens',
        severity: 'warning' as const,
        file: 'Button.tsx',
        range: { start: { line: 1, character: 7 }, end: { line: 1, character: 14 } },
        message: "Hardcoded hex color '#ff0000' should use a design token",
        expected: 'A design token',
        actual: '#ff0000',
        aiExplainAvailable: true,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const fix = detector.generateQuickFix(violation);

      expect(fix).not.toBeNull();
      expect(fix?.title).toContain('design token');
      expect(fix?.kind).toBe('quickfix');
    });

    it('should generate quick fix for hardcoded spacing violation', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'styling/design-tokens',
        severity: 'warning' as const,
        file: 'Button.tsx',
        range: { start: { line: 1, character: 9 }, end: { line: 1, character: 13 } },
        message: "Hardcoded pixel spacing value '16px' should use a design token",
        expected: 'A design token',
        actual: '16px',
        aiExplainAvailable: true,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const fix = detector.generateQuickFix(violation);

      expect(fix).not.toBeNull();
      expect(fix?.title).toContain('design token');
    });

    it('should return null for non-hardcoded violations', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'styling/design-tokens',
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

describe('DesignTokensDetector Integration', () => {
  let detector: DesignTokensDetector;

  beforeEach(() => {
    detector = createDesignTokensDetector();
  });

  it('should handle styled-components with mixed patterns', async () => {
    const content = `
      import styled from 'styled-components';
      import { colors } from '@/design-tokens';
      
      const Button = styled.button\`
        color: \${colors.primary};
        background: #f0f0f0;
        padding: 16px 24px;
        border-radius: var(--radius-md);
      \`;
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // Should detect token import pattern
    expect(result.patterns.some(p => p.patternId.includes('import'))).toBe(true);

    // Should detect CSS custom property pattern
    expect(result.patterns.some(p => p.patternId.includes('css-custom-property'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should handle emotion CSS-in-JS', async () => {
    const content = `
      import { css } from '@emotion/react';
      
      const buttonStyles = css\`
        color: \${theme.colors.primary};
        padding: \${theme.spacing.md};
        background: #ffffff;
      \`;
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // Should detect theme object usage
    expect(result.patterns.some(p => p.patternId.includes('theme-object'))).toBe(true);
  });

  it('should handle CSS modules', async () => {
    const content = `
      .button {
        color: var(--color-primary);
        background-color: #e0e0e0;
        padding: 12px 20px;
        border-radius: var(--radius-sm);
      }
      
      .button:hover {
        background-color: var(--color-hover);
      }
    `;
    const context = createMockContext('Button.module.css', content);
    const result = await detector.detect(context);

    // Should detect CSS custom properties
    expect(result.patterns.some(p => p.patternId.includes('css-custom-property'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should handle Tailwind with custom values', async () => {
    const content = `
      export const Button = () => (
        <button 
          className="text-primary bg-[#f0f0f0] p-[16px] rounded-md"
        >
          Click me
        </button>
      );
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should handle inline styles in React', async () => {
    const content = `
      export const Button = () => (
        <button 
          style={{
            color: '#ff0000',
            padding: '16px',
            backgroundColor: 'var(--color-bg)',
          }}
        >
          Click me
        </button>
      );
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // Should detect CSS custom property
    expect(result.patterns.some(p => p.patternId.includes('css-custom-property'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should detect patterns without generating violations', async () => {
    const content = `
      .button {
        color: #ff5500;
        padding: 24px;
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
      import { colors, spacing } from '@/design-tokens';
      
      interface ButtonProps {
        variant?: 'primary' | 'secondary';
        size?: 'sm' | 'md' | 'lg';
        children: React.ReactNode;
      }
      
      const StyledButton = styled.button<{ $variant: string; $size: string }>\`
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        cursor: pointer;
        font-family: inherit;
        
        /* Using design tokens */
        color: \${({ $variant }) => $variant === 'primary' ? colors.white : colors.primary};
        background-color: \${({ $variant }) => $variant === 'primary' ? colors.primary : 'transparent'};
        
        /* Hardcoded values that should use tokens */
        border-radius: 4px;
        font-size: 14px;
        
        /* Using CSS custom properties */
        padding: var(--spacing-sm) var(--spacing-md);
        
        &:hover {
          opacity: 0.9;
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      \`;
      
      export const Button: React.FC<ButtonProps> = ({
        variant = 'primary',
        size = 'md',
        children,
      }) => {
        return (
          <StyledButton $variant={variant} $size={size}>
            {children}
          </StyledButton>
        );
      };
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // Should detect token import
    expect(result.patterns.some(p => p.patternId.includes('import'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });
});
