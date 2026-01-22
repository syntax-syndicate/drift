/**
 * Package Boundaries Detector Tests
 *
 * Tests for monorepo package boundary violation detection.
 *
 * @requirements 7.8 - THE Structural_Detector SHALL detect package boundary violations in monorepos
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import type { DetectionContext, ProjectContext } from '../base/base-detector.js';

// Dynamic import to avoid circular dependency issues
let packageBoundaries: typeof import('./package-boundaries.js');
let PackageBoundariesDetector: typeof packageBoundaries.PackageBoundariesDetector;
let createPackageBoundariesDetector: typeof packageBoundaries.createPackageBoundariesDetector;
let extractPackageName: typeof packageBoundaries.extractPackageName;
let isInternalImport: typeof packageBoundaries.isInternalImport;
let bypassesPublicApi: typeof packageBoundaries.bypassesPublicApi;
let detectMonorepoPackages: typeof packageBoundaries.detectMonorepoPackages;
let findPackageForFile: typeof packageBoundaries.findPackageForFile;
let resolveImportToPackage: typeof packageBoundaries.resolveImportToPackage;
let isDeclaredDependency: typeof packageBoundaries.isDeclaredDependency;
let analyzePackageBoundaries: typeof packageBoundaries.analyzePackageBoundaries;
let calculateViolationSeverity: typeof packageBoundaries.calculateViolationSeverity;
let COMMON_PACKAGE_PATTERNS: typeof packageBoundaries.COMMON_PACKAGE_PATTERNS;
let INTERNAL_PATH_PATTERNS: typeof packageBoundaries.INTERNAL_PATH_PATTERNS;

type PackageInfo = import('./package-boundaries.js').PackageInfo;
type MonorepoConfig = import('./package-boundaries.js').MonorepoConfig;

beforeAll(async () => {
  packageBoundaries = await import('./package-boundaries.js');
  PackageBoundariesDetector = packageBoundaries.PackageBoundariesDetector;
  createPackageBoundariesDetector = packageBoundaries.createPackageBoundariesDetector;
  extractPackageName = packageBoundaries.extractPackageName;
  isInternalImport = packageBoundaries.isInternalImport;
  bypassesPublicApi = packageBoundaries.bypassesPublicApi;
  detectMonorepoPackages = packageBoundaries.detectMonorepoPackages;
  findPackageForFile = packageBoundaries.findPackageForFile;
  resolveImportToPackage = packageBoundaries.resolveImportToPackage;
  isDeclaredDependency = packageBoundaries.isDeclaredDependency;
  analyzePackageBoundaries = packageBoundaries.analyzePackageBoundaries;
  calculateViolationSeverity = packageBoundaries.calculateViolationSeverity;
  COMMON_PACKAGE_PATTERNS = packageBoundaries.COMMON_PACKAGE_PATTERNS;
  INTERNAL_PATH_PATTERNS = packageBoundaries.INTERNAL_PATH_PATTERNS;
});

// ============================================================================
// Test Helpers
// ============================================================================

function createMockContext(
  file: string,
  content: string,
  projectFiles: string[],
  imports: Array<{ source: string; line: number }> = []
): DetectionContext {
  const projectContext: ProjectContext = {
    rootDir: '/project',
    files: projectFiles,
    config: {},
  };

  return {
    file,
    content,
    ast: null,
    imports: imports.map(imp => ({
      source: imp.source,
      module: imp.source,
      namedImports: [],
      isTypeOnly: false,
      sideEffectOnly: false,
      line: imp.line,
      column: 1,
    })),
    exports: [],
    projectContext,
    language: 'typescript',
    extension: '.ts',
    isTestFile: false,
    isTypeDefinition: false,
  };
}

function createMockPackage(
  name: string,
  path: string,
  dependencies: string[] = [],
  devDependencies: string[] = []
): PackageInfo {
  return {
    name,
    path,
    dependencies,
    devDependencies,
    peerDependencies: [],
  };
}

// ============================================================================
// extractPackageName Tests
// ============================================================================

describe('extractPackageName', () => {
  it('should extract scoped package names', () => {
    expect(extractPackageName('driftdetect-core')).toBe('driftdetect-core');
    expect(extractPackageName('driftdetect-core/utils')).toBe('driftdetect-core');
    expect(extractPackageName('@org/package/deep/path')).toBe('@org/package');
  });

  it('should extract regular package names', () => {
    expect(extractPackageName('lodash')).toBe('lodash');
    expect(extractPackageName('lodash/fp')).toBe('lodash');
    expect(extractPackageName('react-dom/client')).toBe('react-dom');
  });

  it('should return null for relative imports', () => {
    expect(extractPackageName('./utils')).toBeNull();
    expect(extractPackageName('../components')).toBeNull();
    expect(extractPackageName('/absolute/path')).toBeNull();
  });

  it('should handle edge cases', () => {
    expect(extractPackageName('@')).toBeNull();
    expect(extractPackageName('')).toBeNull();
  });
});

// ============================================================================
// isInternalImport Tests
// ============================================================================

describe('isInternalImport', () => {
  it('should detect /src/ path imports', () => {
    expect(isInternalImport('driftdetect-core/src/utils')).toBe(true);
    expect(isInternalImport('package-name/src/internal')).toBe(true);
  });

  it('should detect /lib/ path imports', () => {
    expect(isInternalImport('driftdetect-core/lib/utils')).toBe(true);
    expect(isInternalImport('package-name/lib/internal')).toBe(true);
  });

  it('should detect /dist/ path imports', () => {
    expect(isInternalImport('driftdetect-core/dist/utils')).toBe(true);
  });

  it('should detect /internal/ path imports', () => {
    expect(isInternalImport('driftdetect-core/internal/utils')).toBe(true);
    expect(isInternalImport('package/path/internal/module')).toBe(true);
  });

  it('should detect /private/ path imports', () => {
    expect(isInternalImport('driftdetect-core/private/utils')).toBe(true);
    expect(isInternalImport('package/_private/module')).toBe(true);
  });

  it('should not flag public API imports', () => {
    expect(isInternalImport('driftdetect-core')).toBe(false);
    expect(isInternalImport('driftdetect-core/utils')).toBe(false);
    expect(isInternalImport('lodash')).toBe(false);
    expect(isInternalImport('lodash/fp')).toBe(false);
  });

  it('should handle Windows-style paths', () => {
    expect(isInternalImport('driftdetect-core\\src\\utils')).toBe(true);
  });
});

// ============================================================================
// bypassesPublicApi Tests
// ============================================================================

describe('bypassesPublicApi', () => {
  it('should return false for direct package imports', () => {
    expect(bypassesPublicApi('driftdetect-core', 'driftdetect-core')).toBe(false);
    expect(bypassesPublicApi('lodash', 'lodash')).toBe(false);
  });

  it('should detect src/ path bypasses', () => {
    expect(bypassesPublicApi('driftdetect-core/src/utils', 'driftdetect-core')).toBe(true);
    expect(bypassesPublicApi('package/src/internal', 'package')).toBe(true);
  });

  it('should detect lib/ path bypasses', () => {
    expect(bypassesPublicApi('driftdetect-core/lib/utils', 'driftdetect-core')).toBe(true);
  });

  it('should detect internal/ path bypasses', () => {
    expect(bypassesPublicApi('driftdetect-core/internal/utils', 'driftdetect-core')).toBe(true);
    expect(bypassesPublicApi('driftdetect-core/some/internal/path', 'driftdetect-core')).toBe(true);
  });

  it('should allow explicit subpath exports', () => {
    // Subpaths like /utils are allowed (they could be explicit exports)
    expect(bypassesPublicApi('driftdetect-core/utils', 'driftdetect-core')).toBe(false);
    expect(bypassesPublicApi('lodash/fp', 'lodash')).toBe(false);
  });
});

// ============================================================================
// detectMonorepoPackages Tests
// ============================================================================

describe('detectMonorepoPackages', () => {
  it('should detect packages in packages/ directory', () => {
    const files = [
      'packages/core/src/index.ts',
      'packages/core/package.json',
      'packages/cli/src/index.ts',
      'packages/cli/package.json',
    ];

    const packages = detectMonorepoPackages(files);
    
    expect(packages.length).toBeGreaterThanOrEqual(2);
    expect(packages.some(p => p.path.includes('core'))).toBe(true);
    expect(packages.some(p => p.path.includes('cli'))).toBe(true);
  });

  it('should detect packages in apps/ directory', () => {
    const files = [
      'apps/web/src/index.ts',
      'apps/web/package.json',
      'apps/mobile/src/index.ts',
    ];

    const packages = detectMonorepoPackages(files);
    
    expect(packages.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect packages from package.json files', () => {
    const files = [
      'packages/core/package.json',
      'packages/utils/package.json',
      'libs/shared/package.json',
    ];

    const packages = detectMonorepoPackages(files);
    
    expect(packages.length).toBeGreaterThanOrEqual(3);
  });

  it('should use custom package patterns', () => {
    const files = [
      'modules/auth/src/index.ts',
      'modules/users/src/index.ts',
    ];

    const config: MonorepoConfig = {
      packagePatterns: ['modules/*'],
      allowInternalImports: false,
    };

    const packages = detectMonorepoPackages(files, config);
    
    expect(packages.length).toBeGreaterThanOrEqual(2);
  });

  it('should return empty array for non-monorepo projects', () => {
    const files = [
      'src/index.ts',
      'src/utils.ts',
      'package.json',
    ];

    const packages = detectMonorepoPackages(files);
    
    // May detect root package but not multiple packages
    expect(packages.length).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// findPackageForFile Tests
// ============================================================================

describe('findPackageForFile', () => {
  const packages: PackageInfo[] = [
    createMockPackage('driftdetect-core', 'packages/core'),
    createMockPackage('@drift/cli', 'packages/cli'),
    createMockPackage('@drift/utils', 'packages/utils'),
  ];

  it('should find the correct package for a file', () => {
    const result = findPackageForFile('packages/core/src/index.ts', packages);
    expect(result?.name).toBe('driftdetect-core');
  });

  it('should find package for deeply nested files', () => {
    const result = findPackageForFile('packages/cli/src/commands/init.ts', packages);
    expect(result?.name).toBe('@drift/cli');
  });

  it('should return null for files not in any package', () => {
    const result = findPackageForFile('src/index.ts', packages);
    expect(result).toBeNull();
  });

  it('should handle Windows-style paths', () => {
    const result = findPackageForFile('packages\\core\\src\\index.ts', packages);
    expect(result?.name).toBe('driftdetect-core');
  });

  it('should find the most specific package match', () => {
    const nestedPackages: PackageInfo[] = [
      createMockPackage('driftdetect-core', 'packages/core'),
      createMockPackage('driftdetect-core-utils', 'packages/core/utils'),
    ];

    const result = findPackageForFile('packages/core/utils/src/index.ts', nestedPackages);
    expect(result?.name).toBe('driftdetect-core-utils');
  });
});

// ============================================================================
// resolveImportToPackage Tests
// ============================================================================

describe('resolveImportToPackage', () => {
  const packages: PackageInfo[] = [
    createMockPackage('driftdetect-core', 'packages/core'),
    createMockPackage('@drift/cli', 'packages/cli'),
  ];

  it('should resolve package imports by name', () => {
    const result = resolveImportToPackage(
      'driftdetect-core',
      'packages/cli/src/index.ts',
      packages
    );
    expect(result?.name).toBe('driftdetect-core');
  });

  it('should resolve relative imports to packages', () => {
    const result = resolveImportToPackage(
      '../../core/src/utils',
      'packages/cli/src/index.ts',
      packages
    );
    expect(result?.name).toBe('driftdetect-core');
  });

  it('should return null for external packages', () => {
    const result = resolveImportToPackage(
      'lodash',
      'packages/cli/src/index.ts',
      packages
    );
    expect(result).toBeNull();
  });

  it('should handle package imports with subpaths', () => {
    const result = resolveImportToPackage(
      'driftdetect-core/utils',
      'packages/cli/src/index.ts',
      packages
    );
    expect(result?.name).toBe('driftdetect-core');
  });
});

// ============================================================================
// isDeclaredDependency Tests
// ============================================================================

describe('isDeclaredDependency', () => {
  it('should return true for declared dependencies', () => {
    const pkg = createMockPackage('@drift/cli', 'packages/cli', ['driftdetect-core']);
    expect(isDeclaredDependency('driftdetect-core', pkg)).toBe(true);
  });

  it('should return true for declared devDependencies', () => {
    const pkg = createMockPackage('@drift/cli', 'packages/cli', [], ['vitest']);
    expect(isDeclaredDependency('vitest', pkg)).toBe(true);
  });

  it('should return true for declared peerDependencies', () => {
    const pkg: PackageInfo = {
      ...createMockPackage('@drift/cli', 'packages/cli'),
      peerDependencies: ['react'],
    };
    expect(isDeclaredDependency('react', pkg)).toBe(true);
  });

  it('should return false for undeclared dependencies', () => {
    const pkg = createMockPackage('@drift/cli', 'packages/cli', ['driftdetect-core']);
    expect(isDeclaredDependency('@drift/utils', pkg)).toBe(false);
  });
});

// ============================================================================
// calculateViolationSeverity Tests
// ============================================================================

describe('calculateViolationSeverity', () => {
  it('should return error for internal-import violations', () => {
    expect(calculateViolationSeverity('internal-import')).toBe('error');
  });

  it('should return error for undeclared-dependency violations', () => {
    expect(calculateViolationSeverity('undeclared-dependency')).toBe('error');
  });

  it('should return warning for bypass-public-api violations', () => {
    expect(calculateViolationSeverity('bypass-public-api')).toBe('warning');
  });

  it('should return warning for hierarchy-violation violations', () => {
    expect(calculateViolationSeverity('hierarchy-violation')).toBe('warning');
  });
});

// ============================================================================
// analyzePackageBoundaries Tests
// ============================================================================

describe('analyzePackageBoundaries', () => {
  it('should detect internal import violations when package names match', () => {
    const projectFiles = [
      'packages/core/src/index.ts',
      'packages/core/src/internal/utils.ts',
      'packages/cli/src/index.ts',
      'packages/core/package.json',
      'packages/cli/package.json',
    ];

    // Use the package name format that detectMonorepoPackages generates
    // The function derives names from directory structure: @monorepo/core
    const imports = [
      { source: '@monorepo/core/src/internal/utils', line: 1 },
    ];

    const result = analyzePackageBoundaries(
      'packages/cli/src/index.ts',
      imports,
      projectFiles
    );

    expect(result.isInMonorepo).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]?.type).toBe('internal-import');
  });

  it('should detect public API bypass violations', () => {
    const projectFiles = [
      'packages/core/src/index.ts',
      'packages/cli/src/index.ts',
      'packages/core/package.json',
      'packages/cli/package.json',
    ];

    // Use the package name format that detectMonorepoPackages generates
    const imports = [
      { source: '@monorepo/core/src/utils', line: 1 },
    ];

    const result = analyzePackageBoundaries(
      'packages/cli/src/index.ts',
      imports,
      projectFiles
    );

    expect(result.violations.length).toBeGreaterThan(0);
    const violation = result.violations.find(v => 
      v.type === 'internal-import' || v.type === 'bypass-public-api'
    );
    expect(violation).toBeDefined();
  });

  it('should allow valid public API imports', () => {
    const projectFiles = [
      'packages/core/src/index.ts',
      'packages/cli/src/index.ts',
      'packages/core/package.json',
      'packages/cli/package.json',
    ];

    // Use the package name format that detectMonorepoPackages generates
    const imports = [
      { source: '@monorepo/core', line: 1 },
    ];

    const result = analyzePackageBoundaries(
      'packages/cli/src/index.ts',
      imports,
      projectFiles
    );

    // Should not have violations for proper public API usage
    const internalViolations = result.violations.filter(v => 
      v.type === 'internal-import' || v.type === 'bypass-public-api'
    );
    expect(internalViolations.length).toBe(0);
  });

  it('should detect relative imports crossing package boundaries', () => {
    const projectFiles = [
      'packages/core/src/index.ts',
      'packages/core/src/utils.ts',
      'packages/cli/src/index.ts',
      'packages/core/package.json',
      'packages/cli/package.json',
    ];

    const imports = [
      { source: '../../core/src/utils', line: 1 },
    ];

    const result = analyzePackageBoundaries(
      'packages/cli/src/index.ts',
      imports,
      projectFiles
    );

    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]?.type).toBe('bypass-public-api');
  });

  it('should return empty analysis for non-monorepo projects', () => {
    const projectFiles = [
      'src/index.ts',
      'src/utils.ts',
    ];

    const imports = [
      { source: './utils', line: 1 },
    ];

    const result = analyzePackageBoundaries(
      'src/index.ts',
      imports,
      projectFiles
    );

    expect(result.isInMonorepo).toBe(false);
    expect(result.violations.length).toBe(0);
  });

  it('should skip external package imports', () => {
    const projectFiles = [
      'packages/core/src/index.ts',
      'packages/core/package.json',
    ];

    const imports = [
      { source: 'lodash', line: 1 },
      { source: 'react', line: 2 },
    ];

    const result = analyzePackageBoundaries(
      'packages/core/src/index.ts',
      imports,
      projectFiles
    );

    // External packages should not cause violations
    expect(result.violations.length).toBe(0);
  });

  it('should skip same-package imports', () => {
    const projectFiles = [
      'packages/core/src/index.ts',
      'packages/core/src/utils.ts',
      'packages/core/package.json',
    ];

    const imports = [
      { source: './utils', line: 1 },
    ];

    const result = analyzePackageBoundaries(
      'packages/core/src/index.ts',
      imports,
      projectFiles
    );

    // Same-package imports should not cause violations
    expect(result.violations.length).toBe(0);
  });
});

// ============================================================================
// PackageBoundariesDetector Class Tests
// ============================================================================

describe('PackageBoundariesDetector', () => {
  let detector: InstanceType<typeof PackageBoundariesDetector>;

  beforeEach(() => {
    detector = createPackageBoundariesDetector();
  });

  describe('metadata', () => {
    it('should have correct id', () => {
      expect(detector.id).toBe('structural/package-boundaries');
    });

    it('should have correct category', () => {
      expect(detector.category).toBe('structural');
    });

    it('should have correct subcategory', () => {
      expect(detector.subcategory).toBe('package-boundaries');
    });

    it('should support TypeScript and JavaScript', () => {
      expect(detector.supportedLanguages).toContain('typescript');
      expect(detector.supportedLanguages).toContain('javascript');
    });

    it('should have structural detection method', () => {
      expect(detector.detectionMethod).toBe('structural');
    });
  });

  describe('detect', () => {
    it('should detect internal import violations', async () => {
      const projectFiles = [
        'packages/core/src/index.ts',
        'packages/core/src/internal/utils.ts',
        'packages/cli/src/index.ts',
        'packages/core/package.json',
        'packages/cli/package.json',
      ];

      // Use the package name format that detectMonorepoPackages generates
      const content = `
import { internalUtil } from '@monorepo/core/src/internal/utils';

export function main() {
  internalUtil();
}
`;

      const context = createMockContext(
        'packages/cli/src/index.ts',
        content,
        projectFiles,
        [{ source: '@monorepo/core/src/internal/utils', line: 2 }]
      );

      const result = await detector.detect(context);

      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]?.severity).toBe('error');
    });

    it('should not report violations for valid imports', async () => {
      const projectFiles = [
        'packages/core/src/index.ts',
        'packages/cli/src/index.ts',
        'packages/core/package.json',
        'packages/cli/package.json',
      ];

      // Use the package name format that detectMonorepoPackages generates
      const content = `
import { util } from '@monorepo/core';

export function main() {
  util();
}
`;

      const context = createMockContext(
        'packages/cli/src/index.ts',
        content,
        projectFiles,
        [{ source: '@monorepo/core', line: 2 }]
      );

      const result = await detector.detect(context);

      // Should not have internal import violations
      const internalViolations = result.violations.filter(v => 
        v.patternId.includes('internal-import') || v.patternId.includes('bypass-public-api')
      );
      expect(internalViolations.length).toBe(0);
    });

    it('should return empty result for files with no imports', async () => {
      const projectFiles = [
        'packages/core/src/index.ts',
        'packages/core/package.json',
      ];

      const content = `
export const VERSION = '1.0.0';
`;

      const context = createMockContext(
        'packages/core/src/index.ts',
        content,
        projectFiles,
        []
      );

      const result = await detector.detect(context);

      expect(result.patterns.length).toBe(0);
      expect(result.violations.length).toBe(0);
    });

    it('should return empty result for non-monorepo projects', async () => {
      const projectFiles = [
        'src/index.ts',
        'src/utils.ts',
      ];

      const content = `
import { util } from './utils';

export function main() {
  util();
}
`;

      const context = createMockContext(
        'src/index.ts',
        content,
        projectFiles,
        [{ source: './utils', line: 2 }]
      );

      const result = await detector.detect(context);

      expect(result.violations.length).toBe(0);
    });

    it('should parse imports from content when not provided in context', async () => {
      const projectFiles = [
        'packages/core/src/index.ts',
        'packages/cli/src/index.ts',
        'packages/core/package.json',
        'packages/cli/package.json',
      ];

      // Use the package name format that detectMonorepoPackages generates
      const content = `
import { util } from '@monorepo/core/src/internal';
import type { Type } from '@monorepo/core';

export function main() {
  util();
}
`;

      const context = createMockContext(
        'packages/cli/src/index.ts',
        content,
        projectFiles,
        [] // No imports provided, should parse from content
      );

      const result = await detector.detect(context);

      // Should detect the internal import violation
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('generateQuickFix', () => {
    it('should generate quick fix for internal import violations', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'structural/package-boundaries-internal-import',
        severity: 'error' as const,
        file: 'packages/cli/src/index.ts',
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 50 },
        },
        message: 'Import from internal path',
        expected: "Use public API: import from 'driftdetect-core'",
        actual: "Import from 'driftdetect-core/src/internal'",
        aiExplainAvailable: true,
        aiFixAvailable: true,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const quickFix = detector.generateQuickFix(violation);

      expect(quickFix).not.toBeNull();
      expect(quickFix?.kind).toBe('quickfix');
      expect(quickFix?.isPreferred).toBe(true);
    });

    it('should generate quick fix for undeclared dependency violations', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'structural/package-boundaries-undeclared-dependency',
        severity: 'error' as const,
        file: 'packages/cli/src/index.ts',
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 50 },
        },
        message: 'Undeclared dependency',
        expected: 'Declare dependency in package.json',
        actual: "Import from '@drift/utils'",
        aiExplainAvailable: true,
        aiFixAvailable: false,
        firstSeen: new Date(),
        occurrences: 1,
      };

      const quickFix = detector.generateQuickFix(violation);

      expect(quickFix).not.toBeNull();
      expect(quickFix?.title).toContain('dependencies');
    });

    it('should return null for non-package-boundary violations', () => {
      const violation = {
        id: 'test-violation',
        patternId: 'some-other-pattern',
        severity: 'warning' as const,
        file: 'src/index.ts',
        range: {
          start: { line: 1, character: 0 },
          end: { line: 1, character: 50 },
        },
        message: 'Some other violation',
        expected: 'Something',
        actual: 'Something else',
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
// Constants Tests
// ============================================================================

describe('COMMON_PACKAGE_PATTERNS', () => {
  it('should include packages/* pattern', () => {
    expect(COMMON_PACKAGE_PATTERNS).toContain('packages/*');
  });

  it('should include apps/* pattern', () => {
    expect(COMMON_PACKAGE_PATTERNS).toContain('apps/*');
  });

  it('should include libs/* pattern', () => {
    expect(COMMON_PACKAGE_PATTERNS).toContain('libs/*');
  });
});

describe('INTERNAL_PATH_PATTERNS', () => {
  it('should include /src/ pattern', () => {
    expect(INTERNAL_PATH_PATTERNS).toContain('/src/');
  });

  it('should include /internal/ pattern', () => {
    expect(INTERNAL_PATH_PATTERNS).toContain('/internal/');
  });

  it('should include /private/ pattern', () => {
    expect(INTERNAL_PATH_PATTERNS).toContain('/private/');
  });
});
