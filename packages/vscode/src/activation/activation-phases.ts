/**
 * Activation phases configuration
 * 
 * Single responsibility: Define activation phase order and timing.
 */

import type { ActivationPhase } from '../types/index.js';

/**
 * Phase configuration
 */
export interface PhaseConfig {
  name: string;
  phase: ActivationPhase;
  timeout: number;
  critical: boolean;
}

/**
 * Activation phases in order
 */
export const ActivationPhases: PhaseConfig[] = [
  // Immediate phase - must complete before activate() returns
  {
    name: 'infrastructure',
    phase: 'immediate',
    timeout: 50,
    critical: true,
  },
  {
    name: 'state',
    phase: 'immediate',
    timeout: 50,
    critical: true,
  },
  {
    name: 'config',
    phase: 'immediate',
    timeout: 50,
    critical: true,
  },
  {
    name: 'statusBar',
    phase: 'immediate',
    timeout: 50,
    critical: false,
  },

  // Deferred phase - runs after activate() returns
  {
    name: 'connection',
    phase: 'deferred',
    timeout: 10000,
    critical: true,
  },
  {
    name: 'commands',
    phase: 'deferred',
    timeout: 100,
    critical: true,
  },
  {
    name: 'decorations',
    phase: 'deferred',
    timeout: 100,
    critical: false,
  },

  // Lazy phase - activated on demand
  {
    name: 'treeViews',
    phase: 'lazy',
    timeout: 500,
    critical: false,
  },
  {
    name: 'webviews',
    phase: 'lazy',
    timeout: 500,
    critical: false,
  },
];

/**
 * Get phases by type
 */
export function getPhasesByType(type: ActivationPhase): PhaseConfig[] {
  return ActivationPhases.filter(p => p.phase === type);
}

/**
 * Get critical phases
 */
export function getCriticalPhases(): PhaseConfig[] {
  return ActivationPhases.filter(p => p.critical);
}
