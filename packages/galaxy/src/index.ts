/**
 * Drift Galaxy
 * 
 * 3D database visualization package for Drift.
 * Renders databases as interactive space galaxies.
 * 
 * @packageDocumentation
 */

// Main canvas component
export { GalaxyCanvas } from './components/canvas/GalaxyCanvas.js';
export type { GalaxyCanvasProps } from './components/canvas/GalaxyCanvas.js';

// Store
export { useGalaxyStore } from './store/index.js';
export type { GalaxyStore, GalaxyStoreState, GalaxyStoreActions } from './store/galaxy-store.js';

// Selectors
export {
  useSelectedTable,
  useSelectedEntryPoint,
  useSelectedTablePaths,
  useFilteredTables,
  useFilteredPaths,
  useFilteredEntryPoints,
} from './store/galaxy-store.js';

// Hooks
export { useGalaxyData, useAccessStream } from './hooks/index.js';
export type { UseGalaxyDataOptions, RawGalaxyData, UseAccessStreamOptions } from './hooks/index.js';

// Types
export type {
  // Core types
  SensitivityLevel,
  SecurityTier,
  DataOperation,
  AuthLevel,
  ViewMode,
  Vector3D,
  // Node types
  TableNode,
  FieldNode,
  EntryPointNode,
  FunctionNode,
  // Connection types
  DataPath,
  TableRelationship,
  // State types
  GalaxyData,
  GalaxyStats,
  CameraState,
  SelectionState,
  FilterState,
  DisplaySettings,
  // Event types
  AccessEvent,
  GalaxyEvent,
  ViolationEvent,
  AlertEvent,
} from './types/index.js';

// Constants
export {
  SENSITIVITY_COLORS,
  SECURITY_TIER_COLORS,
  AUTH_LEVEL_COLORS,
  OPERATION_COLORS,
  CLUSTER_COLORS,
  TABLE_SIZE,
  FIELD_SIZE,
  ENTRY_POINT_SIZE,
  PATH_CONFIG,
  GALAXY_LAYOUT,
  CAMERA_CONFIG,
  BLOOM_CONFIG,
  PARTICLE_CONFIG,
  ANIMATION_CONFIG,
} from './constants/index.js';

// Utilities
export {
  // Color utils
  getSensitivityColor,
  getSensitivityThreeColor,
  getSecurityTierColor,
  getAuthLevelColor,
  getOperationColor,
  getClusterColor,
  getHealthScoreColor,
  // Geometry utils
  toThreeVector,
  fromThreeVector,
  distance,
  midpoint,
  generateCurvedPath,
  calculateTableSize,
  calculateFieldSize,
  calculatePathWidth,
  // Layout utils
  computeGalaxyLayout,
} from './utils/index.js';

// UI Components (for custom layouts)
export {
  DetailsPanel,
  SecurityPanel,
  ControlsPanel,
  SearchOverlay,
  StatsOverlay,
} from './components/ui/index.js';

// Individual 3D components (for advanced customization)
export { TablePlanet } from './components/nodes/TablePlanet.js';
export { FieldMoon } from './components/nodes/FieldMoon.js';
export { EntryPointStation } from './components/nodes/EntryPointStation.js';
export { DataPathLane } from './components/connections/DataPathLane.js';
export { StarField } from './components/effects/StarField.js';
export { GalaxyBloom } from './components/effects/GalaxyBloom.js';

// Audio
export {
  GalaxySoundEngine,
  getGalaxySoundEngine,
  createGalaxySoundEngine,
  useGalaxySound,
  useHoverSound,
  useSelectionSound,
  usePathSound,
} from './audio/index.js';
export type {
  SoundType,
  SoundConfig,
  UseGalaxySoundOptions,
  UseGalaxySoundReturn,
} from './audio/index.js';
