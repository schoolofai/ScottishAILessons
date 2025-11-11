# Component Spec: `<DrawAnswerBoard />`

## 1) Purpose
Provide a controlled drawing surface for assessment questions (e.g., scattergraphs). Students draw, then submit. The system stores:
- a **PNG** (for quick visual marking) and
- the **Excalidraw scene JSON** (for reloading, auditing, and AI analysis).

## 2) Scope
- **UI**: Excalidraw canvas with optional template (axes/labels), restricted tools, and Submit/Export buttons.
- **Data**: Save scene JSON + generated PNG to backend (REST endpoints).
- **Roles**: `student`, `teacher` (teacher can reload/annotate with the same component).
- **Non-goals**: Real-time multiuser collab (can be added later), LMS integration (out of scope here).

## 3) Tech & Dependencies
- **Framework**: Next.js 14+ (App Router).
- **Excalidraw**: `@excalidraw/excalidraw` (client-only).
- **TypeScript**: strict mode.
- **Storage**: Backend uploads to object storage (e.g., S3) or local dev storage.
- **Auth**: Assumed session/JWT available via `headers` or a hook (implementation detail outside this spec).

## 4) File Layout (App Router)
```
app/
  components/
    draw-answer/
      DrawAnswerBoard.tsx
      types.ts
      schema.ts
  api/
    draw/submit/route.ts
    draw/presign/route.ts
    draw/load/route.ts
```

## 5) Public API (Props)
```ts
export type Role = 'student' | 'teacher';

export interface DrawAnswerBoardProps {
  questionId: string;
  attemptId?: string;
  role?: Role;
  initialScene?: ExcalidrawSceneData;
  readOnly?: boolean;
  gridSize?: number | null;
  toolWhitelist?: Array<'selection'|'rectangle'|'ellipse'|'diamond'|'line'|'arrow'|'text'|'freedraw'|'image'>;
  lockTemplateElements?: boolean;
  autosaveMs?: number;
  exportScale?: number;
  onSubmitted?: (payload: SubmitResult) => void;
  submitEndpoint?: string;
  loadEndpoint?: string;
  metadata?: Record<string, unknown>;
}
```

## 6) User Flows
**Student:** Draws → Submit → Scene JSON + PNG sent → Saved to backend  
**Teacher:** Loads scene → Annotates or reviews → Re-exports

## 7) UI/UX Requirements
- Buttons: `Submit`, `Export PNG`, `Reset`
- States: saving, saved, error, read-only
- Mobile & a11y friendly

## 8) Data Models
```ts
export interface ExcalidrawSceneData {
  type: 'excalidraw';
  version: number;
  source?: string;
  elements: any[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}
```

## 9) API Contracts
### `POST /api/draw/submit`
Multipart form data → returns URLs for JSON + PNG  
### `GET /api/draw/load`
Returns stored JSON + PNG for given submission ID

## 10) Behavior
- Uses Excalidraw’s `exportToBlob()` for PNG.
- Validates scene with Zod.
- Posts `{ questionId, attemptId, scene, png }` to API.

## 11) Security
- Authenticated endpoints.
- Server validation of question ownership.
- Minimal PII stored.

## 12) Extensibility
- Real-time collab (yjs/Liveblocks)
- Rubric overlay / AI marking
- Template registry

## 13) Definition of Done
✅ Draw + Submit works  
✅ Teacher reloads scene  
✅ JSON + PNG stored/retrievable  
✅ Error handling + a11y OK
