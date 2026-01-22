/**
 * Galaxy Constants
 * 
 * Centralized configuration for colors, sizes, and visual parameters.
 * All values are tuned for optimal visual clarity and performance.
 */

import type { SensitivityLevel, SecurityTier, AuthLevel, DataOperation } from '../types/index.js';

// ============================================================================
// Color Palettes
// ============================================================================

/**
 * Sensitivity level colors (hex)
 * Designed for dark background with high contrast
 */
export const SENSITIVITY_COLORS: Record<SensitivityLevel, string> = {
  critical: '#ff3366',   // Bright red-pink (credentials, secrets)
  high: '#ff9933',       // Orange (financial, health)
  medium: '#ffcc00',     // Yellow (PII)
  low: '#33ccff',        // Cyan (internal)
  public: '#66ff99',     // Green (safe)
} as const;

/**
 * Sensitivity level emissive intensity (glow strength)
 */
export const SENSITIVITY_EMISSIVE: Record<SensitivityLevel, number> = {
  critical: 0.8,
  high: 0.6,
  medium: 0.4,
  low: 0.2,
  public: 0.1,
} as const;

/**
 * Security tier colors
 */
export const SECURITY_TIER_COLORS: Record<SecurityTier, string> = {
  P0: '#ff0000',  // Red - Critical
  P1: '#ff6600',  // Orange - High
  P2: '#ffcc00',  // Yellow - Medium
  P3: '#66ccff',  // Light blue - Low
  P4: '#99ff99',  // Light green - Minimal
} as const;

/**
 * Authentication level colors for entry points
 */
export const AUTH_LEVEL_COLORS: Record<AuthLevel, string> = {
  public: '#ff3333',        // Red - Dangerous
  authenticated: '#ffcc00', // Yellow - Caution
  admin: '#33cc33',         // Green - Protected
  internal: '#3366ff',      // Blue - Internal only
} as const;

/**
 * Data operation colors for paths
 */
export const OPERATION_COLORS: Record<DataOperation, string> = {
  read: '#33ccff',    // Cyan - Read
  write: '#ff9933',   // Orange - Write
  delete: '#ff3366',  // Red - Delete
  unknown: '#999999', // Gray - Unknown
} as const;

// ============================================================================
// Size Constants
// ============================================================================

/**
 * Table (planet) size configuration
 */
export const TABLE_SIZE = {
  /** Minimum radius */
  MIN_RADIUS: 0.5,
  /** Maximum radius */
  MAX_RADIUS: 3.0,
  /** Base radius for average tables */
  BASE_RADIUS: 1.0,
  /** Scale factor for row count */
  ROW_COUNT_SCALE: 0.0001,
  /** Scale factor for access frequency */
  ACCESS_SCALE: 0.01,
} as const;

/**
 * Field (moon) size configuration
 */
export const FIELD_SIZE = {
  /** Base radius */
  RADIUS: 0.15,
  /** Orbit radius from parent table */
  ORBIT_RADIUS: 2.0,
  /** Orbit speed (radians per second) */
  ORBIT_SPEED: 0.5,
  /** Sensitive field scale multiplier */
  SENSITIVE_SCALE: 1.5,
} as const;

/**
 * Entry point (space station) size configuration
 */
export const ENTRY_POINT_SIZE = {
  /** Base scale */
  SCALE: 0.8,
  /** Distance from galaxy center */
  ORBIT_RADIUS: 50,
  /** Height variation */
  HEIGHT_VARIANCE: 10,
} as const;

/**
 * Data path (hyperspace lane) configuration
 */
export const PATH_CONFIG = {
  /** Base line width */
  BASE_WIDTH: 0.05,
  /** Max line width */
  MAX_WIDTH: 0.3,
  /** Curve segments */
  CURVE_SEGMENTS: 50,
  /** Animation speed */
  FLOW_SPEED: 2.0,
  /** Dash size */
  DASH_SIZE: 0.5,
  /** Gap size */
  GAP_SIZE: 0.3,
} as const;

// ============================================================================
// Layout Constants
// ============================================================================

/**
 * Galaxy layout configuration
 */
export const GALAXY_LAYOUT = {
  /** Galaxy radius */
  RADIUS: 40,
  /** Vertical spread */
  HEIGHT: 15,
  /** Cluster separation */
  CLUSTER_SEPARATION: 20,
  /** Minimum distance between tables */
  MIN_TABLE_DISTANCE: 5,
  /** Force simulation iterations */
  SIMULATION_ITERATIONS: 300,
  /** Force strength */
  FORCE_STRENGTH: -30,
  /** Link distance */
  LINK_DISTANCE: 10,
} as const;

/**
 * Camera configuration
 */
export const CAMERA_CONFIG = {
  /** Default position */
  DEFAULT_POSITION: { x: 0, y: 30, z: 60 } as const,
  /** Default target */
  DEFAULT_TARGET: { x: 0, y: 0, z: 0 } as const,
  /** Field of view */
  FOV: 60,
  /** Near clipping plane */
  NEAR: 0.1,
  /** Far clipping plane */
  FAR: 1000,
  /** Zoom limits */
  MIN_ZOOM: 0.5,
  MAX_ZOOM: 5,
  /** Pan limits */
  PAN_LIMIT: 100,
  /** Rotation speed */
  ROTATION_SPEED: 0.5,
  /** Zoom speed */
  ZOOM_SPEED: 1.2,
  /** Animation duration (ms) */
  ANIMATION_DURATION: 1000,
} as const;

// ============================================================================
// Visual Effects
// ============================================================================

/**
 * Bloom effect configuration
 */
export const BLOOM_CONFIG = {
  /** Intensity */
  INTENSITY: 1.5,
  /** Luminance threshold */
  LUMINANCE_THRESHOLD: 0.2,
  /** Luminance smoothing */
  LUMINANCE_SMOOTHING: 0.9,
  /** Blur passes */
  BLUR_PASSES: 5,
} as const;

/**
 * Particle effect configuration
 */
export const PARTICLE_CONFIG = {
  /** Star field count */
  STAR_COUNT: 5000,
  /** Star size */
  STAR_SIZE: 0.1,
  /** Access pulse duration (ms) */
  PULSE_DURATION: 500,
  /** Trail length */
  TRAIL_LENGTH: 20,
} as const;

/**
 * Animation configuration
 */
export const ANIMATION_CONFIG = {
  /** Hover scale */
  HOVER_SCALE: 1.2,
  /** Selection scale */
  SELECTION_SCALE: 1.3,
  /** Pulse frequency (Hz) */
  PULSE_FREQUENCY: 2,
  /** Rotation speed for idle animation */
  IDLE_ROTATION: 0.001,
  /** Transition duration (ms) */
  TRANSITION_DURATION: 300,
} as const;

// ============================================================================
// UI Constants
// ============================================================================

/**
 * Tooltip configuration
 */
export const TOOLTIP_CONFIG = {
  /** Offset from cursor */
  OFFSET: { x: 15, y: 15 },
  /** Show delay (ms) */
  SHOW_DELAY: 200,
  /** Hide delay (ms) */
  HIDE_DELAY: 100,
  /** Max width */
  MAX_WIDTH: 300,
} as const;

/**
 * Label configuration
 */
export const LABEL_CONFIG = {
  /** Font size */
  FONT_SIZE: 12,
  /** Font family */
  FONT_FAMILY: 'Inter, system-ui, sans-serif',
  /** Background opacity */
  BG_OPACITY: 0.8,
  /** Padding */
  PADDING: 4,
  /** Distance from node */
  OFFSET: 0.5,
  /** Fade distance */
  FADE_DISTANCE: 30,
} as const;

// ============================================================================
// Performance Constants
// ============================================================================

/**
 * Performance thresholds
 */
export const PERFORMANCE_CONFIG = {
  /** Max visible tables before LOD kicks in */
  MAX_DETAILED_TABLES: 50,
  /** Max visible paths before simplification */
  MAX_DETAILED_PATHS: 200,
  /** Max visible fields */
  MAX_VISIBLE_FIELDS: 500,
  /** Frame rate target */
  TARGET_FPS: 60,
  /** Frustum culling margin */
  CULLING_MARGIN: 1.5,
  /** LOD distance thresholds */
  LOD_DISTANCES: [20, 50, 100] as const,
} as const;

// ============================================================================
// Cluster Names (Domain Groupings)
// ============================================================================

/**
 * Common domain clusters for auto-grouping tables
 */
export const DOMAIN_CLUSTERS = {
  auth: ['users', 'accounts', 'sessions', 'tokens', 'permissions', 'roles'],
  commerce: ['orders', 'products', 'carts', 'payments', 'invoices', 'subscriptions'],
  content: ['posts', 'comments', 'media', 'files', 'documents', 'attachments'],
  messaging: ['messages', 'notifications', 'emails', 'chats', 'threads'],
  analytics: ['events', 'logs', 'metrics', 'analytics', 'tracking'],
  config: ['settings', 'preferences', 'configurations', 'features', 'flags'],
} as const;

/**
 * Cluster colors
 */
export const CLUSTER_COLORS: Record<string, string> = {
  auth: '#ff6b6b',
  commerce: '#4ecdc4',
  content: '#45b7d1',
  messaging: '#96ceb4',
  analytics: '#dda0dd',
  config: '#98d8c8',
  other: '#7f8c8d',
} as const;
