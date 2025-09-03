# MVP0 — Walking Skeleton (Auth ✅)  
**Next.js + Appwrite + LangGraph** for **Nat 3 Applications of Mathematics (C844 73)**  
**Seed topic:** Fractions ↔ Decimals ↔ Percentages in money contexts

---

## Problem Statement
Learners (especially neurodivergent and self-study students) need a calm, guided micro-lesson that:

- Teaches a small concept in a **familiar real-life context** (money, rounding to two decimal places).
- Checks understanding with **clear, kind feedback** and **deterministic marking** (numeric/MCQ).
- **Persists** progress so they can resume later, and **updates mastery** per learning outcome.

At **National 3**, SQA emphasises simple fractions/percentages (e.g., ½, ¼, 1/5, 1/10; 10%, 20%, 25%, 50%), rounding to **2 d.p.**, **calculator allowed**, **best-deal decisions**, and **data handling in simple forms**—all in **familiar, real-life contexts**.

---

## Solution Overview
Deliver a minimal, end-to-end product slice:

- **Frontend (Next.js)**: assistant-style lesson UI using a **Lesson Card** flow + chat (LangGraph adaptor).
- **Auth**: ✅ Email/Password + Google + SMTP recovery (already working).
- **Persistence (Appwrite)**: students, courses, enrollments, lesson_templates, sessions (with **lessonSnapshot**), evidence (attempts), mastery.
- **LLM Graph (LangGraph)**: 4 nodes (**Design → Deliver → Mark → Progress**). **Deliver** contains a sub-loop that adapts with hints/scaffolds until correct, pause, or attempt-limit.
- **Seed**: a published **Nat 3** lesson aligned to **H225 73 Numeracy** (simple conversions, rounding to 2 d.p.) and **HV7Y 73 Manage Money & Data** (best-deal decision).

**Outcome:** A learner can complete a 10–15 min micro-lesson, receive feedback, and see mastery updated—then resume later.

---

## Seed Lesson (published template)
**Course**: National 3 Applications of Mathematics (**C844 73**; mandatory units include **H225 73 Numeracy** and **HV7Y 73 Manage Money & Data**).

**Outcome alignment**
- **H225 73 (Numeracy) Outcome 1**: select & carry out calculations; **convert simple fractions/decimals/percents**; **round answers to two d.p.**; money contexts; calculator may be used.
- **HV7Y 73 Outcome 1.4**: **make a decision based on the best deal** (e.g., multi-pack vs unit price).

**Cards (snapshot)**
1) **Equivalences warm-up** → CFU (numeric): “Write **0.2** as a fraction in simplest form.” (→ **1/5**)
2) **10% discount** (money, 2 d.p.) → CFU (numeric): “£18, **10% off** → sale price?” (→ **£16.20**)
3) **Best deal** (unit price) → CFU (MCQ): “Cheaper per 100 g? **500 g £1.50** vs **1 kg £2.80**” (answer: **1 kg £2.80**)
(4) Optional: simple bar chart read (data handling) → identify a single fact.

**Notes:** Keep numbers small; **round money to 2 d.p.**; **calculator allowed**; familiar retail contexts.

---

## Technical Architecture

### System Components
```
apps/web (Next.js)
├─ app/(routes)/dashboard            # SSR dashboard (requires auth cookie)
├─ app/(routes)/session/[id]         # Lesson runner (SSR+CSR)
├─ app/api/chat/route.ts             # SSE proxy to LangGraph
├─ components/assistant-ui           # Chat & lesson controls (calm UI)
├─ components/lesson-card            # Explainer + CFU + feedback
├─ lib/appwrite.ts                   # Admin, session clients
└─ lib/db.ts                         # CRUD for Appwrite collections

Appwrite (managed)
├─ Auth ✅                            # Email/Password, Google, SMTP recovery
└─ Databases                         # students, courses, enrollments, lesson_templates,
                                     # sessions, evidence, mastery

LangGraph (managed)
└─ Graph                             # Design → Delivery(sub-graph) → Mark → Progress (+checkpointing)
```

### Data Flow (happy path)
```
User (authed) → Dashboard → Start “Nat 3 Money Conversions” session
1) Ensure student + course + enrollment exist
2) Create session with lessonSnapshot (from lesson_template)
3) Stream LangGraph (SSE) for lesson orchestration
4) Deliver CFU → Mark deterministically → Persist evidence → Update mastery
5) Session close → Progress summary on dashboard
```

---

## Data Model (slice)
```ts
// Core
interface Student { $id:string; userId:string; displayName?:string;
  accommodations?:string[]; interests?:string[]; studyWindows?:string[]; schema_version:1; }
interface Course  { $id:string; courseId:"C844 73"; subject:"Applications of Mathematics";
  phase:"Senior"; level:"Nat3"; schema_version:1; }
interface Enrollment { $id:string; studentId:string; courseId:string; role:"student"|"observer"; schema_version:1; }

// Content
interface LessonTemplate {
  $id:string; courseId:string; title:string;
  outcomeRefs:{unit:string; outcome:string; label:string}[];
  cards:LessonCard[]; version:number; status:"draft"|"published"; createdBy:string; schema_version:1;
}
interface LessonCard {
  id:string; title:string; explainer:string; example?:string[];
  cfu:{ type:"numeric"|"mcq"; id:string; stem:string; expected?:number|string;
        tolerance?:number; options?:string[]; answerIndex?:number };
  outcomeIds?:string[]; alt?:{ explainer?:string; example?:string[] };
}

// Runtime
interface Session {
  $id:string; studentId:string; courseId:string; lessonTemplateId?:string;
  startedAt:string; endedAt?:string; stage:"design"|"deliver"|"mark"|"progress"|"done";
  lessonSnapshot:{ title:string; outcomeRefs:LessonTemplate["outcomeRefs"]; cards:LessonCard[]; templateVersion?:number };
  graphRunId?:string; schema_version:1;
}
interface Evidence {
  $id:string; sessionId:string; itemId:string; response:string;
  correct:boolean; score:number; outcomeScores:Record<string,number>;
  attemptIndex:number; strategy:"baseline"|"hint"|"scaffold"|"regenerate";
  misconceptionTag?:string; submittedAt:string; feedback?:string; schema_version:1;
}
interface Mastery { $id:string; studentId:string; courseId:string; outcomeId:string; ema:number; updatedAt:string; schema_version:1; }
```

**Relationships & Indexes**
- `enrollments` unique (studentId, courseId)
- `mastery` unique (studentId, courseId, outcomeId)
- `sessions` (studentId, courseId, startedAt DESC)
- `evidence` (sessionId, submittedAt ASC)
- `lesson_templates` (courseId, status, title)

**Permissions**
- Templates: read public/org; write admin.
- Enrollments/Sessions/Evidence/Mastery: **owner-only** (Role.user(student.userId)).

---

## Graphs (ASCII visuals)

### High-level graph (MVP0)
```
Entry
  |
  v
+---------+          +------------------+          +----------+
| design  |  ----->  |  delivery_loop   |  ----->  | progress |
+---------+          +------------------+          +----------+
                                                        |
                                                        v
                                                      [END]
```

### Delivery sub-graph (HITL: hints/scaffolds/variants until success or pause)
```
                +--------------------+
entry  -------> |  generate_variant  |
                +---------+----------+
                          |
                          v
                +---------+----------+
                |     present_ui     |  <-- HUMAN answers or pauses
                +---------+----------+
                          |
                          v
                +---------+----------+
                |      evaluate      | (deterministic mark)
                +----+----------+----+
                     |          |
                     |          |
          correct -> |          | <- incorrect
                     v          v
                +----+----+  +--+----------------+
                |  mark   |  |  hint_or_scaffold |
                +----+----+  +--+----------------+
                     \           /
                      \         /
                       v       v
                    +-----------+        +-----------+
                    | persist_try| ----> | updateEMA | (compute or preview)
                    +-----------+        +-----------+
                           \                   /
                            \                 /
                             v               v
                               +-----------+
                               |  decide   |
                               +-----+-----+
                                     |
             +-----------------------+----------------------+
             |                       |                      |
             v                       v                      v
       [EXIT_SUCCESS]            [EXIT_PAUSE]           loop to
                                                        generate_variant
```

---

## Onboarding & Seeding (first login)
1) Ensure **Student** doc for Appwrite user.
2) Ensure **Course** (**C844 73**) exists (Nat 3 AoM).
3) **Auto-enrol** student → course.
4) Ensure **LessonTemplate** (*Fractions ↔ Decimals ↔ Percents in Everyday Money*) exists/published (aligned to **H225 73** and **HV7Y 73**).
5) Create **Session** with **lessonSnapshot**; route to `/session/[id]`.

---

## Implementation Phases

**Phase 1 — Spine**
- Collections/indexes/ACL in Appwrite
- Seed **Course** + **LessonTemplate**
- Pages: `/dashboard`, `/session/[id]`, `/api/chat` (SSE)
- Graph: **Design → Delivery(sub) → Mark → Progress**

**Phase 2 — Minimal Pedagogy**
- 3 cards (equivalences; 10% off; best-deal) + deterministic marking
- Store **Evidence** per attempt; simple **EMA** update per outcome

**Phase 3 — UX polish**
- Quiet mode; large-text toggle; error toasts; resume flows on dashboard

---

## API / Interface (examples)
```
POST /api/sessions
{ "courseId": "C844 73" }
→ 201 { "sessionId": "sess_..." }

GET  /api/sessions/:id
→ 200 { lessonSnapshot, stage, latestEvidence[] }

POST /api/chat (SSE)
{ "sessionId": "sess_...", "event": { "type":"response", "itemId":"q2", "value":"16.2" } }
→ stream of graph states + feedback
```

---

## Success Criteria
1) New authed learner completes the seed lesson; **Evidence** & **Mastery** persist; resume works.
2) Scores correct for numeric/MCQ; money answers shown in **2 d.p.**.
3) ≥70% session completion in pilot; ≥60% feedback as “clear & kind”.
4) No data leakage across accounts.

---

## Risks & Mitigations
| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| ACL misconfig leaks data | High | Low | Owner-only ACL; e2e tests with secondary account |
| Marking bugs (money rounding) | Med | Med | Unit tests; always **2 d.p.** for currency at N3 |
| Graph state desync | Med | Med | Pass `{userId, sessionId}` on every call; store `graphRunId` in `sessions` |
| Scope creep | Med | Med | Freeze MVP to 3 cards; defer free-text marking |

---

## Open Questions
- Do we show a **simple data-handling** card in MVP0 or v0.1? (bar chart read)
- EMA weighting defaults (e.g., 0.6 recent / 0.4 prior) acceptable?
- Capture **calculator used** flag per attempt (analytics only)?
