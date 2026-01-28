/**
 * CIBench v2 Calibration Scorer
 * 
 * Measures how well-calibrated a tool's confidence estimates are.
 * A well-calibrated tool should be right 80% of the time when it says 80% confident.
 * 
 * Key metrics:
 * - ECE (Expected Calibration Error): Average calibration error across bins
 * - MCE (Maximum Calibration Error): Worst-case calibration error
 * - Brier Score: Proper scoring rule for probabilistic predictions
 */

import type { CalibrationResult, CalibrationBin } from './types.js';

// ============================================================================
// Calibration Calculation
// ============================================================================

export interface CalibrationSample {
  /** Predicted confidence (0-1) */
  confidence: number;
  
  /** Was the prediction correct? */
  correct: boolean;
  
  /** Category (for stratified analysis) */
  category?: string;
}

/**
 * Calculate calibration metrics from samples
 */
export function calculateCalibration(
  samples: CalibrationSample[],
  numBins: number = 10
): CalibrationResult {
  if (samples.length === 0) {
    return {
      ece: 0,
      mce: 0,
      brierScore: 0,
      bins: [],
      reliabilityDiagram: { confidence: [], accuracy: [], samples: [] },
    };
  }
  
  // Create bins
  const binWidth = 1.0 / numBins;
  const bins: CalibrationBin[] = [];
  
  for (let i = 0; i < numBins; i++) {
    const min = i * binWidth;
    const max = (i + 1) * binWidth;
    
    const binSamples = samples.filter(
      s => s.confidence >= min && s.confidence < max
    );
    
    if (binSamples.length > 0) {
      const avgConfidence = binSamples.reduce((sum, s) => sum + s.confidence, 0) / binSamples.length;
      const accuracy = binSamples.filter(s => s.correct).length / binSamples.length;
      const error = Math.abs(accuracy - avgConfidence);
      
      bins.push({
        range: { min, max },
        samples: binSamples.length,
        avgConfidence,
        accuracy,
        error,
      });
    }
  }
  
  // Calculate ECE (weighted by bin size)
  const totalSamples = samples.length;
  const ece = bins.reduce(
    (sum, bin) => sum + (bin.samples / totalSamples) * bin.error,
    0
  );
  
  // Calculate MCE
  const mce = bins.length > 0 ? Math.max(...bins.map(b => b.error)) : 0;
  
  // Calculate Brier Score
  const brierScore = samples.reduce(
    (sum, s) => sum + Math.pow(s.confidence - (s.correct ? 1 : 0), 2),
    0
  ) / samples.length;
  
  // Build reliability diagram data
  const reliabilityDiagram = {
    confidence: bins.map(b => b.avgConfidence),
    accuracy: bins.map(b => b.accuracy),
    samples: bins.map(b => b.samples),
  };
  
  return {
    ece,
    mce,
    brierScore,
    bins,
    reliabilityDiagram,
  };
}

/**
 * Calculate calibration score (0-100, higher is better)
 * 
 * Score = 100 * (1 - ECE)
 * 
 * A perfectly calibrated model has ECE = 0, score = 100
 * A maximally miscalibrated model has ECE = 1, score = 0
 */
export function calibrationScore(calibration: CalibrationResult): number {
  return 100 * (1 - calibration.ece);
}

// ============================================================================
// Overconfidence / Underconfidence Analysis
// ============================================================================

export interface ConfidenceAnalysis {
  /** Rate of overconfident predictions */
  overconfidenceRate: number;
  
  /** Rate of underconfident predictions */
  underconfidenceRate: number;
  
  /** Average overconfidence magnitude */
  avgOverconfidence: number;
  
  /** Average underconfidence magnitude */
  avgUnderconfidence: number;
  
  /** Samples where confidence was appropriate */
  appropriateConfidenceRate: number;
}

/**
 * Analyze confidence patterns
 * 
 * Overconfidence: High confidence but wrong
 * Underconfidence: Low confidence but right
 */
export function analyzeConfidence(
  samples: CalibrationSample[],
  threshold: number = 0.1
): ConfidenceAnalysis {
  if (samples.length === 0) {
    return {
      overconfidenceRate: 0,
      underconfidenceRate: 0,
      avgOverconfidence: 0,
      avgUnderconfidence: 0,
      appropriateConfidenceRate: 1,
    };
  }
  
  let overconfident = 0;
  let underconfident = 0;
  let overconfidenceSum = 0;
  let underconfidenceSum = 0;
  let appropriate = 0;
  
  for (const sample of samples) {
    const expectedAccuracy = sample.correct ? 1 : 0;
    const gap = sample.confidence - expectedAccuracy;
    
    if (gap > threshold) {
      // Overconfident: predicted high confidence but was wrong
      overconfident++;
      overconfidenceSum += gap;
    } else if (gap < -threshold) {
      // Underconfident: predicted low confidence but was right
      underconfident++;
      underconfidenceSum += Math.abs(gap);
    } else {
      appropriate++;
    }
  }
  
  return {
    overconfidenceRate: overconfident / samples.length,
    underconfidenceRate: underconfident / samples.length,
    avgOverconfidence: overconfident > 0 ? overconfidenceSum / overconfident : 0,
    avgUnderconfidence: underconfident > 0 ? underconfidenceSum / underconfident : 0,
    appropriateConfidenceRate: appropriate / samples.length,
  };
}

// ============================================================================
// Stratified Calibration
// ============================================================================

/**
 * Calculate calibration stratified by category
 */
export function stratifiedCalibration(
  samples: CalibrationSample[],
  numBins: number = 10
): Map<string, CalibrationResult> {
  const byCategory = new Map<string, CalibrationSample[]>();
  
  for (const sample of samples) {
    const category = sample.category ?? 'default';
    const existing = byCategory.get(category) ?? [];
    existing.push(sample);
    byCategory.set(category, existing);
  }
  
  const results = new Map<string, CalibrationResult>();
  
  for (const [category, categorySamples] of byCategory) {
    results.set(category, calculateCalibration(categorySamples, numBins));
  }
  
  return results;
}

// ============================================================================
// Calibration Comparison
// ============================================================================

export interface CalibrationComparison {
  /** Tool A calibration */
  toolA: CalibrationResult;
  
  /** Tool B calibration */
  toolB: CalibrationResult;
  
  /** ECE difference (positive = A is better) */
  eceDifference: number;
  
  /** Statistical significance */
  significant: boolean;
  
  /** Winner */
  winner: 'A' | 'B' | 'tie';
}

/**
 * Compare calibration between two tools
 */
export function compareCalibration(
  samplesA: CalibrationSample[],
  samplesB: CalibrationSample[],
  significanceThreshold: number = 0.05
): CalibrationComparison {
  const calibA = calculateCalibration(samplesA);
  const calibB = calculateCalibration(samplesB);
  
  const eceDiff = calibB.ece - calibA.ece; // Positive = A is better
  
  // Simple significance test (could be improved with bootstrap)
  const significant = Math.abs(eceDiff) > significanceThreshold;
  
  let winner: 'A' | 'B' | 'tie' = 'tie';
  if (significant) {
    winner = eceDiff > 0 ? 'A' : 'B';
  }
  
  return {
    toolA: calibA,
    toolB: calibB,
    eceDifference: eceDiff,
    significant,
    winner,
  };
}

// ============================================================================
// Calibration Visualization Data
// ============================================================================

export interface ReliabilityDiagramData {
  /** X-axis: predicted confidence */
  predictedConfidence: number[];
  
  /** Y-axis: actual accuracy */
  actualAccuracy: number[];
  
  /** Ideal line (y = x) */
  idealLine: number[];
  
  /** Sample counts per bin */
  sampleCounts: number[];
  
  /** Gap areas (for visualization) */
  gaps: {
    x: number;
    predicted: number;
    actual: number;
    gap: number;
    direction: 'over' | 'under';
  }[];
}

/**
 * Generate data for reliability diagram visualization
 */
export function generateReliabilityDiagramData(
  calibration: CalibrationResult
): ReliabilityDiagramData {
  const predictedConfidence = calibration.bins.map(b => b.avgConfidence);
  const actualAccuracy = calibration.bins.map(b => b.accuracy);
  const idealLine = predictedConfidence.map(c => c);
  const sampleCounts = calibration.bins.map(b => b.samples);
  
  const gaps = calibration.bins.map(b => ({
    x: b.avgConfidence,
    predicted: b.avgConfidence,
    actual: b.accuracy,
    gap: b.error,
    direction: (b.avgConfidence > b.accuracy ? 'over' : 'under') as 'over' | 'under',
  }));
  
  return {
    predictedConfidence,
    actualAccuracy,
    idealLine,
    sampleCounts,
    gaps,
  };
}
