// TypeScript types for JSXGraph diagrams (matching diagram-prototypes)

export interface JSXGraphBoardConfig {
  boundingbox: [number, number, number, number];
  axis?: boolean;
  grid?: boolean;
  showCopyright?: boolean;
  showNavigation?: boolean;
  keepAspectRatio?: boolean;
  pan?: { enabled?: boolean };
  zoom?: { enabled?: boolean };
}

export interface JSXGraphElement {
  type: string;
  args: any[];
  attributes?: Record<string, any>;
  id?: string;
}

export interface JSXGraphDiagram {
  board: JSXGraphBoardConfig;
  elements: JSXGraphElement[];
  title?: string;
  description?: string;
  metadata?: {
    subject?: string;
    difficulty?: string;
    interactivity?: string;
    learningObjective?: string;
  };
}

export interface RenderOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg';
  quality?: number;
  scale?: number;
  timeout?: number;
  waitForStable?: boolean;
  backgroundColor?: string;
  fullPage?: boolean;
  returnFormat?: 'base64' | 'binary';
}

export interface RenderRequest {
  diagram: JSXGraphDiagram;
  options?: RenderOptions;
}

export interface RenderSuccessResponse {
  success: true;
  image: string;
  metadata: {
    format: string;
    width: number;
    height: number;
    sizeBytes: number;
    renderTimeMs: number;
    elementCount: number;
    timestamp: string;
  };
}

export interface RenderErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    consoleErrors?: string[];
    suggestion?: string;
  };
}

export type RenderResponse = RenderSuccessResponse | RenderErrorResponse;
