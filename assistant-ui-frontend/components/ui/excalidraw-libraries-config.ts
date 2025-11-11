/**
 * External Excalidraw Libraries Configuration
 *
 * Collection of publicly available libraries from libraries.excalidraw.com
 * organized by subject area for Scottish AI Lessons.
 *
 * Students can access these pre-loaded templates for math, circuits,
 * chemistry, and biology diagrams.
 */

export type LibraryCategory = 'math' | 'circuits' | 'chemistry' | 'biology';

export interface LibraryConfig {
  name: string;
  author: string;
  url: string;
  description: string;
}

/**
 * Mathematics libraries for coordinate systems, symbols, and diagrams
 */
export const MATH_LIBRARIES: LibraryConfig[] = [
  {
    name: 'Math Teacher Library',
    author: 'Yatrik Patel',
    description: 'Coordinate grids, Venn diagrams, number lines, and sphere visualizations',
    url: 'https://libraries.excalidraw.com/libraries/https-github-com-ytrkptl/math-teacher-library.excalidrawlib'
  },
  {
    name: 'Mathematical Symbols',
    author: 'J-J',
    description: 'Commonly-used symbols in mathematics designed to look good next to text',
    url: 'https://libraries.excalidraw.com/libraries/jjadup/mathematical-symbols.excalidrawlib'
  }
];

/**
 * Circuit and electrical engineering libraries for physics lessons
 */
export const CIRCUIT_LIBRARIES: LibraryConfig[] = [
  {
    name: 'Circuit Components',
    author: 'Marc Powell',
    description: 'Basic circuit diagram elements (resistors, capacitors, transistors, etc.)',
    url: 'https://libraries.excalidraw.com/libraries/mppowell/circuit-components.excalidrawlib'
  },
  {
    name: 'Schematic Symbols',
    author: 'rkjc',
    description: 'Common electrical schematic wiring diagram symbols',
    url: 'https://libraries.excalidraw.com/libraries/rkjc/schematic-symbols.excalidrawlib'
  },
  {
    name: 'Logic Gates',
    author: 'Bhargav Modak',
    description: 'Basic logic gates (AND, OR, NOT, NAND, NOR) with grid-aligned inputs/outputs',
    url: 'https://libraries.excalidraw.com/libraries/thebrahmnicboy/Logic-Gates.excalidrawlib'
  },
  {
    name: 'Electrical Engineering',
    author: 'Ris Jain',
    description: 'AC system one-line diagrams and power system components',
    url: 'https://libraries.excalidraw.com/libraries/risjain/electrical-engineering.excalidrawlib'
  }
];

/**
 * Chemistry libraries for molecular structures and periodic table
 */
export const CHEMISTRY_LIBRARIES: LibraryConfig[] = [
  {
    name: 'Periodic Table',
    author: 'gabi-as-cosmos',
    description: 'Visual periodic table elements',
    url: 'https://libraries.excalidraw.com/libraries/gabi-as-cosmos/periodic-table.excalidrawlib'
  }
];

/**
 * Biology libraries for cell diagrams, anatomy, and organisms
 */
export const BIOLOGY_LIBRARIES: LibraryConfig[] = [
  {
    name: 'Biology',
    author: 'Sanketh',
    description: 'Virus, bacteria, brain, and cell diagrams',
    url: 'https://libraries.excalidraw.com/libraries/sharathsanketh/biology.excalidrawlib'
  },
  {
    name: 'Medicine',
    author: 'Ernest Noah',
    description: 'Anatomical diagrams (lung, brain, heart) for medical studies',
    url: 'https://libraries.excalidraw.com/libraries/sudotachy/medicine.excalidrawlib'
  }
];

/**
 * Master library collection organized by category
 */
export const EXCALIDRAW_LIBRARIES: Record<LibraryCategory, LibraryConfig[]> = {
  math: MATH_LIBRARIES,
  circuits: CIRCUIT_LIBRARIES,
  chemistry: CHEMISTRY_LIBRARIES,
  biology: BIOLOGY_LIBRARIES
};

/**
 * Get library URLs for specified categories
 * @param categories - Array of category names to include
 * @returns Array of library URLs
 */
export function getLibraryUrls(categories: LibraryCategory[]): string[] {
  return categories.flatMap(category =>
    EXCALIDRAW_LIBRARIES[category].map(lib => lib.url)
  );
}

/**
 * Get all library URLs across all categories
 * @returns Array of all library URLs
 */
export function getAllLibraryUrls(): string[] {
  return Object.values(EXCALIDRAW_LIBRARIES)
    .flatMap(libs => libs.map(lib => lib.url));
}

/**
 * Default categories to load (all science subjects)
 */
export const DEFAULT_LIBRARY_CATEGORIES: LibraryCategory[] = [
  'math',
  'circuits',
  'chemistry',
  'biology'
];
