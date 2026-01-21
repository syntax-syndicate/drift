/**
 * ASP.NET Core Error Handling Detectors
 *
 * C#-specific error handling pattern detectors.
 */

export {
  ExceptionPatternsDetector,
  createExceptionPatternsDetector,
  type ExceptionPatternInfo,
  type ExceptionAnalysis,
} from './exception-patterns-detector.js';

export {
  ResultPatternDetector,
  createResultPatternDetector,
  type ResultPatternInfo,
  type ResultPatternAnalysis,
} from './result-pattern-detector.js';
