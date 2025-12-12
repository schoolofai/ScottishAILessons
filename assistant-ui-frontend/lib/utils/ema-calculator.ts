/**
 * EMA Calculator for Mastery Tracking
 * 
 * Implements true Exponential Moving Average with configurable smoothing factor.
 * 
 * Formula: new_ema = α * new_observation + (1 - α) * old_ema
 * 
 * Where:
 * - α (alpha) = smoothing factor, typically 0.3 (30% weight on new data)
 * - Higher α = more responsive to recent changes
 * - Lower α = more stable, emphasizes historical data
 */

export interface EMAConfig {
  alpha?: number;              // Smoothing factor (default: 0.3)
  minValue?: number;           // Clamp minimum (default: 0.0)
  maxValue?: number;           // Clamp maximum (default: 1.0)
  bootstrapAlpha?: number;     // Higher alpha for first N observations (default: 0.5)
  bootstrapThreshold?: number; // Observations before switching to normal alpha (default: 3)
}

export interface EMACalculationResult {
  newEMA: number;
  wasBootstrapped: boolean;
  effectiveAlpha: number;
  change: number;  // How much EMA changed (+/-)
}

const DEFAULT_CONFIG: Required<EMAConfig> = {
  alpha: 0.3,
  minValue: 0.0,
  maxValue: 1.0,
  bootstrapAlpha: 0.5,
  bootstrapThreshold: 3
};

/**
 * Calculate new EMA given old EMA and new observation
 * 
 * Formula: new_ema = α * new_observation + (1 - α) * old_ema
 * 
 * Special cases:
 * - First observation (oldEMA = null): Bootstrap with new observation directly
 * - First 3 observations: Use higher alpha (0.5) for faster learning
 * - Established knowledge: Use normal alpha (0.3) for stability
 * 
 * @param oldEMA - Previous EMA value (null if first observation)
 * @param newObservation - New score from latest lesson
 * @param observationCount - How many observations have been recorded (default: 0)
 * @param config - EMA configuration (optional)
 * @returns Calculation result with new EMA and metadata
 * 
 * @example
 * // First observation (bootstrap)
 * const result1 = calculateEMA(null, 0.8, 0);
 * // result1.newEMA = 0.8, result1.wasBootstrapped = true
 * 
 * // Second observation (adaptive alpha)
 * const result2 = calculateEMA(0.8, 0.3, 1);
 * // result2.newEMA = 0.55, result2.effectiveAlpha = 0.5
 * 
 * // Later observation (normal alpha)
 * const result3 = calculateEMA(0.65, 1.0, 5);
 * // result3.newEMA = 0.755, result3.effectiveAlpha = 0.3
 */
export function calculateEMA(
  oldEMA: number | null,
  newObservation: number,
  observationCount: number = 0,
  config: EMAConfig = {}
): EMACalculationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Clamp input observation to valid range
  const clampedObservation = Math.max(
    cfg.minValue,
    Math.min(cfg.maxValue, newObservation)
  );
  
  // First observation: bootstrap with the observation directly
  if (oldEMA === null || (oldEMA === 0.0 && observationCount === 0)) {
    return {
      newEMA: clampedObservation,
      wasBootstrapped: true,
      effectiveAlpha: 1.0,
      change: clampedObservation
    };
  }
  
  // Determine alpha based on observation count (adaptive learning)
  const effectiveAlpha = observationCount < cfg.bootstrapThreshold
    ? cfg.bootstrapAlpha
    : cfg.alpha;
  
  // Apply EMA formula
  const rawEMA = effectiveAlpha * clampedObservation + (1 - effectiveAlpha) * oldEMA;
  
  // Clamp result to valid range
  const newEMA = Math.max(cfg.minValue, Math.min(cfg.maxValue, rawEMA));
  
  return {
    newEMA,
    wasBootstrapped: false,
    effectiveAlpha,
    change: newEMA - oldEMA
  };
}

/**
 * Batch calculate EMAs for multiple outcomes
 * 
 * Efficiently processes multiple outcome EMAs in a single operation.
 * Useful for updating mastery after lesson completion.
 * 
 * @param existingEMAs - Current EMA values by outcome ID
 * @param newObservations - New scores by outcome ID
 * @param observationCounts - Observation counts by outcome ID (optional, for adaptive alpha)
 * @param config - EMA configuration (optional)
 * @returns Updated EMAs and calculation metadata for each outcome
 * 
 * @example
 * const existing = {
 *   'outcome_A': 0.8,
 *   'outcome_B': 0.4
 * };
 * 
 * const newScores = {
 *   'outcome_A': 0.3,  // Bad performance
 *   'outcome_B': 1.0   // Good performance
 * };
 * 
 * const { updatedEMAs, metadata } = batchCalculateEMAs(existing, newScores);
 * // updatedEMAs = { 'outcome_A': 0.65, 'outcome_B': 0.58 }
 */
export function batchCalculateEMAs(
  existingEMAs: { [outcomeId: string]: number },
  newObservations: { [outcomeId: string]: number },
  observationCounts: { [outcomeId: string]: number } = {},
  config: EMAConfig = {}
): {
  updatedEMAs: { [outcomeId: string]: number };
  metadata: { [outcomeId: string]: EMACalculationResult };
} {
  const updatedEMAs: { [outcomeId: string]: number } = {};
  const metadata: { [outcomeId: string]: EMACalculationResult } = {};
  
  for (const [outcomeId, newScore] of Object.entries(newObservations)) {
    const oldEMA = existingEMAs[outcomeId] ?? null;
    const count = observationCounts[outcomeId] ?? 0;
    
    const result = calculateEMA(oldEMA, newScore, count, config);
    
    updatedEMAs[outcomeId] = result.newEMA;
    metadata[outcomeId] = result;
  }
  
  return { updatedEMAs, metadata };
}

/**
 * Simulate EMA trajectory for testing/visualization
 * 
 * Shows how EMA evolves over a sequence of observations.
 * Useful for understanding EMA behavior and tuning alpha.
 * 
 * @param scores - Sequence of observations
 * @param initialEMA - Starting EMA value (default: 0.0)
 * @param config - EMA configuration (optional)
 * @returns Array of {observation, ema, change} for each step
 * 
 * @example
 * const scores = [1.0, 0.7, 0.3, 0.6, 0.6, 0.6];
 * const trajectory = simulateEMATrajectory(scores, 0.0, { alpha: 0.3 });
 * 
 * trajectory.forEach((step, i) => {
 *   console.log(`Step ${i}: score=${step.observation}, ema=${step.ema.toFixed(3)}, Δ=${step.change.toFixed(3)}`);
 * });
 * 
 * // Output shows EMA converging toward 0.6 after repeated observations
 */
export function simulateEMATrajectory(
  scores: number[],
  initialEMA: number = 0.0,
  config: EMAConfig = {}
): Array<{ observation: number; ema: number; change: number; effectiveAlpha: number }> {
  const trajectory: Array<{ observation: number; ema: number; change: number; effectiveAlpha: number }> = [];
  let currentEMA = initialEMA;
  
  scores.forEach((score, index) => {
    const result = calculateEMA(
      currentEMA === 0.0 && index === 0 ? null : currentEMA,
      score,
      index,
      config
    );
    
    trajectory.push({
      observation: score,
      ema: result.newEMA,
      change: result.change,
      effectiveAlpha: result.effectiveAlpha
    });
    
    currentEMA = result.newEMA;
  });
  
  return trajectory;
}

/**
 * Calculate the half-life of EMA with given alpha
 * 
 * Half-life is the number of observations needed for an old value's
 * influence to decay to 50%.
 * 
 * Formula: half_life = ln(0.5) / ln(1 - α)
 * 
 * @param alpha - Smoothing factor (0 < α < 1)
 * @returns Number of observations for 50% decay
 * 
 * @example
 * calculateHalfLife(0.3); // Returns ~1.9 observations
 * calculateHalfLife(0.5); // Returns ~1.0 observations
 * calculateHalfLife(0.1); // Returns ~6.6 observations
 */
export function calculateHalfLife(alpha: number): number {
  if (alpha <= 0 || alpha >= 1) {
    throw new Error('Alpha must be between 0 and 1 (exclusive)');
  }
  return Math.log(0.5) / Math.log(1 - alpha);
}
