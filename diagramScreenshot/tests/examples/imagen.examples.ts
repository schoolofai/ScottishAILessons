/**
 * Imagen example requests for Scottish National 5 Mathematics
 *
 * These examples demonstrate AI-generated educational images
 * for real-world mathematical concepts and applications
 */

import type { ImagenRenderRequest } from '../../src/types/imagen.types';

// ============================================================================
// REAL-WORLD MATHEMATICS APPLICATIONS
// ============================================================================

/**
 * Pythagorean theorem in architecture
 */
export const pythagorasArchitecture: ImagenRenderRequest = {
  prompt: {
    text: 'A construction worker using a measuring tape to check if a corner is square using the 3-4-5 triangle method. The worker is measuring 3 meters along one wall, 4 meters along the perpendicular wall, and checking that the diagonal is exactly 5 meters.',
    context: 'Demonstrating practical application of Pythagorean theorem in construction',
    style: {
      type: 'illustration',
      colorScheme: 'full-color',
      perspective: 'isometric'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Pythagorean theorem applications'
    }
  }
};

/**
 * Similar triangles in surveying
 */
export const similarTrianglesSurveying: ImagenRenderRequest = {
  prompt: {
    text: 'A surveyor measuring the height of a tall building using similar triangles. Shows a person with a measuring stick creating a small triangle with their shadow, while the building creates a larger similar triangle with its shadow.',
    style: {
      type: 'diagram',
      colorScheme: 'full-color',
      perspective: 'side'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Similar triangles and proportion'
    }
  }
};

/**
 * Gradient/slope in road design
 */
export const gradientRoadDesign: ImagenRenderRequest = {
  prompt: {
    text: 'A cross-section diagram of a hillside road showing the gradient. Include a car on the slope with measurements showing the vertical rise and horizontal run. Label showing 1:10 gradient means 1 meter rise for every 10 meters of horizontal distance.',
    style: {
      type: 'diagram',
      colorScheme: 'muted',
      perspective: 'side'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Gradient and rate of change'
    }
  }
};

// ============================================================================
// STATISTICS AND DATA IN CONTEXT
// ============================================================================

/**
 * Mean, median, mode in sports
 */
export const statisticsSportsContext: ImagenRenderRequest = {
  prompt: {
    text: 'A basketball scoreboard showing points scored by a player over 10 games: 12, 15, 18, 15, 22, 15, 19, 14, 15, 25. Visual elements highlighting that 15 appears most often (mode), the middle values (median), and the total divided by 10 (mean).',
    style: {
      type: 'illustration',
      colorScheme: 'full-color'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Averages and data analysis'
    }
  }
};

/**
 * Probability in weather forecasting
 */
export const probabilityWeather: ImagenRenderRequest = {
  prompt: {
    text: 'A weather forecast display showing probability of rain. Visual representation of 70% chance of rain using 10 cloud icons where 7 are rain clouds and 3 are sunny. Clear educational visualization of probability as fraction 7/10.',
    style: {
      type: 'illustration',
      colorScheme: 'full-color'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Probability basics'
    }
  }
};

// ============================================================================
// GEOMETRIC SHAPES IN REAL WORLD
// ============================================================================

/**
 * Circles in engineering - gears
 */
export const circlesGears: ImagenRenderRequest = {
  prompt: {
    text: 'Two interlocking gears showing the relationship between their radii and rotational speeds. The larger gear has radius 6cm and the smaller gear has radius 2cm, demonstrating that when the small gear turns 3 times, the large gear turns once.',
    style: {
      type: 'diagram',
      colorScheme: 'muted',
      perspective: 'front'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Circles and ratio'
    }
  }
};

/**
 * Area and perimeter in garden design
 */
export const areaPerimeterGarden: ImagenRenderRequest = {
  prompt: {
    text: 'A birds-eye view of a rectangular garden plot measuring 8 meters by 5 meters. Shows fencing around the perimeter (26 meters total) and grass seed coverage area (40 square meters). Clear labeling of dimensions.',
    style: {
      type: 'diagram',
      colorScheme: 'full-color',
      perspective: 'birds-eye'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Area and perimeter'
    }
  }
};

/**
 * Volume in packaging
 */
export const volumePackaging: ImagenRenderRequest = {
  prompt: {
    text: 'Three different shaped containers all holding exactly 1 litre of liquid: a cube (10cm x 10cm x 10cm), a rectangular prism (20cm x 10cm x 5cm), and a cylinder. Shows how different shapes can have the same volume.',
    style: {
      type: 'illustration',
      colorScheme: 'full-color',
      perspective: 'isometric'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Volume of 3D shapes'
    }
  }
};

// ============================================================================
// ALGEBRA IN CONTEXT
// ============================================================================

/**
 * Linear equations - phone plans
 */
export const linearEquationsPhonePlans: ImagenRenderRequest = {
  prompt: {
    text: 'Two mobile phone plan comparison showing cost vs minutes used. Plan A: £10 base + 5p per minute (y = 10 + 0.05x). Plan B: £20 flat rate unlimited. Graph showing where the lines cross at 200 minutes - the break-even point.',
    style: {
      type: 'diagram',
      colorScheme: 'full-color'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Linear equations and graphs'
    }
  }
};

/**
 * Sequences - stacking patterns
 */
export const sequencesStacking: ImagenRenderRequest = {
  prompt: {
    text: 'Cans stacked in a triangular pattern showing the sequence 1, 3, 6, 10, 15 (triangular numbers). Each row adds one more can than the previous. Clear visual showing how to predict the next number in the pattern.',
    style: {
      type: 'illustration',
      colorScheme: 'full-color',
      perspective: 'front'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Number sequences and patterns'
    }
  }
};

// ============================================================================
// TRIGONOMETRY APPLICATIONS
// ============================================================================

/**
 * Angle of elevation - lighthouse
 */
export const angleElevationLighthouse: ImagenRenderRequest = {
  prompt: {
    text: 'A ship at sea observing a lighthouse. Shows the angle of elevation from the ship to the top of the lighthouse as 15 degrees. The horizontal distance is marked as 200 meters. Dotted lines show the right triangle formed.',
    style: {
      type: 'diagram',
      colorScheme: 'muted',
      perspective: 'side'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Trigonometry - angle of elevation'
    }
  }
};

/**
 * Bearings in navigation
 */
export const bearingsNavigation: ImagenRenderRequest = {
  prompt: {
    text: 'A map showing a ship navigating from port A to lighthouse B. Compass rose showing North. The bearing from A to B is marked as 045 degrees (clockwise from North). Distance marked as 15 nautical miles.',
    style: {
      type: 'diagram',
      colorScheme: 'muted',
      perspective: 'birds-eye'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Bearings and navigation'
    }
  }
};

// ============================================================================
// PERCENTAGE AND RATIO
// ============================================================================

/**
 * Percentage increase - sales
 */
export const percentageIncreaseSales: ImagenRenderRequest = {
  prompt: {
    text: 'A shop window showing original price £80 with a 25% off sale sticker. Visual breakdown showing: 25% of £80 = £20 discount, new price = £60. Clear illustration of percentage calculation.',
    style: {
      type: 'illustration',
      colorScheme: 'full-color',
      perspective: 'front'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Percentages and discounts'
    }
  }
};

/**
 * Ratio in recipes
 */
export const ratioRecipes: ImagenRenderRequest = {
  prompt: {
    text: 'A baking scene showing ratio in action. Recipe calls for flour:sugar:butter in ratio 3:2:1. Shows measuring cups with 300g flour, 200g sugar, 100g butter. Demonstrates scaling up: doubling recipe shows 600g:400g:200g.',
    style: {
      type: 'illustration',
      colorScheme: 'full-color'
    },
    educational: {
      subject: 'mathematics',
      level: 'secondary',
      topic: 'Ratio and proportion'
    }
  }
};

// ============================================================================
// EXPORT ALL EXAMPLES
// ============================================================================

export const allImagenExamples = {
  // Real-world applications
  pythagorasArchitecture,
  similarTrianglesSurveying,
  gradientRoadDesign,

  // Statistics
  statisticsSportsContext,
  probabilityWeather,

  // Geometry
  circlesGears,
  areaPerimeterGarden,
  volumePackaging,

  // Algebra
  linearEquationsPhonePlans,
  sequencesStacking,

  // Trigonometry
  angleElevationLighthouse,
  bearingsNavigation,

  // Percentage and ratio
  percentageIncreaseSales,
  ratioRecipes
};

export default allImagenExamples;
