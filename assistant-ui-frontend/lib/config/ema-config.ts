/**
 * EMA Configuration for Mastery Tracking
 * 
 * Loads configuration from environment variables with sensible defaults.
 * Validates configuration to ensure values are within acceptable ranges.
 */

export interface EMAConfiguration {
  alpha: number;              // Smoothing factor (0 < α < 1)
  bootstrapAlpha: number;     // Higher alpha for first observations
  bootstrapThreshold: number; // Observations before switching to normal alpha
  enabled: boolean;           // Feature flag for gradual rollout
}

/**
 * Parse and validate EMA configuration from environment variables
 */
function parseEMAConfig(): EMAConfiguration {
  // Parse alpha (default: 0.3)
  let alpha = parseFloat(process.env.NEXT_PUBLIC_EMA_ALPHA ?? '0.3');
  if (isNaN(alpha) || alpha <= 0 || alpha >= 1) {
    console.warn(`[EMA Config] Invalid NEXT_PUBLIC_EMA_ALPHA value: ${process.env.NEXT_PUBLIC_EMA_ALPHA}. Using default: 0.3`);
    alpha = 0.3;
  }
  
  // Parse bootstrap alpha (default: 0.5)
  let bootstrapAlpha = parseFloat(process.env.NEXT_PUBLIC_EMA_BOOTSTRAP_ALPHA ?? '0.5');
  if (isNaN(bootstrapAlpha) || bootstrapAlpha <= 0 || bootstrapAlpha >= 1) {
    console.warn(`[EMA Config] Invalid NEXT_PUBLIC_EMA_BOOTSTRAP_ALPHA value: ${process.env.NEXT_PUBLIC_EMA_BOOTSTRAP_ALPHA}. Using default: 0.5`);
    bootstrapAlpha = 0.5;
  }
  
  // Parse bootstrap threshold (default: 3)
  let bootstrapThreshold = parseInt(process.env.NEXT_PUBLIC_EMA_BOOTSTRAP_THRESHOLD ?? '3', 10);
  if (isNaN(bootstrapThreshold) || bootstrapThreshold < 1 || bootstrapThreshold > 10) {
    console.warn(`[EMA Config] Invalid NEXT_PUBLIC_EMA_BOOTSTRAP_THRESHOLD value: ${process.env.NEXT_PUBLIC_EMA_BOOTSTRAP_THRESHOLD}. Using default: 3`);
    bootstrapThreshold = 3;
  }
  
  // Parse feature flag (default: true)
  const enabled = process.env.NEXT_PUBLIC_ENABLE_EMA !== 'false';
  
  return {
    alpha,
    bootstrapAlpha,
    bootstrapThreshold,
    enabled
  };
}

/**
 * Global EMA configuration
 * 
 * Can be overridden at runtime for testing or A/B experiments.
 */
export const EMA_CONFIG = parseEMAConfig();

/**
 * Log configuration on startup for debugging
 */
if (typeof window !== 'undefined') {
  console.log('[EMA Config] Loaded configuration:', {
    alpha: EMA_CONFIG.alpha,
    bootstrapAlpha: EMA_CONFIG.bootstrapAlpha,
    bootstrapThreshold: EMA_CONFIG.bootstrapThreshold,
    enabled: EMA_CONFIG.enabled,
    halfLife: Math.log(0.5) / Math.log(1 - EMA_CONFIG.alpha)
  });
}

/**
 * Calculate half-life for current alpha
 * 
 * Half-life is the number of observations needed for an old value's
 * influence to decay to 50%.
 */
export function getEMAHalfLife(): number {
  return Math.log(0.5) / Math.log(1 - EMA_CONFIG.alpha);
}

/**
 * Override EMA configuration (for testing)
 * 
 * @example
 * // Test with more responsive EMA
 * overrideEMAConfig({ alpha: 0.5 });
 */
export function overrideEMAConfig(config: Partial<EMAConfiguration>): void {
  Object.assign(EMA_CONFIG, config);
  console.log('[EMA Config] Configuration overridden:', EMA_CONFIG);
}
