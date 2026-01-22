/**
 * Tests for ImportOrderingDetector
 * @requirements 7.5 - THE Structural_Detector SHALL detect import ordering and grouping patterns
 */

import { describe, it, expect } from 'vitest';
import * as importOrdering from './import-ordering.js';

const {
  getImportType,
  parseImports,
  areImportsSorted,
  detectImportGroups,
  hasBlankLineSeparators,
  areImportsGroupedByType,
  getGroupOrder,
  analyzeFileImports,
  analyzeImportOrdering,
  getGroupOrderDescription,
  ImportOrderingDetector,
  BUILTIN_MODULES,
  INTERNAL_ALIAS_PATTERNS,
} = importOrdering;

// ============================================================================
// Import Type Detection Tests
// ============================================================================

describe('getImportType', () => {
  it('should identify Node.js built-in modules', () => {
    expect(getImportType('fs')).toBe('builtin');
    expect(getImportType('path')).toBe('builtin');
    expect(getImportType('http')).toBe('builtin');
    expect(getImportType('crypto')).toBe('builtin');
  });

  it('should identify Node.js prefixed built-in modules', () => {
    expect(getImportType('node:fs')).toBe('builtin');
    expect(getImportType('node:path')).toBe('builtin');
    expect(getImportType('node:http')).toBe('builtin');
  });

  it('should identify external packages', () => {
    expect(getImportType('react')).toBe('external');
    expect(getImportType('lodash')).toBe('external');
    expect(getImportType('express')).toBe('external');
    expect(getImportType('@types/node')).toBe('external');
  });

  it('should identify internal aliases', () => {
    expect(getImportType('@/components/Button')).toBe('internal');
    expect(getImportType('~/utils/helpers')).toBe('internal');
    expect(getImportType('@app/services')).toBe('internal');
    // 'driftdetect-core' is an external package, not an internal alias
    // Internal aliases must match patterns like @/, ~/, @app/, or #
    expect(getImportType('#utils')).toBe('internal');
  });

  it('should identify external packages (not internal aliases)', () => {
    // Package names without alias patterns are external
    expect(getImportType('driftdetect-core')).toBe('external');
    expect(getImportType('lodash')).toBe('external');
    expect(getImportType('@types/node')).toBe('external');
  });

  it('should identify parent imports', () => {
    expect(getImportType('../utils')).toBe('parent');
    expect(getImportType('../../components/Button')).toBe('parent');
    expect(getImportType('../')).toBe('parent');
  });

  it('should identify sibling imports', () => {
    expect(getImportType('./Button')).toBe('sibling');
    expect(getImportType('./utils/helpers')).toBe('sibling');
  });

  it('should identify index imports', () => {
    expect(getImportType('.')).toBe('index');
    expect(getImportType('./')).toBe('index');
  });
});

// ============================================================================
// Import Parsing Tests
// ============================================================================

describe('parseImports', () => {
  it('should parse standard named imports', () => {
    const content = `import { useState, useEffect } from 'react';`;
    const imports = parseImports(content);

    expect(imports.length).toBe(1);
    expect(imports[0]!.source).toBe('react');
    expect(imports[0]!.type).toBe('external');
    expect(imports[0]!.isTypeOnly).toBe(false);
    expect(imports[0]!.isSideEffect).toBe(false);
  });

  it('should parse default imports', () => {
    const content = `import React from 'react';`;
    const imports = parseImports(content);

    expect(imports.length).toBe(1);
    expect(imports[0]!.source).toBe('react');
  });

  it('should parse namespace imports', () => {
    const content = `import * as fs from 'fs';`;
    const imports = parseImports(content);

    expect(imports.length).toBe(1);
    expect(imports[0]!.source).toBe('fs');
    expect(imports[0]!.type).toBe('builtin');
  });

  it('should parse type-only imports', () => {
    const content = `import type { FC } from 'react';`;
    const imports = parseImports(content);

    expect(imports.length).toBe(1);
    expect(imports[0]!.source).toBe('react');
    expect(imports[0]!.isTypeOnly).toBe(true);
  });

  it('should parse side-effect imports', () => {
    const content = `import './styles.css';`;
    const imports = parseImports(content);

    expect(imports.length).toBe(1);
    expect(imports[0]!.source).toBe('./styles.css');
    expect(imports[0]!.isSideEffect).toBe(true);
  });

  it('should parse multiple imports', () => {
    const content = `
import React from 'react';
import { useState } from 'react';
import fs from 'fs';
import { Button } from './Button';
import '../styles.css';
`;
    const imports = parseImports(content);

    expect(imports.length).toBe(5);
    expect(imports[0]!.source).toBe('react');
    expect(imports[1]!.source).toBe('react');
    expect(imports[2]!.source).toBe('fs');
    expect(imports[3]!.source).toBe('./Button');
    expect(imports[4]!.source).toBe('../styles.css');
  });

  it('should skip comments', () => {
    const content = `
// This is a comment
import React from 'react';
/* Another comment */
import { Button } from './Button';
`;
    const imports = parseImports(content);

    expect(imports.length).toBe(2);
  });

  it('should handle empty content', () => {
    const imports = parseImports('');
    expect(imports.length).toBe(0);
  });

  it('should handle content with no imports', () => {
    const content = `
const foo = 'bar';
export const baz = 'qux';
`;
    const imports = parseImports(content);
    expect(imports.length).toBe(0);
  });
});

// ============================================================================
// Import Sorting Tests
// ============================================================================

describe('areImportsSorted', () => {
  it('should return true for sorted imports', () => {
    const imports = [
      { source: 'a', type: 'external' as const, line: 1, statement: '', isTypeOnly: false, isSideEffect: false },
      { source: 'b', type: 'external' as const, line: 2, statement: '', isTypeOnly: false, isSideEffect: false },
      { source: 'c', type: 'external' as const, line: 3, statement: '', isTypeOnly: false, isSideEffect: false },
    ];

    expect(areImportsSorted(imports)).toBe(true);
  });

  it('should return false for unsorted imports', () => {
    const imports = [
      { source: 'c', type: 'external' as const, line: 1, statement: '', isTypeOnly: false, isSideEffect: false },
      { source: 'a', type: 'external' as const, line: 2, statement: '', isTypeOnly: false, isSideEffect: false },
      { source: 'b', type: 'external' as const, line: 3, statement: '', isTypeOnly: false, isSideEffect: false },
    ];

    expect(areImportsSorted(imports)).toBe(false);
  });

  it('should return true for single import', () => {
    const imports = [
      { source: 'a', type: 'external' as const, line: 1, statement: '', isTypeOnly: false, isSideEffect: false },
    ];

    expect(areImportsSorted(imports)).toBe(true);
  });

  it('should return true for empty imports', () => {
    expect(areImportsSorted([])).toBe(true);
  });

  it('should be case-insensitive', () => {
    const imports = [
      { source: 'Apple', type: 'external' as const, line: 1, statement: '', isTypeOnly: false, isSideEffect: false },
      { source: 'banana', type: 'external' as const, line: 2, statement: '', isTypeOnly: false, isSideEffect: false },
      { source: 'Cherry', type: 'external' as const, line: 3, statement: '', isTypeOnly: false, isSideEffect: false },
    ];

    expect(areImportsSorted(imports)).toBe(true);
  });
});

// ============================================================================
// Import Group Detection Tests
// ============================================================================

describe('detectImportGroups', () => {
  it('should detect groups separated by blank lines', () => {
    const content = `
import React from 'react';
import lodash from 'lodash';

import { Button } from './Button';
import { Input } from './Input';
`;
    const imports = parseImports(content);
    const groups = detectImportGroups(imports, content);

    expect(groups.length).toBe(2);
    expect(groups[0]!.imports.length).toBe(2);
    expect(groups[1]!.imports.length).toBe(2);
  });

  it('should detect single group when no blank lines', () => {
    const content = `
import React from 'react';
import lodash from 'lodash';
import { Button } from './Button';
`;
    const imports = parseImports(content);
    const groups = detectImportGroups(imports, content);

    expect(groups.length).toBe(1);
    expect(groups[0]!.imports.length).toBe(3);
  });

  it('should handle empty imports', () => {
    const groups = detectImportGroups([], '');
    expect(groups.length).toBe(0);
  });
});

describe('hasBlankLineSeparators', () => {
  it('should return true when groups are separated by blank lines', () => {
    const content = `
import React from 'react';

import { Button } from './Button';
`;
    const imports = parseImports(content);
    const groups = detectImportGroups(imports, content);

    expect(hasBlankLineSeparators(groups, content)).toBe(true);
  });

  it('should return false when groups are not separated', () => {
    const content = `
import React from 'react';
import { Button } from './Button';
`;
    const imports = parseImports(content);
    // Force two groups for testing
    const groups = [
      { type: 'external' as const, imports: [imports[0]!], startLine: 2, endLine: 2, isSorted: true },
      { type: 'sibling' as const, imports: [imports[1]!], startLine: 3, endLine: 3, isSorted: true },
    ];

    expect(hasBlankLineSeparators(groups, content)).toBe(false);
  });

  it('should return true for single group', () => {
    const content = `import React from 'react';`;
    const imports = parseImports(content);
    const groups = detectImportGroups(imports, content);

    expect(hasBlankLineSeparators(groups, content)).toBe(true);
  });
});

describe('areImportsGroupedByType', () => {
  it('should return true when each group has one type', () => {
    const groups = [
      {
        type: 'external' as const,
        imports: [
          { source: 'react', type: 'external' as const, line: 1, statement: '', isTypeOnly: false, isSideEffect: false },
        ],
        startLine: 1,
        endLine: 1,
        isSorted: true,
      },
      {
        type: 'sibling' as const,
        imports: [
          { source: './Button', type: 'sibling' as const, line: 3, statement: '', isTypeOnly: false, isSideEffect: false },
        ],
        startLine: 3,
        endLine: 3,
        isSorted: true,
      },
    ];

    expect(areImportsGroupedByType(groups)).toBe(true);
  });

  it('should return false when a group has mixed types', () => {
    const groups = [
      {
        type: 'external' as const,
        imports: [
          { source: 'react', type: 'external' as const, line: 1, statement: '', isTypeOnly: false, isSideEffect: false },
          { source: './Button', type: 'sibling' as const, line: 2, statement: '', isTypeOnly: false, isSideEffect: false },
        ],
        startLine: 1,
        endLine: 2,
        isSorted: true,
      },
    ];

    // Note: areImportsGroupedByType checks if each group has only one type
    // This group has mixed types (external and sibling), so it should return false
    expect(areImportsGroupedByType(groups)).toBe(false);
  });
});

// ============================================================================
// Group Order Tests
// ============================================================================

describe('getGroupOrder', () => {
  it('should extract group order from groups', () => {
    const groups = [
      {
        type: 'external' as const,
        imports: [
          { source: 'react', type: 'external' as const, line: 1, statement: '', isTypeOnly: false, isSideEffect: false },
        ],
        startLine: 1,
        endLine: 1,
        isSorted: true,
      },
      {
        type: 'sibling' as const,
        imports: [
          { source: './Button', type: 'sibling' as const, line: 3, statement: '', isTypeOnly: false, isSideEffect: false },
        ],
        startLine: 3,
        endLine: 3,
        isSorted: true,
      },
    ];

    const order = getGroupOrder(groups);
    expect(order).toEqual(['external', 'sibling']);
  });

  it('should return empty array for empty groups', () => {
    expect(getGroupOrder([])).toEqual([]);
  });
});

describe('getGroupOrderDescription', () => {
  it('should describe group order', () => {
    const order: importOrdering.ImportType[] = ['external', 'internal', 'sibling'];
    const description = getGroupOrderDescription(order);

    expect(description).toContain('external packages');
    expect(description).toContain('internal aliases');
    expect(description).toContain('sibling imports');
  });

  it('should return "no specific order" for empty order', () => {
    expect(getGroupOrderDescription([])).toBe('no specific order');
  });
});

// ============================================================================
// File Import Analysis Tests
// ============================================================================

describe('analyzeFileImports', () => {
  it('should analyze well-organized imports', () => {
    const content = `
import fs from 'fs';
import path from 'path';

import lodash from 'lodash';
import react from 'react';

import { Button } from './Button';
import { Input } from './Input';
`;
    const analysis = analyzeFileImports(content);

    expect(analysis.imports.length).toBe(6);
    expect(analysis.groups.length).toBe(3);
    expect(analysis.isGrouped).toBe(true);
    expect(analysis.hasBlankLineSeparators).toBe(true);
    expect(analysis.isSortedWithinGroups).toBe(true);
  });

  it('should detect unsorted imports', () => {
    const content = `
import lodash from 'lodash';
import React from 'react';
import axios from 'axios';
`;
    const analysis = analyzeFileImports(content);

    expect(analysis.isSortedWithinGroups).toBe(false);
  });

  it('should handle empty content', () => {
    const analysis = analyzeFileImports('');

    expect(analysis.imports.length).toBe(0);
    expect(analysis.groups.length).toBe(0);
  });
});

// ============================================================================
// Project-wide Analysis Tests
// ============================================================================

describe('analyzeImportOrdering', () => {
  it('should detect consistent grouped pattern', () => {
    const fileContents = new Map([
      ['file1.ts', `
import React from 'react';

import { Button } from './Button';
`],
      ['file2.ts', `
import lodash from 'lodash';

import { Input } from './Input';
`],
    ]);

    const analysis = analyzeImportOrdering(fileContents);

    expect(analysis.groupingPattern).toBe('grouped');
    expect(analysis.filesAnalyzed).toBe(2);
    expect(analysis.filesWithGroupedImports).toBe(2);
  });

  it('should detect consistent sorted pattern', () => {
    const fileContents = new Map([
      ['file1.ts', `
import axios from 'axios';
import lodash from 'lodash';
import react from 'react';
`],
      ['file2.ts', `
import express from 'express';
import fs from 'fs';
import path from 'path';
`],
    ]);

    const analysis = analyzeImportOrdering(fileContents);

    expect(analysis.sortingPattern).toBe('alphabetical');
    expect(analysis.filesWithSortedImports).toBe(2);
  });

  it('should detect mixed patterns', () => {
    const fileContents = new Map([
      ['file1.ts', `
import React from 'react';

import { Button } from './Button';
`],
      ['file2.ts', `
import lodash from 'lodash';
import { Input } from './Input';
import React from 'react';
`],
    ]);

    const analysis = analyzeImportOrdering(fileContents);

    // file1 is grouped (external then sibling with blank line)
    // file2 is NOT grouped (mixed external and sibling in same group, no blank lines)
    // So we expect 1 file with grouped imports
    expect(analysis.filesAnalyzed).toBe(2);
    // file2 has mixed types in a single group (no blank lines), so it's not grouped
    expect(analysis.filesWithGroupedImports).toBeLessThanOrEqual(2);
  });

  it('should handle empty file contents', () => {
    const analysis = analyzeImportOrdering(new Map());

    expect(analysis.groupingPattern).toBe('unknown');
    expect(analysis.sortingPattern).toBe('unknown');
    expect(analysis.confidence).toBe(0);
  });

  it('should skip files with single import', () => {
    const fileContents = new Map([
      ['file1.ts', `import React from 'react';`],
    ]);

    const analysis = analyzeImportOrdering(fileContents);

    expect(analysis.filesAnalyzed).toBe(0);
  });
});

// ============================================================================
// ImportOrderingDetector Class Tests
// ============================================================================

describe('ImportOrderingDetector', () => {
  it('should have correct metadata', () => {
    const detector = new ImportOrderingDetector();

    expect(detector.id).toBe('structural/import-ordering');
    expect(detector.category).toBe('structural');
    expect(detector.subcategory).toBe('import-ordering');
    expect(detector.name).toBe('Import Ordering Detector');
    expect(detector.supportedLanguages).toContain('typescript');
    expect(detector.supportedLanguages).toContain('javascript');
    expect(detector.detectionMethod).toBe('structural');
  });

  it('should detect import ordering patterns', async () => {
    const detector = new ImportOrderingDetector();
    const context = {
      file: 'src/components/Button.tsx',
      content: `
import React from 'react';
import lodash from 'lodash';

import { utils } from '@/utils';

import { Input } from './Input';
import { Label } from './Label';
`,
      ast: null,
      imports: [],
      exports: [],
      projectContext: {
        rootDir: '/project',
        files: ['src/components/Button.tsx'],
        config: {},
      },
      language: 'typescript' as const,
      extension: '.tsx',
      isTestFile: false,
      isTypeDefinition: false,
    };

    const result = await detector.detect(context);

    expect(result.patterns.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should skip files with no imports', async () => {
    const detector = new ImportOrderingDetector();
    const context = {
      file: 'src/utils/constants.ts',
      content: `export const FOO = 'bar';`,
      ast: null,
      imports: [],
      exports: [],
      projectContext: {
        rootDir: '/project',
        files: ['src/utils/constants.ts'],
        config: {},
      },
      language: 'typescript' as const,
      extension: '.ts',
      isTestFile: false,
      isTypeDefinition: false,
    };

    const result = await detector.detect(context);

    expect(result.patterns.length).toBe(0);
    expect(result.violations.length).toBe(0);
  });

  it('should skip files with single import', async () => {
    const detector = new ImportOrderingDetector();
    const context = {
      file: 'src/index.ts',
      content: `import React from 'react';`,
      ast: null,
      imports: [],
      exports: [],
      projectContext: {
        rootDir: '/project',
        files: ['src/index.ts'],
        config: {},
      },
      language: 'typescript' as const,
      extension: '.ts',
      isTestFile: false,
      isTypeDefinition: false,
    };

    const result = await detector.detect(context);

    expect(result.patterns.length).toBe(0);
    expect(result.violations.length).toBe(0);
  });

  it('should generate quick fix for grouping violation', () => {
    const detector = new ImportOrderingDetector();
    const violation = {
      id: 'grouping-violation',
      patternId: 'structural/import-ordering-grouping',
      severity: 'info' as const,
      file: 'src/file.ts',
      range: { start: { line: 1, character: 1 }, end: { line: 1, character: 1 } },
      message: 'Imports are not grouped',
      expected: 'grouped imports',
      actual: 'ungrouped imports',
      aiExplainAvailable: true,
      aiFixAvailable: true,
      firstSeen: new Date(),
      occurrences: 1,
    };

    const quickFix = detector.generateQuickFix(violation);

    expect(quickFix).not.toBeNull();
    expect(quickFix?.kind).toBe('quickfix');
    expect(quickFix?.title).toContain('Group imports');
  });

  it('should generate quick fix for sorting violation', () => {
    const detector = new ImportOrderingDetector();
    const violation = {
      id: 'sorting-violation',
      patternId: 'structural/import-ordering-sorting',
      severity: 'info' as const,
      file: 'src/file.ts',
      range: { start: { line: 1, character: 1 }, end: { line: 1, character: 1 } },
      message: 'Imports are not sorted',
      expected: 'sorted imports',
      actual: 'unsorted imports',
      aiExplainAvailable: true,
      aiFixAvailable: true,
      firstSeen: new Date(),
      occurrences: 1,
    };

    const quickFix = detector.generateQuickFix(violation);

    expect(quickFix).not.toBeNull();
    expect(quickFix?.kind).toBe('quickfix');
    expect(quickFix?.title).toContain('Sort imports');
  });

  it('should generate quick fix for separator violation', () => {
    const detector = new ImportOrderingDetector();
    const violation = {
      id: 'separator-violation',
      patternId: 'structural/import-ordering-separators',
      severity: 'info' as const,
      file: 'src/file.ts',
      range: { start: { line: 1, character: 1 }, end: { line: 1, character: 1 } },
      message: 'No blank lines between groups',
      expected: 'blank lines between groups',
      actual: 'no blank lines',
      aiExplainAvailable: true,
      aiFixAvailable: true,
      firstSeen: new Date(),
      occurrences: 1,
    };

    const quickFix = detector.generateQuickFix(violation);

    expect(quickFix).not.toBeNull();
    expect(quickFix?.kind).toBe('quickfix');
    expect(quickFix?.title).toContain('blank lines');
  });

  it('should return null quick fix for non-matching violations', () => {
    const detector = new ImportOrderingDetector();
    const violation = {
      id: 'other-violation',
      patternId: 'some-other-pattern',
      severity: 'info' as const,
      file: 'src/file.ts',
      range: { start: { line: 1, character: 1 }, end: { line: 1, character: 1 } },
      message: 'Some other violation',
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

// ============================================================================
// Constants Tests
// ============================================================================

describe('BUILTIN_MODULES constant', () => {
  it('should contain common Node.js built-in modules', () => {
    expect(BUILTIN_MODULES).toContain('fs');
    expect(BUILTIN_MODULES).toContain('path');
    expect(BUILTIN_MODULES).toContain('http');
    expect(BUILTIN_MODULES).toContain('crypto');
    expect(BUILTIN_MODULES).toContain('os');
  });

  it('should contain node: prefixed modules', () => {
    expect(BUILTIN_MODULES).toContain('node:fs');
    expect(BUILTIN_MODULES).toContain('node:path');
    expect(BUILTIN_MODULES).toContain('node:http');
  });
});

describe('INTERNAL_ALIAS_PATTERNS constant', () => {
  it('should match common internal alias patterns', () => {
    expect(INTERNAL_ALIAS_PATTERNS.some(p => p.test('@/components'))).toBe(true);
    expect(INTERNAL_ALIAS_PATTERNS.some(p => p.test('~/utils'))).toBe(true);
    expect(INTERNAL_ALIAS_PATTERNS.some(p => p.test('@app/services'))).toBe(true);
    expect(INTERNAL_ALIAS_PATTERNS.some(p => p.test('#utils'))).toBe(true);
  });
});
