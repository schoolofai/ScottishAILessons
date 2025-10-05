// Core JSON schema types for JSXGraph diagrams

export type JSXGraphElement = {
  type: string;              // "point", "line", "circle", "polygon", "functiongraph", etc.
  args: any[];               // JSXGraph create() arguments
  attributes?: Record<string, any>;
  id?: string;               // Optional ID for element references
};

export type JSXGraphBoardConfig = {
  boundingbox: [number, number, number, number];
  axis?: boolean;
  showCopyright?: boolean;
  showNavigation?: boolean;
  keepAspectRatio?: boolean;
  grid?: boolean;
  pan?: { enabled?: boolean };
  zoom?: { enabled?: boolean };
};

export type JSXGraphDiagram = {
  board: JSXGraphBoardConfig;
  elements: JSXGraphElement[];
  title?: string;
  description?: string;
  metadata?: {
    subject?: string;           // "geometry", "algebra", "calculus"
    difficulty?: string;        // "easy", "medium", "hard"
    interactivity?: string;     // "static", "draggable", "animated"
    learningObjective?: string;
  };
};

// Validation helper
export function validateDiagram(diagram: any): diagram is JSXGraphDiagram {
  return (
    diagram &&
    diagram.board &&
    Array.isArray(diagram.board.boundingbox) &&
    diagram.board.boundingbox.length === 4 &&
    Array.isArray(diagram.elements)
  );
}

// Helper to safely parse function strings
export function parseFunctionString(str: string): Function | string {
  if (typeof str === "string" && str.trim().startsWith("(") && str.includes("=>")) {
    try {
      // Use Function constructor for safer evaluation than eval
      return new Function("return " + str)();
    } catch (e) {
      console.warn("Failed to parse function string:", str, e);
      return str;
    }
  }
  return str;
}
