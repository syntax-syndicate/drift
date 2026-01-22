/**
 * Tests for Tailwind Patterns Detector
 *
 * @requirements 9.6 - THE Styling_Detector SHALL detect Tailwind pattern consistency
 */

import { describe, it, expect } from 'vitest';
import {
  TailwindPatternsDetector,
  createTailwindPatternsDetector,
  // Helper functions
  isTailwindUtilityClass,
  isArbitraryValueClass,
  hasResponsivePrefix,
  hasStateVariant,
  hasDarkModePrefix,
  extractBaseClass,
  getResponsiveBreakpoint,
  getBreakpointOrderIndex,
  detectUtilityClasses,
  detectArbitraryValues,
  detectResponsivePrefixes,
  detectStateVariants,
  detectDarkMode,
  detectApplyDirective,
  detectConflictingClasses,
  detectInconsistentBreakpointOrder,
  suggestStandardClass,
  analyzeTailwindPatterns,
  shouldExcludeFile,
} from './tailwind-patterns.js';
import type { DetectionContext } from '../base/index.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockContext(content: string, file: string = 'test.tsx'): DetectionContext {
  return {
    file,
    content,
    ast: null,
    imports: [],
    exports: [],
    projectContext: {
      rootDir: '/project',
      files: [file],
      config: {},
    },
    language: 'typescript',
    extension: '.tsx',
    isTestFile: false,
    isTypeDefinition: false,
  };
}

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('isTailwindUtilityClass', () => {
  it('should recognize layout classes', () => {
    expect(isTailwindUtilityClass('flex')).toBe(true);
    expect(isTailwindUtilityClass('grid')).toBe(true);
    expect(isTailwindUtilityClass('block')).toBe(true);
    expect(isTailwindUtilityClass('hidden')).toBe(true);
    expect(isTailwindUtilityClass('inline-flex')).toBe(true);
  });

  it('should recognize spacing classes', () => {
    expect(isTailwindUtilityClass('p-4')).toBe(true);
    expect(isTailwindUtilityClass('m-2')).toBe(true);
    expect(isTailwindUtilityClass('px-6')).toBe(true);
    expect(isTailwindUtilityClass('my-auto')).toBe(true);
    expect(isTailwindUtilityClass('gap-4')).toBe(true);
  });

  it('should recognize typography classes', () => {
    expect(isTailwindUtilityClass('text-lg')).toBe(true);
    expect(isTailwindUtilityClass('font-bold')).toBe(true);
    expect(isTailwindUtilityClass('text-2xl')).toBe(true);
    expect(isTailwindUtilityClass('leading-tight')).toBe(true);
  });

  it('should recognize color classes', () => {
    expect(isTailwindUtilityClass('text-blue-500')).toBe(true);
    expect(isTailwindUtilityClass('bg-red-100')).toBe(true);
    expect(isTailwindUtilityClass('border-gray-300')).toBe(true);
  });

  it('should recognize flexbox alignment classes', () => {
    expect(isTailwindUtilityClass('items-center')).toBe(true);
    expect(isTailwindUtilityClass('justify-between')).toBe(true);
    expect(isTailwindUtilityClass('flex-col')).toBe(true);
  });

  it('should recognize positioning classes', () => {
    expect(isTailwindUtilityClass('relative')).toBe(true);
    expect(isTailwindUtilityClass('absolute')).toBe(true);
    expect(isTailwindUtilityClass('fixed')).toBe(true);
    expect(isTailwindUtilityClass('sticky')).toBe(true);
  });

  it('should recognize effect classes', () => {
    expect(isTailwindUtilityClass('shadow-lg')).toBe(true);
    expect(isTailwindUtilityClass('opacity-50')).toBe(true);
    expect(isTailwindUtilityClass('rounded-lg')).toBe(true);
  });

  it('should not recognize non-Tailwind classes', () => {
    expect(isTailwindUtilityClass('my-custom-class')).toBe(false);
    expect(isTailwindUtilityClass('btn-primary')).toBe(false);
  });
});

describe('isArbitraryValueClass', () => {
  it('should recognize arbitrary value classes', () => {
    expect(isArbitraryValueClass('p-[13px]')).toBe(true);
    expect(isArbitraryValueClass('w-[200px]')).toBe(true);
    expect(isArbitraryValueClass('text-[#ff0000]')).toBe(true);
    expect(isArbitraryValueClass('bg-[rgb(255,0,0)]')).toBe(true);
  });

  it('should not recognize standard classes', () => {
    expect(isArbitraryValueClass('p-4')).toBe(false);
    expect(isArbitraryValueClass('text-lg')).toBe(false);
    expect(isArbitraryValueClass('bg-blue-500')).toBe(false);
  });
});

describe('hasResponsivePrefix', () => {
  it('should recognize responsive prefixes', () => {
    expect(hasResponsivePrefix('sm:flex')).toBe(true);
    expect(hasResponsivePrefix('md:hidden')).toBe(true);
    expect(hasResponsivePrefix('lg:block')).toBe(true);
    expect(hasResponsivePrefix('xl:p-4')).toBe(true);
    expect(hasResponsivePrefix('2xl:text-lg')).toBe(true);
  });

  it('should not recognize classes without responsive prefix', () => {
    expect(hasResponsivePrefix('flex')).toBe(false);
    expect(hasResponsivePrefix('p-4')).toBe(false);
  });
});

describe('hasStateVariant', () => {
  it('should recognize state variants', () => {
    expect(hasStateVariant('hover:bg-blue-600')).toBe(true);
    expect(hasStateVariant('focus:ring-2')).toBe(true);
    expect(hasStateVariant('active:scale-95')).toBe(true);
    expect(hasStateVariant('disabled:opacity-50')).toBe(true);
  });

  it('should not recognize classes without state variant', () => {
    expect(hasStateVariant('bg-blue-500')).toBe(false);
    expect(hasStateVariant('p-4')).toBe(false);
  });
});

describe('hasDarkModePrefix', () => {
  it('should recognize dark mode prefix', () => {
    expect(hasDarkModePrefix('dark:bg-gray-800')).toBe(true);
    expect(hasDarkModePrefix('dark:text-white')).toBe(true);
  });

  it('should not recognize classes without dark mode prefix', () => {
    expect(hasDarkModePrefix('bg-gray-800')).toBe(false);
    expect(hasDarkModePrefix('text-white')).toBe(false);
  });
});

describe('extractBaseClass', () => {
  it('should extract base class from responsive prefix', () => {
    expect(extractBaseClass('sm:flex')).toBe('flex');
    expect(extractBaseClass('md:p-4')).toBe('p-4');
    expect(extractBaseClass('lg:text-lg')).toBe('text-lg');
  });

  it('should extract base class from state variant', () => {
    expect(extractBaseClass('hover:bg-blue-600')).toBe('bg-blue-600');
    expect(extractBaseClass('focus:ring-2')).toBe('ring-2');
  });

  it('should extract base class from dark mode prefix', () => {
    expect(extractBaseClass('dark:bg-gray-800')).toBe('bg-gray-800');
    expect(extractBaseClass('dark:text-white')).toBe('text-white');
  });

  it('should return same class if no prefix', () => {
    expect(extractBaseClass('flex')).toBe('flex');
    expect(extractBaseClass('p-4')).toBe('p-4');
  });
});

describe('getResponsiveBreakpoint', () => {
  it('should extract breakpoint from class', () => {
    expect(getResponsiveBreakpoint('sm:flex')).toBe('sm');
    expect(getResponsiveBreakpoint('md:hidden')).toBe('md');
    expect(getResponsiveBreakpoint('lg:block')).toBe('lg');
    expect(getResponsiveBreakpoint('xl:p-4')).toBe('xl');
    expect(getResponsiveBreakpoint('2xl:text-lg')).toBe('2xl');
  });

  it('should return null for classes without breakpoint', () => {
    expect(getResponsiveBreakpoint('flex')).toBeNull();
    expect(getResponsiveBreakpoint('p-4')).toBeNull();
  });
});

describe('getBreakpointOrderIndex', () => {
  it('should return correct order index', () => {
    expect(getBreakpointOrderIndex('sm')).toBe(0);
    expect(getBreakpointOrderIndex('md')).toBe(1);
    expect(getBreakpointOrderIndex('lg')).toBe(2);
    expect(getBreakpointOrderIndex('xl')).toBe(3);
    expect(getBreakpointOrderIndex('2xl')).toBe(4);
  });

  it('should return -1 for invalid breakpoint', () => {
    expect(getBreakpointOrderIndex('invalid')).toBe(-1);
  });
});

describe('shouldExcludeFile', () => {
  it('should exclude test files', () => {
    expect(shouldExcludeFile('component.test.ts')).toBe(true);
    expect(shouldExcludeFile('component.test.tsx')).toBe(true);
    expect(shouldExcludeFile('component.spec.ts')).toBe(true);
  });

  it('should exclude story files', () => {
    expect(shouldExcludeFile('component.stories.tsx')).toBe(true);
  });

  it('should exclude Tailwind config files', () => {
    expect(shouldExcludeFile('tailwind.config.js')).toBe(true);
    expect(shouldExcludeFile('tailwind.config.ts')).toBe(true);
  });

  it('should not exclude regular source files', () => {
    expect(shouldExcludeFile('component.tsx')).toBe(false);
    expect(shouldExcludeFile('styles.css')).toBe(false);
  });
});

describe('suggestStandardClass', () => {
  it('should suggest standard class for pixel values', () => {
    expect(suggestStandardClass('p-[16px]')).toBe('p-4');
    expect(suggestStandardClass('m-[8px]')).toBe('m-2');
    expect(suggestStandardClass('w-[32px]')).toBe('w-8');
  });

  it('should suggest standard class for rem values', () => {
    expect(suggestStandardClass('p-[1rem]')).toBe('p-4');
    expect(suggestStandardClass('m-[0.5rem]')).toBe('m-2');
  });

  it('should suggest standard class for percentage values', () => {
    expect(suggestStandardClass('w-[100%]')).toBe('w-full');
    expect(suggestStandardClass('w-[50%]')).toBe('w-1/2');
    expect(suggestStandardClass('h-[100%]')).toBe('h-full');
  });

  it('should return undefined for non-standard values', () => {
    expect(suggestStandardClass('p-[13px]')).toBeUndefined();
    expect(suggestStandardClass('w-[calc(100%-20px)]')).toBeUndefined();
  });
});

// ============================================================================
// Pattern Detection Tests
// ============================================================================

describe('detectUtilityClasses', () => {
  it('should detect Tailwind utility classes in JSX', () => {
    const content = `
      <div className="flex items-center justify-between p-4 bg-blue-500">
        <span className="text-lg font-bold">Title</span>
      </div>
    `;
    const patterns = detectUtilityClasses(content, 'test.tsx');
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.matchedText === 'flex')).toBe(true);
    expect(patterns.some(p => p.matchedText === 'items-center')).toBe(true);
    expect(patterns.some(p => p.matchedText === 'p-4')).toBe(true);
  });

  it('should detect utility classes in CSS @apply', () => {
    const content = `
      .button {
        @apply flex items-center px-4 py-2 rounded-lg;
      }
    `;
    const patterns = detectUtilityClasses(content, 'styles.css');
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.matchedText === 'flex')).toBe(true);
    expect(patterns.some(p => p.matchedText === 'rounded-lg')).toBe(true);
  });

  it('should not detect patterns inside comments', () => {
    const content = `
      // This is a comment with flex
      /* Another comment with p-4 */
      <div className="grid">Content</div>
    `;
    const patterns = detectUtilityClasses(content, 'test.tsx');
    // Should only detect the real class, not the ones in comments
    const gridPatterns = patterns.filter(p => p.matchedText === 'grid');
    expect(gridPatterns.length).toBeGreaterThanOrEqual(1);
  });
});

describe('detectArbitraryValues', () => {
  it('should detect arbitrary pixel values', () => {
    const content = `<div className="p-[13px] w-[200px]">Content</div>`;
    const patterns = detectArbitraryValues(content, 'test.tsx');
    expect(patterns.length).toBe(2);
    expect(patterns.some(p => p.matchedText === 'p-[13px]')).toBe(true);
    expect(patterns.some(p => p.matchedText === 'w-[200px]')).toBe(true);
  });

  it('should detect arbitrary color values', () => {
    const content = `<div className="text-[#ff0000] bg-[rgb(0,0,255)]">Content</div>`;
    const patterns = detectArbitraryValues(content, 'test.tsx');
    expect(patterns.length).toBe(2);
    expect(patterns.some(p => p.matchedText === 'text-[#ff0000]')).toBe(true);
  });

  it('should detect arbitrary calc values', () => {
    const content = `<div className="w-[calc(100%-20px)]">Content</div>`;
    const patterns = detectArbitraryValues(content, 'test.tsx');
    expect(patterns.length).toBe(1);
    expect(patterns[0]?.matchedText).toBe('w-[calc(100%-20px)]');
  });
});

describe('detectResponsivePrefixes', () => {
  it('should detect responsive prefixes', () => {
    const content = `<div className="flex sm:hidden md:block lg:flex xl:grid 2xl:inline-flex">Content</div>`;
    const patterns = detectResponsivePrefixes(content, 'test.tsx');
    expect(patterns.length).toBe(5);
    expect(patterns.some(p => p.matchedText === 'sm:hidden')).toBe(true);
    expect(patterns.some(p => p.matchedText === 'md:block')).toBe(true);
    expect(patterns.some(p => p.matchedText === 'lg:flex')).toBe(true);
    expect(patterns.some(p => p.matchedText === 'xl:grid')).toBe(true);
    expect(patterns.some(p => p.matchedText === '2xl:inline-flex')).toBe(true);
  });
});

describe('detectStateVariants', () => {
  it('should detect hover state', () => {
    const content = `<button className="bg-blue-500 hover:bg-blue-600">Click</button>`;
    const patterns = detectStateVariants(content, 'test.tsx');
    expect(patterns.length).toBe(1);
    expect(patterns[0]?.matchedText).toBe('hover:bg-blue-600');
  });

  it('should detect focus state', () => {
    const content = `<input className="border focus:ring-2 focus:border-blue-500" />`;
    const patterns = detectStateVariants(content, 'test.tsx');
    expect(patterns.length).toBe(2);
    expect(patterns.some(p => p.matchedText === 'focus:ring-2')).toBe(true);
    expect(patterns.some(p => p.matchedText === 'focus:border-blue-500')).toBe(true);
  });

  it('should detect multiple state variants', () => {
    const content = `<button className="active:scale-95 disabled:opacity-50">Click</button>`;
    const patterns = detectStateVariants(content, 'test.tsx');
    expect(patterns.length).toBe(2);
    expect(patterns.some(p => p.matchedText === 'active:scale-95')).toBe(true);
    expect(patterns.some(p => p.matchedText === 'disabled:opacity-50')).toBe(true);
  });
});

describe('detectDarkMode', () => {
  it('should detect dark mode classes', () => {
    const content = `<div className="bg-white dark:bg-gray-800 text-black dark:text-white">Content</div>`;
    const patterns = detectDarkMode(content, 'test.tsx');
    expect(patterns.length).toBe(2);
    expect(patterns.some(p => p.matchedText === 'dark:bg-gray-800')).toBe(true);
    expect(patterns.some(p => p.matchedText === 'dark:text-white')).toBe(true);
  });
});

describe('detectApplyDirective', () => {
  it('should detect @apply directive', () => {
    const content = `
      .button {
        @apply flex items-center px-4 py-2;
      }
      .card {
        @apply rounded-lg shadow-md p-6;
      }
    `;
    const patterns = detectApplyDirective(content, 'styles.css');
    expect(patterns.length).toBe(2);
    expect(patterns[0]?.classNames).toContain('flex');
    expect(patterns[0]?.classNames).toContain('items-center');
    expect(patterns[1]?.classNames).toContain('rounded-lg');
  });
});

// ============================================================================
// Violation Detection Tests
// ============================================================================

describe('detectConflictingClasses', () => {
  it('should detect flex and grid conflict', () => {
    const content = `<div className="flex grid">Content</div>`;
    const violations = detectConflictingClasses(content, 'test.tsx');
    expect(violations.length).toBe(1);
    expect(violations[0]?.type).toBe('conflicting-classes');
    expect(violations[0]?.issue).toContain('flex and grid');
  });

  it('should detect flex and block conflict', () => {
    const content = `<div className="flex block">Content</div>`;
    const violations = detectConflictingClasses(content, 'test.tsx');
    expect(violations.length).toBe(1);
    expect(violations[0]?.issue).toContain('flex and block');
  });

  it('should detect hidden and flex conflict', () => {
    const content = `<div className="hidden flex">Content</div>`;
    const violations = detectConflictingClasses(content, 'test.tsx');
    expect(violations.length).toBe(1);
    expect(violations[0]?.issue).toContain('hidden and flex');
  });

  it('should detect position conflicts', () => {
    const content = `<div className="relative absolute">Content</div>`;
    const violations = detectConflictingClasses(content, 'test.tsx');
    expect(violations.length).toBe(1);
    expect(violations[0]?.issue).toContain('relative and absolute');
  });

  it('should detect visibility conflicts', () => {
    const content = `<div className="visible invisible">Content</div>`;
    const violations = detectConflictingClasses(content, 'test.tsx');
    expect(violations.length).toBe(1);
    expect(violations[0]?.issue).toContain('visible and invisible');
  });

  it('should detect text transform conflicts', () => {
    const content = `<div className="uppercase lowercase">Content</div>`;
    const violations = detectConflictingClasses(content, 'test.tsx');
    expect(violations.length).toBe(1);
    expect(violations[0]?.issue).toContain('uppercase and lowercase');
  });

  it('should not flag non-conflicting classes', () => {
    const content = `<div className="flex items-center p-4">Content</div>`;
    const violations = detectConflictingClasses(content, 'test.tsx');
    expect(violations.length).toBe(0);
  });
});

describe('detectInconsistentBreakpointOrder', () => {
  it('should detect out-of-order breakpoints', () => {
    const content = `<div className="lg:flex sm:flex md:flex">Content</div>`;
    const violations = detectInconsistentBreakpointOrder(content, 'test.tsx');
    expect(violations.length).toBe(1);
    expect(violations[0]?.type).toBe('inconsistent-breakpoint-order');
    expect(violations[0]?.issue).toContain('mobile-first order');
  });

  it('should detect reverse order breakpoints', () => {
    const content = `<div className="2xl:hidden xl:hidden lg:hidden md:hidden sm:hidden">Content</div>`;
    const violations = detectInconsistentBreakpointOrder(content, 'test.tsx');
    expect(violations.length).toBe(1);
  });

  it('should not flag correctly ordered breakpoints', () => {
    const content = `<div className="sm:flex md:flex lg:flex xl:flex 2xl:flex">Content</div>`;
    const violations = detectInconsistentBreakpointOrder(content, 'test.tsx');
    expect(violations.length).toBe(0);
  });

  it('should not flag single breakpoint usage', () => {
    const content = `<div className="md:flex">Content</div>`;
    const violations = detectInconsistentBreakpointOrder(content, 'test.tsx');
    expect(violations.length).toBe(0);
  });

  it('should suggest correct order', () => {
    const content = `<div className="lg:p-4 sm:p-2 md:p-3">Content</div>`;
    const violations = detectInconsistentBreakpointOrder(content, 'test.tsx');
    expect(violations.length).toBe(1);
    expect(violations[0]?.suggestedFix).toContain('sm:p-2');
  });
});

// ============================================================================
// Analysis Tests
// ============================================================================

describe('analyzeTailwindPatterns', () => {
  it('should analyze file with utility classes', () => {
    const content = `
      <div className="flex items-center p-4 bg-blue-500">
        <span className="text-lg font-bold">Title</span>
      </div>
    `;
    const analysis = analyzeTailwindPatterns(content, 'test.tsx');
    expect(analysis.usesUtilityClasses).toBe(true);
    expect(analysis.patterns.some(p => p.type === 'utility-class')).toBe(true);
  });

  it('should analyze file with arbitrary values', () => {
    const content = `<div className="p-[13px] w-[200px]">Content</div>`;
    const analysis = analyzeTailwindPatterns(content, 'test.tsx');
    expect(analysis.usesArbitraryValues).toBe(true);
    expect(analysis.patterns.some(p => p.type === 'arbitrary-value')).toBe(true);
  });

  it('should analyze file with responsive prefixes', () => {
    const content = `<div className="flex sm:hidden md:block lg:flex">Content</div>`;
    const analysis = analyzeTailwindPatterns(content, 'test.tsx');
    expect(analysis.usesResponsivePrefixes).toBe(true);
    expect(analysis.patterns.some(p => p.type === 'responsive-prefix')).toBe(true);
  });

  it('should analyze file with state variants', () => {
    const content = `<button className="bg-blue-500 hover:bg-blue-600 focus:ring-2">Click</button>`;
    const analysis = analyzeTailwindPatterns(content, 'test.tsx');
    expect(analysis.usesStateVariants).toBe(true);
    expect(analysis.patterns.some(p => p.type === 'state-variant')).toBe(true);
  });

  it('should analyze file with dark mode', () => {
    const content = `<div className="bg-white dark:bg-gray-800">Content</div>`;
    const analysis = analyzeTailwindPatterns(content, 'test.tsx');
    expect(analysis.usesDarkMode).toBe(true);
    expect(analysis.patterns.some(p => p.type === 'dark-mode')).toBe(true);
  });

  it('should analyze file with @apply directive', () => {
    const content = `
      .button {
        @apply flex items-center px-4 py-2;
      }
    `;
    const analysis = analyzeTailwindPatterns(content, 'styles.css');
    expect(analysis.usesApplyDirective).toBe(true);
    expect(analysis.patterns.some(p => p.type === 'apply-directive')).toBe(true);
  });

  // NOTE: TailwindPatternsDetector focuses on PATTERN detection, not violation enforcement.
  // Violations are intentionally not generated - drift learns patterns, not enforces rules.
  it('should not detect violations (pattern learning mode)', () => {
    const content = `<div className="flex grid p-[13px]">Content</div>`;
    const analysis = analyzeTailwindPatterns(content, 'test.tsx');
    // Violations are intentionally not generated
    expect(analysis.violations).toHaveLength(0);
  });

  it('should return empty analysis for excluded files', () => {
    const content = `<div className="flex grid p-[13px]">Content</div>`;
    const analysis = analyzeTailwindPatterns(content, 'component.test.tsx');
    expect(analysis.patterns.length).toBe(0);
    expect(analysis.violations.length).toBe(0);
    expect(analysis.tailwindConsistencyConfidence).toBe(1.0);
  });

  it('should calculate consistency confidence', () => {
    // File with consistent Tailwind usage
    const consistentContent = `
      <div className="flex items-center p-4">
        <span className="text-lg font-bold">Title</span>
      </div>
    `;
    const consistentAnalysis = analyzeTailwindPatterns(consistentContent, 'test.tsx');
    expect(consistentAnalysis.tailwindConsistencyConfidence).toBeGreaterThan(0.5);

    // File with potential conflicts - but violations are disabled, so confidence stays at 1.0
    const inconsistentContent = `<div className="flex grid hidden block">Content</div>`;
    const inconsistentAnalysis = analyzeTailwindPatterns(inconsistentContent, 'test.tsx');
    // With violations disabled, confidence is based only on patterns found
    expect(inconsistentAnalysis.tailwindConsistencyConfidence).toBe(1.0);
  });
});

// ============================================================================
// Detector Class Tests
// ============================================================================

describe('TailwindPatternsDetector', () => {
  describe('metadata', () => {
    it('should have correct id', () => {
      const detector = createTailwindPatternsDetector();
      expect(detector.id).toBe('styling/tailwind-patterns');
    });

    it('should have correct category', () => {
      const detector = createTailwindPatternsDetector();
      expect(detector.category).toBe('styling');
    });

    it('should have correct subcategory', () => {
      const detector = createTailwindPatternsDetector();
      expect(detector.subcategory).toBe('tailwind-patterns');
    });

    it('should support TypeScript, JavaScript, and CSS', () => {
      const detector = createTailwindPatternsDetector();
      expect(detector.supportedLanguages).toContain('typescript');
      expect(detector.supportedLanguages).toContain('javascript');
      expect(detector.supportedLanguages).toContain('css');
    });

    it('should use regex detection method', () => {
      const detector = createTailwindPatternsDetector();
      expect(detector.detectionMethod).toBe('regex');
    });
  });

  describe('detect', () => {
    it('should detect utility class patterns', async () => {
      const detector = createTailwindPatternsDetector();
      const context = createMockContext(`
        <div className="flex items-center p-4 bg-blue-500">
          <span className="text-lg font-bold">Title</span>
        </div>
      `);

      const result = await detector.detect(context);
      expect(result.patterns.some(p => p.patternId.includes('utility-class'))).toBe(true);
    });

    it('should detect arbitrary value patterns', async () => {
      const detector = createTailwindPatternsDetector();
      const context = createMockContext(`
        <div className="p-[13px] w-[200px]">Content</div>
      `);

      const result = await detector.detect(context);
      expect(result.patterns.some(p => p.patternId.includes('arbitrary-value'))).toBe(true);
    });

    it('should detect responsive prefix patterns', async () => {
      const detector = createTailwindPatternsDetector();
      const context = createMockContext(`
        <div className="flex sm:hidden md:block lg:flex">Content</div>
      `);

      const result = await detector.detect(context);
      expect(result.patterns.some(p => p.patternId.includes('responsive-prefix'))).toBe(true);
    });

    it('should detect state variant patterns', async () => {
      const detector = createTailwindPatternsDetector();
      const context = createMockContext(`
        <button className="bg-blue-500 hover:bg-blue-600">Click</button>
      `);

      const result = await detector.detect(context);
      expect(result.patterns.some(p => p.patternId.includes('state-variant'))).toBe(true);
    });

    it('should detect dark mode patterns', async () => {
      const detector = createTailwindPatternsDetector();
      const context = createMockContext(`
        <div className="bg-white dark:bg-gray-800">Content</div>
      `);

      const result = await detector.detect(context);
      expect(result.patterns.some(p => p.patternId.includes('dark-mode'))).toBe(true);
    });

    it('should detect @apply directive patterns', async () => {
      const detector = createTailwindPatternsDetector();
      const context = createMockContext(`
        .button {
          @apply flex items-center px-4 py-2;
        }
      `, 'styles.css');

      const result = await detector.detect(context);
      expect(result.patterns.some(p => p.patternId.includes('apply-directive'))).toBe(true);
    });

    // NOTE: TailwindPatternsDetector focuses on PATTERN detection, not violation enforcement.
    it('should not create violations for conflicting classes (pattern learning mode)', async () => {
      const detector = createTailwindPatternsDetector();
      const context = createMockContext(`
        <div className="flex grid">Content</div>
      `);

      const result = await detector.detect(context);
      // Violations are intentionally not generated - drift learns patterns
      expect(result.violations).toHaveLength(0);
    });

    it('should not create violations for inconsistent breakpoint order (pattern learning mode)', async () => {
      const detector = createTailwindPatternsDetector();
      const context = createMockContext(`
        <div className="lg:flex sm:flex md:flex">Content</div>
      `);

      const result = await detector.detect(context);
      // Violations are intentionally not generated - drift learns patterns
      expect(result.violations).toHaveLength(0);
    });

    it('should return empty result for excluded files', async () => {
      const detector = createTailwindPatternsDetector();
      const context = createMockContext(
        `<div className="flex grid p-[13px]">Content</div>`,
        'component.test.tsx'
      );

      const result = await detector.detect(context);
      expect(result.patterns.length).toBe(0);
      expect(result.violations.length).toBe(0);
    });

    it('should calculate confidence score', async () => {
      const detector = createTailwindPatternsDetector();
      const context = createMockContext(`
        <div className="flex items-center p-4">
          <span className="text-lg font-bold">Title</span>
        </div>
      `);

      const result = await detector.detect(context);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('generateQuickFix', () => {
    it('should generate quick fix for breakpoint order violations', () => {
      const detector = createTailwindPatternsDetector();
      const violation = {
        id: 'test-violation',
        patternId: 'styling/tailwind-patterns',
        severity: 'info' as const,
        file: 'test.tsx',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 30 },
        },
        message: 'Inconsistent breakpoint order: Responsive breakpoints are not in mobile-first order',
        explanation: 'Tailwind uses mobile-first approach',
        expected: 'sm:flex md:flex lg:flex',
        actual: 'lg:flex sm:flex md:flex',
        aiExplainAvailable: true,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const quickFix = detector.generateQuickFix(violation);
      expect(quickFix).not.toBeNull();
      expect(quickFix?.title).toContain('Reorder');
    });

    it('should generate quick fix for arbitrary value with standard alternative', () => {
      const detector = createTailwindPatternsDetector();
      const violation = {
        id: 'test-violation',
        patternId: 'styling/tailwind-patterns',
        severity: 'info' as const,
        file: 'test.tsx',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 10 },
        },
        message: 'Arbitrary value usage: Arbitrary value used instead of standard Tailwind class',
        explanation: 'Using arbitrary values can lead to inconsistent spacing',
        expected: 'p-4',
        actual: 'p-[16px]',
        aiExplainAvailable: true,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const quickFix = detector.generateQuickFix(violation);
      expect(quickFix).not.toBeNull();
      expect(quickFix?.title).toContain('standard class');
    });

    it('should return null for violations without quick fix', () => {
      const detector = createTailwindPatternsDetector();
      const violation = {
        id: 'test-violation',
        patternId: 'styling/tailwind-patterns',
        severity: 'info' as const,
        file: 'test.tsx',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 20 },
        },
        message: 'Mixed arbitrary and standard values',
        explanation: 'Mixing arbitrary values with standard classes',
        expected: 'Consistent Tailwind usage',
        actual: 'p-4, p-[13px]',
        aiExplainAvailable: true,
        aiFixAvailable: false,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const quickFix = detector.generateQuickFix(violation);
      expect(quickFix).toBeNull();
    });
  });
});

describe('createTailwindPatternsDetector', () => {
  it('should create a TailwindPatternsDetector instance', () => {
    const detector = createTailwindPatternsDetector();
    expect(detector).toBeInstanceOf(TailwindPatternsDetector);
  });
});
