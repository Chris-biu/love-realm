# Custom Character Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans inline for this implementation.

**Goal:** Let players add/delete main characters and define the shared status metrics that every character in the same world uses.

**Architecture:** Add a world-level status metric template, keep per-session per-character metric values in `RelationshipState.metrics`, and make AI updates constrained to the active template. Character deletion removes the character and cascades relationship states; new characters receive default metric values in every existing session.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, SQLite, Zod.

---

### Task 1: Status Metric Domain Helpers
- Create `src/lib/status-metrics.ts` with metric normalization, default template, record synchronization, and clamped delta application.
- Add `src/lib/status-metrics.test.ts` for template sync and clamping behavior.

### Task 2: Persistence and Services
- Add optional `World.statusMetrics Json?` to Prisma schema.
- Update session mapping to expose `statusMetrics`.
- Add service functions to update status templates, create characters, and delete characters.
- Ensure existing relationship records are synchronized with the active world template.

### Task 3: API Routes
- Add `POST /api/characters` for character creation.
- Add `DELETE /api/characters/[characterId]` for character deletion.
- Extend `PATCH /api/worlds/[worldId]` to save status metrics.

### Task 4: Prompt and AI State Updates
- Prompt must list active status fields and instruct model to only update those keys.
- Relationship update application must ignore removed metrics and initialize newly added metrics.

### Task 5: Frontend Controls
- Add status metric editor in the backstage console.
- Add create/delete role controls in the character editor.
- Render relationship cards from `activeSession.statusMetrics`, not hard-coded metrics.

### Task 6: Verification
- Run status metric tests and existing tests.
- Run `npm.cmd run build`.
- Run `npx.cmd prisma generate` and `npm.cmd run db:push` if schema changed.
