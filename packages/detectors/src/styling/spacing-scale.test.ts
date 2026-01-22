/**
 * Spacing Scale Detector Tests
 *
 * Tests for spacing scale adherence pattern detection.
 *
 * @requirements 9.2 - THE Styling_Detector SHALL detect spacing scale adherence (p-4 vs arbitrary values)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SpacingScaleDetector,
  createSpacingScaleDetector,
  detectTailwindSpacing,
  detectTailwindArbitrarySpacing,
  detectCSSSpacingProperties,
  detectThemeSpacing,
  detectArbitraryPxSpacing,
  detectArbitraryRemSpacing,
  detectArbitraryEmSpacing,
  analyzeSpacingScale,
  shouldExcludeFile,
  isAllowedSpacingValue,
  isOn4pxScale,
  isOn8pxScale,
  isOnRemScale,
  findNearest4pxValue,
  findNearest8pxValue,
  findNearestRemValue,
} from './spacing-scale.js';
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
    expect(shouldExcludeFile('design-tokens/spacing.ts')).toBe(true);
    expect(shouldExcludeFile('lib/design-tokens/index.ts')).toBe(true);
  });

  it('should exclude tokens directory', () => {
    expect(shouldExcludeFile('tokens/spacing.ts')).toBe(true);
  });

  it('should exclude theme directory', () => {
    expect(shouldExcludeFile('theme/spacing.ts')).toBe(true);
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

describe('isAllowedSpacingValue', () => {
  it('should allow common values', () => {
    expect(isAllowedSpacingValue('0')).toBe(true);
    expect(isAllowedSpacingValue('0px')).toBe(true);
    expect(isAllowedSpacingValue('1px')).toBe(true);
    expect(isAllowedSpacingValue('100%')).toBe(true);
  });

  it('should allow CSS keywords', () => {
    expect(isAllowedSpacingValue('auto')).toBe(true);
    expect(isAllowedSpacingValue('inherit')).toBe(true);
    expect(isAllowedSpacingValue('initial')).toBe(true);
    expect(isAllowedSpacingValue('unset')).toBe(true);
    expect(isAllowedSpacingValue('none')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isAllowedSpacingValue('AUTO')).toBe(true);
    expect(isAllowedSpacingValue('INHERIT')).toBe(true);
  });

  it('should not allow arbitrary values', () => {
    expect(isAllowedSpacingValue('13px')).toBe(false);
    expect(isAllowedSpacingValue('17px')).toBe(false);
    expect(isAllowedSpacingValue('1.3rem')).toBe(false);
  });
});


// ============================================================================
// Scale Detection Tests
// ============================================================================

describe('isOn4pxScale', () => {
  it('should return true for values on the 4px scale', () => {
    expect(isOn4pxScale(0)).toBe(true);
    expect(isOn4pxScale(4)).toBe(true);
    expect(isOn4pxScale(8)).toBe(true);
    expect(isOn4pxScale(12)).toBe(true);
    expect(isOn4pxScale(16)).toBe(true);
    expect(isOn4pxScale(24)).toBe(true);
    expect(isOn4pxScale(32)).toBe(true);
  });

  it('should return false for values not on the 4px scale', () => {
    expect(isOn4pxScale(3)).toBe(false);
    expect(isOn4pxScale(5)).toBe(false);
    expect(isOn4pxScale(13)).toBe(false);
    expect(isOn4pxScale(17)).toBe(false);
    expect(isOn4pxScale(25)).toBe(false);
  });
});

describe('isOn8pxScale', () => {
  it('should return true for values on the 8px scale', () => {
    expect(isOn8pxScale(0)).toBe(true);
    expect(isOn8pxScale(8)).toBe(true);
    expect(isOn8pxScale(16)).toBe(true);
    expect(isOn8pxScale(24)).toBe(true);
    expect(isOn8pxScale(32)).toBe(true);
    expect(isOn8pxScale(64)).toBe(true);
  });

  it('should return false for values not on the 8px scale', () => {
    expect(isOn8pxScale(4)).toBe(false);
    expect(isOn8pxScale(12)).toBe(false);
    expect(isOn8pxScale(20)).toBe(false);
    expect(isOn8pxScale(28)).toBe(false);
  });
});

describe('isOnRemScale', () => {
  it('should return true for values on the rem scale', () => {
    expect(isOnRemScale(0)).toBe(true);
    expect(isOnRemScale(0.25)).toBe(true);
    expect(isOnRemScale(0.5)).toBe(true);
    expect(isOnRemScale(1)).toBe(true);
    expect(isOnRemScale(1.5)).toBe(true);
    expect(isOnRemScale(2)).toBe(true);
  });

  it('should return false for values not on the rem scale', () => {
    expect(isOnRemScale(0.3)).toBe(false);
    expect(isOnRemScale(0.7)).toBe(false);
    expect(isOnRemScale(1.3)).toBe(false);
    expect(isOnRemScale(2.3)).toBe(false);
  });
});


// ============================================================================
// Nearest Value Tests
// ============================================================================

describe('findNearest4pxValue', () => {
  it('should find exact matches', () => {
    expect(findNearest4pxValue(4)).toBe(4);
    expect(findNearest4pxValue(8)).toBe(8);
    expect(findNearest4pxValue(16)).toBe(16);
  });

  it('should find nearest value for arbitrary values', () => {
    expect(findNearest4pxValue(5)).toBe(4);
    expect(findNearest4pxValue(7)).toBe(6); // 7 is equidistant from 6 and 8, picks lower
    expect(findNearest4pxValue(13)).toBe(12);
    expect(findNearest4pxValue(15)).toBe(14);
    expect(findNearest4pxValue(17)).toBe(16);
  });
});

describe('findNearest8pxValue', () => {
  it('should find exact matches', () => {
    expect(findNearest8pxValue(8)).toBe(8);
    expect(findNearest8pxValue(16)).toBe(16);
    expect(findNearest8pxValue(32)).toBe(32);
  });

  it('should find nearest value for arbitrary values', () => {
    expect(findNearest8pxValue(5)).toBe(8);
    expect(findNearest8pxValue(12)).toBe(8);
    expect(findNearest8pxValue(20)).toBe(16);
    expect(findNearest8pxValue(28)).toBe(24);
  });
});

describe('findNearestRemValue', () => {
  it('should find exact matches', () => {
    expect(findNearestRemValue(0.5)).toBe(0.5);
    expect(findNearestRemValue(1)).toBe(1);
    expect(findNearestRemValue(2)).toBe(2);
  });

  it('should find nearest value for arbitrary values', () => {
    expect(findNearestRemValue(0.3)).toBe(0.25);
    expect(findNearestRemValue(0.6)).toBe(0.5);
    expect(findNearestRemValue(1.3)).toBe(1.25);
    expect(findNearestRemValue(1.7)).toBe(1.5);
  });
});


// ============================================================================
// Tailwind Spacing Detection Tests
// ============================================================================

describe('detectTailwindSpacing', () => {
  it('should detect padding classes', () => {
    const content = `<div className="p-4 px-2 py-8">`;
    const results = detectTailwindSpacing(content, 'Button.tsx');

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.some(r => r.matchedText === 'p-4')).toBe(true);
    expect(results.some(r => r.matchedText === 'px-2')).toBe(true);
    expect(results.some(r => r.matchedText === 'py-8')).toBe(true);
  });

  it('should detect margin classes', () => {
    const content = `<div className="m-4 mx-auto mt-2 mb-6">`;
    const results = detectTailwindSpacing(content, 'Button.tsx');

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.some(r => r.matchedText === 'm-4')).toBe(true);
    expect(results.some(r => r.matchedText === 'mt-2')).toBe(true);
    expect(results.some(r => r.matchedText === 'mb-6')).toBe(true);
  });

  it('should detect gap classes', () => {
    const content = `<div className="gap-4 gap-x-2 gap-y-8">`;
    const results = detectTailwindSpacing(content, 'Button.tsx');

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.some(r => r.matchedText === 'gap-4')).toBe(true);
    expect(results.some(r => r.matchedText === 'gap-x-2')).toBe(true);
    expect(results.some(r => r.matchedText === 'gap-y-8')).toBe(true);
  });

  it('should detect space classes', () => {
    const content = `<div className="space-x-4 space-y-2">`;
    const results = detectTailwindSpacing(content, 'Button.tsx');

    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some(r => r.matchedText === 'space-x-4')).toBe(true);
    expect(results.some(r => r.matchedText === 'space-y-2')).toBe(true);
  });

  it('should detect width/height classes', () => {
    const content = `<div className="w-4 h-8 size-4">`;
    const results = detectTailwindSpacing(content, 'Button.tsx');

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.some(r => r.matchedText === 'w-4')).toBe(true);
    expect(results.some(r => r.matchedText === 'h-8')).toBe(true);
    expect(results.some(r => r.matchedText === 'size-4')).toBe(true);
  });

  it('should detect inset classes', () => {
    const content = `<div className="inset-4 top-2 right-4 bottom-6 left-8">`;
    const results = detectTailwindSpacing(content, 'Button.tsx');

    expect(results.length).toBeGreaterThanOrEqual(5);
    expect(results.some(r => r.matchedText === 'inset-4')).toBe(true);
    expect(results.some(r => r.matchedText === 'top-2')).toBe(true);
  });
});


// ============================================================================
// Tailwind Arbitrary Spacing Detection Tests
// ============================================================================

describe('detectTailwindArbitrarySpacing', () => {
  it('should detect arbitrary padding values', () => {
    const content = `<div className="p-[13px] px-[17px]">`;
    const results = detectTailwindArbitrarySpacing(content, 'Button.tsx');

    expect(results).toHaveLength(2);
    expect(results[0]?.type).toBe('tailwind-arbitrary');
    expect(results[0]?.value).toBe('p-[13px]');
  });

  it('should detect arbitrary margin values', () => {
    const content = `<div className="m-[15px] mt-[1.3rem]">`;
    const results = detectTailwindArbitrarySpacing(content, 'Button.tsx');

    expect(results).toHaveLength(2);
    expect(results.some(r => r.value === 'm-[15px]')).toBe(true);
    expect(results.some(r => r.value === 'mt-[1.3rem]')).toBe(true);
  });

  it('should detect arbitrary gap values', () => {
    const content = `<div className="gap-[13px] gap-x-[17px]">`;
    const results = detectTailwindArbitrarySpacing(content, 'Button.tsx');

    expect(results).toHaveLength(2);
  });

  it('should provide suggested values', () => {
    const content = `<div className="p-[13px]">`;
    const results = detectTailwindArbitrarySpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.suggestedValue).toBeDefined();
    expect(results[0]?.suggestedValue).toContain('spacing');
  });
});

// ============================================================================
// CSS Spacing Property Detection Tests
// ============================================================================

describe('detectCSSSpacingProperties', () => {
  it('should detect var() usage for spacing', () => {
    const content = `padding: var(--spacing-md);`;
    const results = detectCSSSpacingProperties(content, 'styles.css');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('css-spacing-property');
    expect(results[0]?.spacingValue).toBe('md');
  });

  it('should detect var() with fallback', () => {
    const content = `padding: var(--spacing-lg, 24px);`;
    const results = detectCSSSpacingProperties(content, 'styles.css');

    expect(results).toHaveLength(1);
    expect(results[0]?.spacingValue).toBe('lg');
  });

  it('should detect multiple CSS spacing properties', () => {
    const content = `
      padding: var(--spacing-md);
      margin: var(--margin-lg);
      gap: var(--gap-sm);
    `;
    const results = detectCSSSpacingProperties(content, 'styles.css');

    expect(results).toHaveLength(3);
  });

  it('should handle CSS spacing properties in JS/TS', () => {
    const content = `
      const styles = {
        padding: 'var(--spacing-md)',
        margin: 'var(--space-lg)',
      };
    `;
    const results = detectCSSSpacingProperties(content, 'Button.tsx');

    expect(results).toHaveLength(2);
  });
});


// ============================================================================
// Theme Spacing Detection Tests
// ============================================================================

describe('detectThemeSpacing', () => {
  it('should detect theme.spacing usage', () => {
    const content = `padding: theme.spacing.md;`;
    const results = detectThemeSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('theme-spacing');
  });

  it('should detect theme.space usage', () => {
    const content = `margin: theme.space.lg;`;
    const results = detectThemeSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
  });

  it('should detect theme spacing in template literals', () => {
    const content = 'const Button = styled.button`padding: ${theme.spacing.md};`;';
    const results = detectThemeSpacing(content, 'Button.tsx');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.matchedText.includes('theme.spacing.md'))).toBe(true);
  });

  it('should detect props.theme.spacing usage', () => {
    const content = `padding: props.theme.spacing.md;`;
    const results = detectThemeSpacing(content, 'Button.tsx');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.matchedText.includes('theme.spacing.md'))).toBe(true);
  });

  it('should detect nested theme spacing properties', () => {
    const content = `padding: theme.spacing.button.md;`;
    const results = detectThemeSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
  });

  it('should detect multiple theme spacing usages', () => {
    const content = `
      padding: theme.spacing.md;
      margin: theme.space.lg;
      gap: theme.spacing.sm;
    `;
    const results = detectThemeSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(3);
  });
});


// ============================================================================
// Arbitrary Pixel Spacing Detection Tests
// ============================================================================

describe('detectArbitraryPxSpacing', () => {
  it('should detect arbitrary pixel values', () => {
    const content = `padding: 13px;`;
    const results = detectArbitraryPxSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('arbitrary-px');
    expect(results[0]?.value).toBe('13px');
  });

  it('should not flag values on the 4px scale', () => {
    const content = `
      padding: 4px;
      margin: 8px;
      gap: 16px;
    `;
    const results = detectArbitraryPxSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(0);
  });

  it('should not flag values on the 8px scale', () => {
    const content = `
      padding: 24px;
      margin: 32px;
      gap: 64px;
    `;
    const results = detectArbitraryPxSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(0);
  });

  it('should not flag 0px or 1px', () => {
    const content = `
      border: 1px solid black;
      margin: 0px;
    `;
    const results = detectArbitraryPxSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(0);
  });

  it('should not flag CSS custom property definitions', () => {
    const content = `--spacing-custom: 13px;`;
    const results = detectArbitraryPxSpacing(content, 'tokens.css');

    expect(results).toHaveLength(0);
  });

  it('should not flag media query breakpoints', () => {
    const content = `@media (min-width: 768px) { }`;
    const results = detectArbitraryPxSpacing(content, 'styles.css');

    expect(results).toHaveLength(0);
  });

  it('should not flag values in comments', () => {
    const content = `
      // padding: 13px;
      /* margin: 17px; */
    `;
    const results = detectArbitraryPxSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(0);
  });

  it('should provide suggested value', () => {
    const content = `padding: 13px;`;
    const results = detectArbitraryPxSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.suggestedValue).toBeDefined();
    expect(results[0]?.suggestedValue).toContain('px');
  });

  it('should extract CSS property name', () => {
    const content = `padding-left: 13px;`;
    const results = detectArbitraryPxSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.property).toBe('padding-left');
  });
});


// ============================================================================
// Arbitrary Rem Spacing Detection Tests
// ============================================================================

describe('detectArbitraryRemSpacing', () => {
  it('should detect arbitrary rem values', () => {
    const content = `padding: 1.3rem;`;
    const results = detectArbitraryRemSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('arbitrary-rem');
    expect(results[0]?.value).toBe('1.3rem');
  });

  it('should not flag values on the rem scale', () => {
    const content = `
      padding: 0.5rem;
      margin: 1rem;
      gap: 1.5rem;
    `;
    const results = detectArbitraryRemSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(0);
  });

  it('should not flag CSS custom property definitions', () => {
    const content = `--spacing-custom: 1.3rem;`;
    const results = detectArbitraryRemSpacing(content, 'tokens.css');

    expect(results).toHaveLength(0);
  });

  it('should provide suggested value', () => {
    const content = `padding: 1.3rem;`;
    const results = detectArbitraryRemSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.suggestedValue).toBeDefined();
    expect(results[0]?.suggestedValue).toContain('rem');
  });
});

// ============================================================================
// Arbitrary Em Spacing Detection Tests
// ============================================================================

describe('detectArbitraryEmSpacing', () => {
  it('should detect arbitrary em values', () => {
    const content = `padding: 1.3em;`;
    const results = detectArbitraryEmSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.type).toBe('arbitrary-em');
    expect(results[0]?.value).toBe('1.3em');
  });

  it('should not flag values on the scale', () => {
    const content = `
      padding: 0.5em;
      margin: 1em;
      gap: 1.5em;
    `;
    const results = detectArbitraryEmSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(0);
  });

  it('should provide suggested value', () => {
    const content = `padding: 1.3em;`;
    const results = detectArbitraryEmSpacing(content, 'Button.tsx');

    expect(results).toHaveLength(1);
    expect(results[0]?.suggestedValue).toBeDefined();
    expect(results[0]?.suggestedValue).toContain('em');
  });
});


// ============================================================================
// Analysis Function Tests
// ============================================================================

describe('analyzeSpacingScale', () => {
  it('should analyze file with Tailwind spacing', () => {
    const content = `
      <div className="p-4 m-2 gap-8">
        Content
      </div>
    `;
    const analysis = analyzeSpacingScale(content, 'Button.tsx');

    expect(analysis.usesTailwindSpacing).toBe(true);
    expect(analysis.spacingPatterns.length).toBeGreaterThan(0);
    expect(analysis.detectedScale).toBe('rem');
  });

  it('should analyze file with CSS spacing properties', () => {
    const content = `
      .button {
        padding: var(--spacing-md);
        margin: var(--spacing-lg);
      }
    `;
    const analysis = analyzeSpacingScale(content, 'styles.css');

    expect(analysis.usesCSSSpacingProperties).toBe(true);
    expect(analysis.spacingPatterns.length).toBe(2);
  });

  it('should analyze file with theme spacing', () => {
    const content = `
      const Button = styled.button\`
        padding: \${theme.spacing.md};
        margin: \${theme.spacing.lg};
      \`;
    `;
    const analysis = analyzeSpacingScale(content, 'Button.tsx');

    expect(analysis.usesThemeSpacing).toBe(true);
  });

  it('should detect arbitrary values', () => {
    const content = `
      const Button = styled.button\`
        padding: 13px;
        margin: 17px;
      \`;
    `;
    const analysis = analyzeSpacingScale(content, 'Button.tsx');

    expect(analysis.arbitraryValues.length).toBeGreaterThan(0);
  });

  it('should skip arbitrary detection for excluded files', () => {
    const content = `
      const spacing = {
        custom: '13px',
        another: '17px',
      };
    `;
    const analysis = analyzeSpacingScale(content, 'design-tokens/spacing.ts');

    expect(analysis.arbitraryValues).toHaveLength(0);
  });

  it('should calculate confidence based on scale adherence', () => {
    // File with only scale values
    const scaleContent = `
      <div className="p-4 m-2 gap-8">
        Content
      </div>
    `;
    const scaleAnalysis = analyzeSpacingScale(scaleContent, 'Button.tsx');
    expect(scaleAnalysis.scaleAdherenceConfidence).toBeGreaterThan(0.5);

    // File with only arbitrary values
    const arbitraryContent = `
      padding: 13px;
      margin: 17px;
    `;
    const arbitraryAnalysis = analyzeSpacingScale(arbitraryContent, 'Button.tsx');
    expect(arbitraryAnalysis.scaleAdherenceConfidence).toBeLessThan(0.5);
  });
});


// ============================================================================
// Detector Class Tests
// ============================================================================

describe('SpacingScaleDetector', () => {
  let detector: SpacingScaleDetector;

  beforeEach(() => {
    detector = createSpacingScaleDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('styling/spacing-scale');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe('styling');
    });

    it('should have correct subcategory', () => {
      expect(detector.subcategory).toBe('spacing-scale');
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

    it('should detect Tailwind spacing patterns', async () => {
      const content = `
        <div className="p-4 m-2 gap-8">
          Content
        </div>
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns.some(p => p.patternId.includes('tailwind'))).toBe(true);
    });

    it('should detect CSS spacing property patterns', async () => {
      const content = `
        .button {
          padding: var(--spacing-md);
          margin: var(--spacing-lg);
        }
      `;
      const context = createMockContext('styles.css', content);
      const result = await detector.detect(context);

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns.some(p => p.patternId.includes('css-property'))).toBe(true);
    });

    it('should detect theme spacing patterns', async () => {
      const content = `
        const Button = styled.button\`
          padding: \${theme.spacing.md};
        \`;
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns.some(p => p.patternId.includes('theme'))).toBe(true);
    });

    // NOTE: SpacingScaleDetector focuses on PATTERN detection, not violation enforcement.
    // Arbitrary spacing violations are intentionally not generated - drift learns patterns, not enforces rules.
    it('should not create violations for arbitrary pixel values (pattern learning mode)', async () => {
      const content = `
        const Button = styled.button\`
          padding: 13px;
          margin: 17px;
        \`;
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      // Violations are intentionally not generated - drift learns patterns
      expect(result.violations).toHaveLength(0);
    });

    it('should not create violations for Tailwind arbitrary values (pattern learning mode)', async () => {
      const content = `
        <div className="p-[13px] m-[17px]">
          Content
        </div>
      `;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      // Violations are intentionally not generated - drift learns patterns
      expect(result.violations).toHaveLength(0);
    });

    it('should not create violations for test files', async () => {
      const content = `
        const mockStyles = {
          padding: '13px',
          margin: '17px',
        };
      `;
      const context = createMockContext('Button.test.tsx', content);
      const result = await detector.detect(context);

      expect(result.violations).toHaveLength(0);
    });

    it('should not include quick fix since no violations are generated', async () => {
      const content = `padding: 13px;`;
      const context = createMockContext('Button.tsx', content);
      const result = await detector.detect(context);

      // No violations means no quick fixes
      expect(result.violations).toHaveLength(0);
    });
  });


  describe('generateQuickFix', () => {
    it('should generate quick fix for arbitrary pixel violation', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'styling/spacing-scale',
        severity: 'warning' as const,
        file: 'Button.tsx',
        range: { start: { line: 1, character: 9 }, end: { line: 1, character: 13 } },
        message: "Arbitrary pixel spacing '13px' doesn't follow the spacing scale",
        expected: 'A spacing scale value',
        actual: '13px',
        aiExplainAvailable: true,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const fix = detector.generateQuickFix(violation);

      expect(fix).not.toBeNull();
      expect(fix?.title).toContain('scale value');
      expect(fix?.kind).toBe('quickfix');
    });

    it('should generate quick fix for arbitrary rem violation', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'styling/spacing-scale',
        severity: 'warning' as const,
        file: 'Button.tsx',
        range: { start: { line: 1, character: 9 }, end: { line: 1, character: 15 } },
        message: "Arbitrary rem spacing '1.3rem' doesn't follow the spacing scale",
        expected: 'A spacing scale value',
        actual: '1.3rem',
        aiExplainAvailable: true,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const fix = detector.generateQuickFix(violation);

      expect(fix).not.toBeNull();
      expect(fix?.title).toContain('scale value');
    });

    it('should return null for non-spacing violations', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'styling/spacing-scale',
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

describe('SpacingScaleDetector Integration', () => {
  let detector: SpacingScaleDetector;

  beforeEach(() => {
    detector = createSpacingScaleDetector();
  });

  it('should handle styled-components with mixed patterns', async () => {
    const content = `
      import styled from 'styled-components';
      
      const Button = styled.button\`
        padding: \${theme.spacing.md};
        margin: 13px;
        gap: var(--spacing-sm);
      \`;
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // Should detect theme spacing pattern
    expect(result.patterns.some(p => p.patternId.includes('theme'))).toBe(true);

    // Should detect CSS spacing property pattern
    expect(result.patterns.some(p => p.patternId.includes('css-property'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should handle Tailwind with arbitrary values', async () => {
    const content = `
      export const Button = () => (
        <button 
          className="p-4 m-[13px] gap-2 px-[17px]"
        >
          Click me
        </button>
      );
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // Should detect Tailwind spacing pattern
    expect(result.patterns.some(p => p.patternId.includes('tailwind'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should handle CSS modules', async () => {
    const content = `
      .button {
        padding: var(--spacing-md);
        margin: 13px;
        gap: var(--spacing-sm);
      }
      
      .button:hover {
        padding: var(--spacing-lg);
      }
    `;
    const context = createMockContext('Button.module.css', content);
    const result = await detector.detect(context);

    // Should detect CSS spacing properties
    expect(result.patterns.some(p => p.patternId.includes('css-property'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should handle inline styles in React', async () => {
    const content = `
      export const Button = () => (
        <button 
          style={{
            padding: '13px',
            margin: 'var(--spacing-md)',
          }}
        >
          Click me
        </button>
      );
    `;
    const context = createMockContext('Button.tsx', content);
    const result = await detector.detect(context);

    // Should detect CSS spacing property
    expect(result.patterns.some(p => p.patternId.includes('css-property'))).toBe(true);

    // No violations - drift learns patterns, not enforces rules
    expect(result.violations).toHaveLength(0);
  });

  it('should detect patterns without generating violations', async () => {
    const content = `
      .button {
        padding: 13px;
        margin: 17px;
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
      
      const Container = styled.div\`
        display: flex;
        flex-direction: column;
        gap: \${theme.spacing.md};
        padding: \${theme.spacing.lg};
      \`;
      
      const Button = styled.button\`
        padding: \${theme.spacing.sm} \${theme.spacing.md};
        margin-top: \${theme.spacing.xs};
        border-radius: 4px;
      \`;
      
      export const Card = () => (
        <Container className="p-4 m-2">
          <Button>Click me</Button>
        </Container>
      );
    `;
    const context = createMockContext('Card.tsx', content);
    const result = await detector.detect(context);

    // Should detect both theme and Tailwind patterns
    expect(result.patterns.length).toBeGreaterThan(0);
    
    // Should have reasonable confidence
    expect(result.confidence).toBeGreaterThan(0);
  });
});
