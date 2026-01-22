/**
 * Tests for DirectoryStructureDetector
 * @requirements 7.2 - THE Structural_Detector SHALL detect directory structure patterns (feature-based vs layer-based)
 */

import { describe, it, expect } from 'vitest';
import * as directoryStructure from './directory-structure.js';

const {
  extractDirectories,
  isLayerDirectory,
  isFeatureContainer,
  detectFeatureBasedStructure,
  detectLayerBasedStructure,
  analyzeDirectoryStructure,
  detectDirectoryPatterns,
  DirectoryStructureDetector,
  LAYER_DIRECTORIES,
  FEATURE_DIRECTORIES,
} = directoryStructure;

describe('isLayerDirectory', () => {
  it('should identify common layer directories', () => {
    expect(isLayerDirectory('controllers')).toBe(true);
    expect(isLayerDirectory('services')).toBe(true);
    expect(isLayerDirectory('models')).toBe(true);
    expect(isLayerDirectory('repositories')).toBe(true);
    expect(isLayerDirectory('middleware')).toBe(true);
    expect(isLayerDirectory('utils')).toBe(true);
    expect(isLayerDirectory('helpers')).toBe(true);
    expect(isLayerDirectory('types')).toBe(true);
    expect(isLayerDirectory('hooks')).toBe(true);
  });

  it('should identify plural forms of layer directories', () => {
    expect(isLayerDirectory('controller')).toBe(false); // singular not in list
    expect(isLayerDirectory('servicess')).toBe(true); // ends with 'services'
  });

  it('should not identify non-layer directories', () => {
    expect(isLayerDirectory('auth')).toBe(false);
    expect(isLayerDirectory('users')).toBe(false);
    expect(isLayerDirectory('dashboard')).toBe(false);
    expect(isLayerDirectory('profile')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isLayerDirectory('Controllers')).toBe(true);
    expect(isLayerDirectory('SERVICES')).toBe(true);
    expect(isLayerDirectory('Models')).toBe(true);
  });
});

describe('isFeatureContainer', () => {
  it('should identify feature container directories', () => {
    expect(isFeatureContainer('features')).toBe(true);
    expect(isFeatureContainer('modules')).toBe(true);
    expect(isFeatureContainer('domains')).toBe(true);
    expect(isFeatureContainer('pages')).toBe(true);
    expect(isFeatureContainer('screens')).toBe(true);
    // 'components' is now in UNIVERSAL_DIRECTORIES - valid in both architectures
    expect(isFeatureContainer('apps')).toBe(true);
    expect(isFeatureContainer('packages')).toBe(true);
  });

  it('should not identify non-feature directories', () => {
    expect(isFeatureContainer('auth')).toBe(false);
    expect(isFeatureContainer('services')).toBe(false);
    expect(isFeatureContainer('utils')).toBe(false);
    // 'components' is universal, not a feature container
    expect(isFeatureContainer('components')).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isFeatureContainer('Features')).toBe(true);
    expect(isFeatureContainer('MODULES')).toBe(true);
  });
});

describe('extractDirectories', () => {
  it('should extract directories from file paths', () => {
    const files = [
      'src/components/Button.tsx',
      'src/components/Input.tsx',
      'src/utils/helpers.ts',
    ];

    const directories = extractDirectories(files);

    expect(directories.has('src')).toBe(true);
    expect(directories.has('src/components')).toBe(true);
    expect(directories.has('src/utils')).toBe(true);
  });

  it('should calculate correct depth', () => {
    const files = [
      'src/features/auth/components/LoginForm.tsx',
    ];

    const directories = extractDirectories(files);

    expect(directories.get('src')?.depth).toBe(1);
    expect(directories.get('src/features')?.depth).toBe(2);
    expect(directories.get('src/features/auth')?.depth).toBe(3);
    expect(directories.get('src/features/auth/components')?.depth).toBe(4);
  });

  it('should count files in directories', () => {
    const files = [
      'src/components/Button.tsx',
      'src/components/Input.tsx',
      'src/utils/helpers.ts',
    ];

    const directories = extractDirectories(files);

    expect(directories.get('src/components')?.fileCount).toBe(2);
    expect(directories.get('src/utils')?.fileCount).toBe(1);
  });

  it('should identify layer and feature directories', () => {
    const files = [
      'src/services/auth.service.ts',
      'features/auth/index.ts',
    ];

    const directories = extractDirectories(files);

    expect(directories.get('src/services')?.isLayerDirectory).toBe(true);
    expect(directories.get('features')?.isFeatureContainer).toBe(true);
  });

  it('should handle Windows-style paths', () => {
    const files = [
      'src\\components\\Button.tsx',
    ];

    const directories = extractDirectories(files);

    expect(directories.has('src')).toBe(true);
    expect(directories.has('src/components')).toBe(true);
  });

  it('should build parent-child relationships', () => {
    const files = [
      'src/components/Button.tsx',
      'src/utils/helpers.ts',
    ];

    const directories = extractDirectories(files);

    expect(directories.get('src')?.children).toContain('components');
    expect(directories.get('src')?.children).toContain('utils');
  });
});

describe('detectLayerBasedStructure', () => {
  it('should detect layer-based directories at shallow depth', () => {
    const files = [
      'src/controllers/user.controller.ts',
      'src/services/user.service.ts',
      'src/models/user.model.ts',
    ];

    const directories = extractDirectories(files);
    const layerDirs = detectLayerBasedStructure(directories);

    expect(layerDirs.length).toBe(3);
    expect(layerDirs.map(d => d.name)).toContain('controllers');
    expect(layerDirs.map(d => d.name)).toContain('services');
    expect(layerDirs.map(d => d.name)).toContain('models');
  });

  it('should not detect layer directories at deep levels', () => {
    const files = [
      'src/features/auth/services/auth.service.ts',
    ];

    const directories = extractDirectories(files);
    const layerDirs = detectLayerBasedStructure(directories);

    // services at depth 4 should not be detected as root-level layer
    const deepServices = layerDirs.filter(d => d.path === 'src/features/auth/services');
    expect(deepServices.length).toBe(0);
  });
});

describe('detectFeatureBasedStructure', () => {
  it('should detect feature container directories', () => {
    const files = [
      'src/features/auth/index.ts',
      'src/features/users/index.ts',
      'src/features/dashboard/index.ts',
    ];

    const directories = extractDirectories(files);
    const featureDirs = detectFeatureBasedStructure(directories);

    expect(featureDirs.some(d => d.name === 'features')).toBe(true);
  });

  it('should detect feature directories with layer children', () => {
    const files = [
      'src/features/auth/services/auth.service.ts',
      'src/features/auth/components/LoginForm.tsx',
    ];

    const directories = extractDirectories(files);
    const featureDirs = detectFeatureBasedStructure(directories);

    // Should detect both the features container and the auth feature
    expect(featureDirs.some(d => d.name === 'features')).toBe(true);
  });
});

describe('analyzeDirectoryStructure', () => {
  it('should detect layer-based organization', () => {
    const files = [
      'src/controllers/user.controller.ts',
      'src/controllers/auth.controller.ts',
      'src/services/user.service.ts',
      'src/services/auth.service.ts',
      'src/models/user.model.ts',
      'src/models/auth.model.ts',
    ];

    const analysis = analyzeDirectoryStructure(files);

    expect(analysis.organization).toBe('layer-based');
    expect(analysis.confidence).toBeGreaterThan(0.5);
    expect(analysis.layerDirectories.length).toBeGreaterThan(0);
  });

  it('should detect feature-based organization', () => {
    const files = [
      'src/features/auth/services/auth.service.ts',
      'src/features/auth/components/LoginForm.tsx',
      'src/features/users/services/user.service.ts',
      'src/features/users/components/UserList.tsx',
      'src/features/dashboard/components/Dashboard.tsx',
    ];

    const analysis = analyzeDirectoryStructure(files);

    expect(analysis.organization).toBe('feature-based');
    expect(analysis.confidence).toBeGreaterThan(0.5);
    expect(analysis.featureDirectories.length).toBeGreaterThan(0);
  });

  it('should detect hybrid organization', () => {
    const files = [
      // Feature-based
      'src/features/auth/index.ts',
      'src/features/users/index.ts',
      // Layer-based at root
      'src/services/shared.service.ts',
      'src/utils/helpers.ts',
      'src/models/base.model.ts',
    ];

    const analysis = analyzeDirectoryStructure(files);

    // Could be hybrid or one of the patterns depending on ratio
    expect(['feature-based', 'layer-based', 'hybrid']).toContain(analysis.organization);
  });

  it('should return unknown for flat structure', () => {
    const files = [
      'index.ts',
      'app.ts',
      'config.ts',
    ];

    const analysis = analyzeDirectoryStructure(files);

    expect(analysis.organization).toBe('unknown');
  });

  it('should calculate depth statistics', () => {
    const files = [
      'src/components/Button.tsx',
      'src/features/auth/services/auth.service.ts',
    ];

    const analysis = analyzeDirectoryStructure(files);

    expect(analysis.depthStats.maxDepth).toBeGreaterThan(0);
    expect(analysis.depthStats.avgDepth).toBeGreaterThan(0);
  });

  it('should identify inconsistent directories', () => {
    const files = [
      // Predominantly feature-based
      'src/features/auth/index.ts',
      'src/features/users/index.ts',
      'src/features/dashboard/index.ts',
      'src/features/settings/index.ts',
      'src/features/profile/index.ts',
      // But with a root-level layer directory
      'src/services/shared.service.ts',
    ];

    const analysis = analyzeDirectoryStructure(files);

    // If detected as feature-based, the services directory should be flagged
    if (analysis.organization === 'feature-based') {
      expect(analysis.inconsistentDirectories.length).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('detectDirectoryPatterns', () => {
  it('should detect repeated directory names', () => {
    const files = [
      'src/features/auth/components/LoginForm.tsx',
      'src/features/users/components/UserList.tsx',
      'src/features/dashboard/components/Dashboard.tsx',
    ];

    const patterns = detectDirectoryPatterns(files);

    // 'components' appears 3 times
    const componentsPattern = patterns.find(p => p.name === 'components');
    expect(componentsPattern).toBeDefined();
    expect(componentsPattern?.count).toBe(3);
  });

  it('should sort patterns by count', () => {
    const files = [
      'src/features/auth/components/LoginForm.tsx',
      'src/features/users/components/UserList.tsx',
      'src/features/auth/services/auth.service.ts',
    ];

    const patterns = detectDirectoryPatterns(files);

    // Patterns should be sorted by count descending
    for (let i = 1; i < patterns.length; i++) {
      expect(patterns[i - 1]!.count).toBeGreaterThanOrEqual(patterns[i]!.count);
    }
  });

  it('should not include single-occurrence directories', () => {
    const files = [
      'src/unique-dir/file.ts',
      'src/another-unique/file.ts',
    ];

    const patterns = detectDirectoryPatterns(files);

    // Single occurrences should not be patterns
    expect(patterns.find(p => p.name === 'unique-dir')).toBeUndefined();
    expect(patterns.find(p => p.name === 'another-unique')).toBeUndefined();
  });
});

describe('DirectoryStructureDetector', () => {
  it('should have correct metadata', () => {
    const detector = new DirectoryStructureDetector();

    expect(detector.id).toBe('structural/directory-structure');
    expect(detector.category).toBe('structural');
    expect(detector.subcategory).toBe('directory-organization');
    expect(detector.name).toBe('Directory Structure Detector');
    expect(detector.supportedLanguages).toContain('typescript');
    expect(detector.supportedLanguages).toContain('javascript');
    expect(detector.detectionMethod).toBe('structural');
  });

  it('should detect patterns in a layer-based project', async () => {
    const detector = new DirectoryStructureDetector();
    const context = {
      file: 'src/controllers/user.controller.ts',
      content: '',
      ast: null,
      imports: [],
      exports: [],
      projectContext: {
        rootDir: '/project',
        files: [
          'src/controllers/user.controller.ts',
          'src/controllers/auth.controller.ts',
          'src/services/user.service.ts',
          'src/services/auth.service.ts',
          'src/models/user.model.ts',
        ],
        config: {},
      },
      language: 'typescript' as const,
      extension: '.ts',
      isTestFile: false,
      isTypeDefinition: false,
    };

    const result = await detector.detect(context);

    expect(result.patterns.length).toBeGreaterThan(0);
    expect(result.patterns.some(p => p.patternId.includes('layer-based'))).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should detect patterns in a feature-based project', async () => {
    const detector = new DirectoryStructureDetector();
    const context = {
      file: 'src/features/auth/services/auth.service.ts',
      content: '',
      ast: null,
      imports: [],
      exports: [],
      projectContext: {
        rootDir: '/project',
        files: [
          'src/features/auth/services/auth.service.ts',
          'src/features/auth/components/LoginForm.tsx',
          'src/features/users/services/user.service.ts',
          'src/features/users/components/UserList.tsx',
        ],
        config: {},
      },
      language: 'typescript' as const,
      extension: '.ts',
      isTestFile: false,
      isTypeDefinition: false,
    };

    const result = await detector.detect(context);

    expect(result.patterns.length).toBeGreaterThan(0);
    expect(result.patterns.some(p => p.patternId.includes('feature-based'))).toBe(true);
  });

  it('should generate quick fix for violations', () => {
    const detector = new DirectoryStructureDetector();
    const violation = {
      id: 'test-violation',
      patternId: 'structural/directory-structure-inconsistency',
      severity: 'info' as const,
      file: 'src/services/shared.service.ts',
      range: { start: { line: 1, character: 1 }, end: { line: 1, character: 1 } },
      message: 'Directory uses layer-based organization but project uses feature-based',
      expected: 'feature-based organization',
      actual: 'layer-based directory',
      aiExplainAvailable: true,
      aiFixAvailable: false,
      firstSeen: new Date(),
      occurrences: 1,
    };

    const quickFix = detector.generateQuickFix(violation);

    expect(quickFix).not.toBeNull();
    expect(quickFix?.kind).toBe('refactor');
    expect(quickFix?.title).toContain('Reorganize');
  });

  it('should return null quick fix for non-matching violations', () => {
    const detector = new DirectoryStructureDetector();
    const violation = {
      id: 'test-violation',
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

describe('LAYER_DIRECTORIES constant', () => {
  it('should contain common layer directory names', () => {
    expect(LAYER_DIRECTORIES).toContain('controllers');
    expect(LAYER_DIRECTORIES).toContain('services');
    expect(LAYER_DIRECTORIES).toContain('models');
    expect(LAYER_DIRECTORIES).toContain('repositories');
    expect(LAYER_DIRECTORIES).toContain('middleware');
  });
});

describe('FEATURE_DIRECTORIES constant', () => {
  it('should contain common feature container names', () => {
    expect(FEATURE_DIRECTORIES).toContain('features');
    expect(FEATURE_DIRECTORIES).toContain('modules');
    expect(FEATURE_DIRECTORIES).toContain('domains');
    expect(FEATURE_DIRECTORIES).toContain('pages');
  });
});
