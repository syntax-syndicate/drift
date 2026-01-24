import { defineWorkspace } from 'vitest/config';

/**
 * Vitest workspace configuration for the Drift monorepo.
 * This enables running tests across all packages with a single command.
 */
export default defineWorkspace([
  // Core package
  {
    extends: './vitest.config.ts',
    test: {
      name: '@drift/core',
      root: './packages/core',
      include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    },
  },

  // Detectors package
  {
    extends: './vitest.config.ts',
    test: {
      name: '@drift/detectors',
      root: './packages/detectors',
      include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    },
  },

  // LSP package
  {
    extends: './vitest.config.ts',
    test: {
      name: '@drift/lsp',
      root: './packages/lsp',
      include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    },
  },

  // CLI package
  {
    extends: './vitest.config.ts',
    test: {
      name: '@drift/cli',
      root: './packages/cli',
      include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    },
  },

  // AI package
  {
    extends: './vitest.config.ts',
    test: {
      name: '@drift/ai',
      root: './packages/ai',
      include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    },
  },

  // VS Code extension package
  {
    extends: './vitest.config.ts',
    test: {
      name: '@drift/vscode',
      root: './packages/vscode',
      include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    },
  },

  // Dashboard package
  {
    extends: './vitest.config.ts',
    test: {
      name: '@drift/dashboard',
      root: './packages/dashboard',
      include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx', 'tests/**/*.{test,spec}.ts'],
    },
  },

  // MCP package
  {
    extends: './vitest.config.ts',
    test: {
      name: '@drift/mcp',
      root: './packages/mcp',
      include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    },
  },
]);
