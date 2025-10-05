// Basic type declarations for JSXGraph
// JSXGraph doesn't have official TypeScript types, so we define minimal types here

declare module 'jsxgraph' {
  export interface Board {
    create(elementType: string, args: any[], attributes?: Record<string, any>): any;
    select(name: string): any;
    update(): void;
    setBoundingBox(boundingbox: [number, number, number, number]): void;
  }

  export interface JSXGraphStatic {
    initBoard(id: string | HTMLElement, config: {
      boundingbox: [number, number, number, number];
      axis?: boolean;
      showCopyright?: boolean;
      showNavigation?: boolean;
      keepAspectRatio?: boolean;
      grid?: boolean;
      pan?: { enabled?: boolean };
      zoom?: { enabled?: boolean };
      [key: string]: any;
    }): Board;
    freeBoard(board: Board): void;
  }

  const JSXGraph: JSXGraphStatic;
  export default JSXGraph;
}

declare module 'jsxgraph/distrib/jsxgraph.css' {
  const content: string;
  export default content;
}
