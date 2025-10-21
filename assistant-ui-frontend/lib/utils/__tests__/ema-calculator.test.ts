import { calculateEMA, batchCalculateEMAs, simulateEMATrajectory, calculateHalfLife } from '../ema-calculator';

describe('EMA Calculator', () => {
  describe('calculateEMA', () => {
    it('should bootstrap first observation', () => {
      const result = calculateEMA(null, 0.8, 0);
      
      expect(result.newEMA).toBe(0.8);
      expect(result.wasBootstrapped).toBe(true);
      expect(result.effectiveAlpha).toBe(1.0);
      expect(result.change).toBe(0.8);
    });
    
    it('should bootstrap when oldEMA is 0.0 and count is 0', () => {
      const result = calculateEMA(0.0, 0.7, 0);
      
      expect(result.newEMA).toBe(0.7);
      expect(result.wasBootstrapped).toBe(true);
    });
    
    it('should apply EMA formula with alpha=0.3 for established knowledge', () => {
      // Old EMA = 0.8, New score = 0.3, observationCount = 5 (past bootstrap)
      // Expected: 0.3 * 0.3 + 0.7 * 0.8 = 0.09 + 0.56 = 0.65
      const result = calculateEMA(0.8, 0.3, 5, { alpha: 0.3 });
      
      expect(result.newEMA).toBeCloseTo(0.65, 2);
      expect(result.wasBootstrapped).toBe(false);
      expect(result.effectiveAlpha).toBe(0.3);
      expect(result.change).toBeCloseTo(-0.15, 2);
    });
    
    it('should use bootstrap alpha for first 3 observations', () => {
      // observationCount = 2 (less than threshold of 3)
      // Should use bootstrapAlpha = 0.5, not alpha = 0.3
      // Expected: 0.5 * 1.0 + 0.5 * 0.5 = 0.75
      const result = calculateEMA(0.5, 1.0, 2, { 
        alpha: 0.3, 
        bootstrapAlpha: 0.5,
        bootstrapThreshold: 3
      });
      
      expect(result.newEMA).toBeCloseTo(0.75, 2);
      expect(result.effectiveAlpha).toBe(0.5);
      expect(result.wasBootstrapped).toBe(false);
    });
    
    it('should switch to normal alpha after bootstrap threshold', () => {
      // observationCount = 3 (equals threshold)
      // Should use normal alpha = 0.3
      // Expected: 0.3 * 1.0 + 0.7 * 0.5 = 0.65
      const result = calculateEMA(0.5, 1.0, 3, { 
        alpha: 0.3, 
        bootstrapAlpha: 0.5,
        bootstrapThreshold: 3
      });
      
      expect(result.newEMA).toBeCloseTo(0.65, 2);
      expect(result.effectiveAlpha).toBe(0.3);
    });
    
    it('should clamp values to [0, 1] by default', () => {
      const result1 = calculateEMA(0.9, 1.5, 5, { alpha: 0.3 });
      expect(result1.newEMA).toBe(1.0);
      
      const result2 = calculateEMA(0.1, -0.5, 5, { alpha: 0.3 });
      expect(result2.newEMA).toBe(0.0);
    });
    
    it('should respect custom min/max values', () => {
      const result = calculateEMA(0.5, 0.8, 5, { 
        alpha: 0.3,
        minValue: 0.2,
        maxValue: 0.9
      });
      
      // 0.3 * 0.8 + 0.7 * 0.5 = 0.59
      expect(result.newEMA).toBeCloseTo(0.59, 2);
      expect(result.newEMA).toBeGreaterThanOrEqual(0.2);
      expect(result.newEMA).toBeLessThanOrEqual(0.9);
    });
    
    it('should handle improvement scenario correctly', () => {
      // Student improves: old EMA = 0.3, new score = 1.0
      // Expected: 0.3 * 1.0 + 0.7 * 0.3 = 0.51
      const result = calculateEMA(0.3, 1.0, 5, { alpha: 0.3 });
      
      expect(result.newEMA).toBeCloseTo(0.51, 2);
      expect(result.change).toBeCloseTo(0.21, 2);
    });
    
    it('should handle regression scenario correctly', () => {
      // Student regresses: old EMA = 0.9, new score = 0.5
      // Expected: 0.3 * 0.5 + 0.7 * 0.9 = 0.78
      const result = calculateEMA(0.9, 0.5, 5, { alpha: 0.3 });
      
      expect(result.newEMA).toBeCloseTo(0.78, 2);
      expect(result.change).toBeCloseTo(-0.12, 2);
    });
    
    it('should handle stable performance correctly', () => {
      // Consistent performance: old EMA = 0.6, new score = 0.6
      // Expected: 0.3 * 0.6 + 0.7 * 0.6 = 0.6
      const result = calculateEMA(0.6, 0.6, 5, { alpha: 0.3 });
      
      expect(result.newEMA).toBeCloseTo(0.6, 2);
      expect(result.change).toBeCloseTo(0.0, 2);
    });
  });
  
  describe('batchCalculateEMAs', () => {
    it('should calculate EMAs for multiple outcomes', () => {
      const existingEMAs = {
        'outcome_A': 0.8,
        'outcome_B': 0.4,
        'outcome_C': 0.0  // First time (will bootstrap)
      };
      
      const newObservations = {
        'outcome_A': 0.3,  // Regression
        'outcome_B': 1.0,  // Improvement
        'outcome_C': 0.7   // Bootstrap
      };
      
      const { updatedEMAs, metadata } = batchCalculateEMAs(
        existingEMAs,
        newObservations,
        { 'outcome_A': 5, 'outcome_B': 5, 'outcome_C': 0 },
        { alpha: 0.3 }
      );
      
      // outcome_A: 0.3 * 0.3 + 0.7 * 0.8 = 0.65
      expect(updatedEMAs['outcome_A']).toBeCloseTo(0.65, 2);
      
      // outcome_B: 0.3 * 1.0 + 0.7 * 0.4 = 0.58
      expect(updatedEMAs['outcome_B']).toBeCloseTo(0.58, 2);
      
      // outcome_C: Bootstrap
      expect(updatedEMAs['outcome_C']).toBe(0.7);
      
      expect(metadata['outcome_C'].wasBootstrapped).toBe(true);
      expect(metadata['outcome_A'].wasBootstrapped).toBe(false);
    });
    
    it('should handle outcomes not in existing EMAs (null old values)', () => {
      const existingEMAs = {
        'outcome_A': 0.8
      };
      
      const newObservations = {
        'outcome_A': 0.5,
        'outcome_B': 0.6  // New outcome, not in existingEMAs
      };
      
      const { updatedEMAs, metadata } = batchCalculateEMAs(
        existingEMAs,
        newObservations,
        {},
        { alpha: 0.3 }
      );
      
      expect(updatedEMAs['outcome_B']).toBe(0.6);  // Bootstrapped
      expect(metadata['outcome_B'].wasBootstrapped).toBe(true);
    });
    
    it('should apply adaptive alpha for early observations', () => {
      const existingEMAs = {
        'outcome_A': 0.5
      };
      
      const newObservations = {
        'outcome_A': 1.0
      };
      
      const { updatedEMAs, metadata } = batchCalculateEMAs(
        existingEMAs,
        newObservations,
        { 'outcome_A': 2 },  // Second observation (less than threshold of 3)
        { alpha: 0.3, bootstrapAlpha: 0.5, bootstrapThreshold: 3 }
      );
      
      // Should use 0.5, not 0.3: 0.5 * 1.0 + 0.5 * 0.5 = 0.75
      expect(updatedEMAs['outcome_A']).toBeCloseTo(0.75, 2);
      expect(metadata['outcome_A'].effectiveAlpha).toBe(0.5);
    });
    
    it('should preserve outcomes not in new observations', () => {
      const existingEMAs = {
        'outcome_A': 0.8,
        'outcome_B': 0.6,
        'outcome_C': 0.4
      };
      
      const newObservations = {
        'outcome_A': 0.3  // Only update outcome_A
      };
      
      const { updatedEMAs } = batchCalculateEMAs(
        existingEMAs,
        newObservations,
        {},
        { alpha: 0.3 }
      );
      
      expect(updatedEMAs['outcome_A']).toBeCloseTo(0.65, 2);
      
      // These should NOT be in updatedEMAs (only updated outcomes returned)
      expect(updatedEMAs['outcome_B']).toBeUndefined();
      expect(updatedEMAs['outcome_C']).toBeUndefined();
    });
  });
  
  describe('simulateEMATrajectory', () => {
    it('should show EMA stabilizing over time', () => {
      const scores = [1.0, 0.7, 0.3, 0.6, 0.6, 0.6, 0.6];
      const trajectory = simulateEMATrajectory(scores, 0.0, { alpha: 0.3 });
      
      expect(trajectory).toHaveLength(7);
      
      // First observation bootstraps
      expect(trajectory[0].ema).toBe(1.0);
      expect(trajectory[0].effectiveAlpha).toBe(1.0);
      
      // Later observations should converge toward 0.6
      expect(trajectory[6].ema).toBeCloseTo(0.6, 1);
      
      // Changes should decrease as EMA stabilizes
      const firstChange = Math.abs(trajectory[1].change);
      const lastChange = Math.abs(trajectory[6].change);
      expect(firstChange).toBeGreaterThan(lastChange);
    });
    
    it('should show adaptive alpha in early observations', () => {
      const scores = [0.8, 0.7, 0.6, 0.5];
      const trajectory = simulateEMATrajectory(scores, 0.0, { 
        alpha: 0.3, 
        bootstrapAlpha: 0.5,
        bootstrapThreshold: 3
      });
      
      // First observation: bootstrap (alpha = 1.0)
      expect(trajectory[0].effectiveAlpha).toBe(1.0);
      
      // Second and third observations: bootstrap alpha (0.5)
      expect(trajectory[1].effectiveAlpha).toBe(0.5);
      expect(trajectory[2].effectiveAlpha).toBe(0.5);
      
      // Fourth observation: normal alpha (0.3)
      expect(trajectory[3].effectiveAlpha).toBe(0.3);
    });
    
    it('should show recovery from regression', () => {
      // Student has a bad lesson, then recovers
      const scores = [0.8, 0.3, 0.7, 0.8, 0.9];
      const trajectory = simulateEMATrajectory(scores, 0.0, { alpha: 0.3 });
      
      // Peak at first observation
      expect(trajectory[0].ema).toBe(0.8);
      
      // Drops after bad lesson
      expect(trajectory[1].ema).toBeLessThan(0.8);
      
      // Gradually recovers
      expect(trajectory[2].ema).toBeGreaterThan(trajectory[1].ema);
      expect(trajectory[3].ema).toBeGreaterThan(trajectory[2].ema);
      expect(trajectory[4].ema).toBeGreaterThan(trajectory[3].ema);
      
      // But doesn't immediately return to 0.8 (shows EMA smoothing)
      expect(trajectory[4].ema).toBeLessThan(0.9);
    });
  });
  
  describe('calculateHalfLife', () => {
    it('should calculate correct half-life for alpha=0.3', () => {
      const halfLife = calculateHalfLife(0.3);
      // Expected: ln(0.5) / ln(0.7) ≈ 1.94 observations
      expect(halfLife).toBeCloseTo(1.94, 1);
    });
    
    it('should calculate correct half-life for alpha=0.5', () => {
      const halfLife = calculateHalfLife(0.5);
      // Expected: ln(0.5) / ln(0.5) = 1.0 observations
      expect(halfLife).toBeCloseTo(1.0, 1);
    });
    
    it('should calculate correct half-life for alpha=0.1', () => {
      const halfLife = calculateHalfLife(0.1);
      // Expected: ln(0.5) / ln(0.9) ≈ 6.58 observations
      expect(halfLife).toBeCloseTo(6.58, 1);
    });
    
    it('should throw error for invalid alpha values', () => {
      expect(() => calculateHalfLife(0)).toThrow('Alpha must be between 0 and 1');
      expect(() => calculateHalfLife(1)).toThrow('Alpha must be between 0 and 1');
      expect(() => calculateHalfLife(-0.5)).toThrow('Alpha must be between 0 and 1');
      expect(() => calculateHalfLife(1.5)).toThrow('Alpha must be between 0 and 1');
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle zero observation correctly', () => {
      const result = calculateEMA(0.5, 0.0, 5, { alpha: 0.3 });
      // 0.3 * 0.0 + 0.7 * 0.5 = 0.35
      expect(result.newEMA).toBeCloseTo(0.35, 2);
    });
    
    it('should handle perfect score correctly', () => {
      const result = calculateEMA(0.5, 1.0, 5, { alpha: 0.3 });
      // 0.3 * 1.0 + 0.7 * 0.5 = 0.65
      expect(result.newEMA).toBeCloseTo(0.65, 2);
    });
    
    it('should handle repeated same scores', () => {
      const scores = [0.7, 0.7, 0.7, 0.7, 0.7];
      const trajectory = simulateEMATrajectory(scores, 0.0, { alpha: 0.3 });
      
      // After many repeated observations, EMA should converge to that value
      expect(trajectory[4].ema).toBeCloseTo(0.7, 1);
    });
    
    it('should handle very high alpha (responsive)', () => {
      const result = calculateEMA(0.8, 0.3, 5, { alpha: 0.9 });
      // 0.9 * 0.3 + 0.1 * 0.8 = 0.35
      // Very responsive to new observation
      expect(result.newEMA).toBeCloseTo(0.35, 2);
    });
    
    it('should handle very low alpha (stable)', () => {
      const result = calculateEMA(0.8, 0.3, 5, { alpha: 0.1 });
      // 0.1 * 0.3 + 0.9 * 0.8 = 0.75
      // Very stable, mostly preserves old value
      expect(result.newEMA).toBeCloseTo(0.75, 2);
    });
  });
});
