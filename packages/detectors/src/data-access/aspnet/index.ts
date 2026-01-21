/**
 * ASP.NET Core Data Access Detectors
 *
 * C#-specific data access pattern detectors.
 */

export {
  EfCorePatternsDetector,
  createEfCorePatternsDetector,
  type EfCorePatternInfo,
  type EfCoreAnalysis,
} from './efcore-patterns-detector.js';

export {
  RepositoryPatternDetector,
  createRepositoryPatternDetector,
  type RepositoryPatternInfo,
  type RepositoryAnalysis,
} from './repository-pattern-detector.js';
