/**
 * Galaxy Audio Module
 *
 * Procedural sci-fi sound effects for the Galaxy visualization.
 */

export {
  GalaxySoundEngine,
  getGalaxySoundEngine,
  createGalaxySoundEngine,
  type SoundType,
  type SoundConfig,
} from './sound-effects.js';

export {
  useGalaxySound,
  useHoverSound,
  useSelectionSound,
  usePathSound,
  type UseGalaxySoundOptions,
  type UseGalaxySoundReturn,
} from './useGalaxySound.js';
