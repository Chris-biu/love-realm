# Love Realm

<p align="center">
  <img src="./desktop/icon.png" alt="Love Realm app icon" width="180" />
</p>

Love Realm is an interactive romance narrative app built with `Next.js + TypeScript + SQLite + Prisma + Electron`.
It is no longer just a simple chat MVP. The current version adds a stage-style reading UI, per-save protagonist customization, configurable pacing and relationship caps, lightweight RAG-based memory retrieval, and a repaired persistent-facts system that can keep evolving after manual edits.

The app currently uses DeepSeek for generation. Players must provide their own DeepSeek API key locally. The project does not ship a built-in developer key.

## What Changed In This Update

- Full frontend information-architecture upgrade:
  - the old query-string-driven single-page flow was replaced with real multi-page App Router routes
  - the app now separates world entry, chat, memory, relationships, and backstage editing into dedicated pages
  - chat is treated as the primary surface instead of being forced to share space with all support systems
- New product-style route structure:
  - `/` for world entry and saved-story access
  - `/session/[sessionId]` for the focused chat reader/composer
  - `/session/[sessionId]/memory` for scene state, facts, and long-term memory
  - `/session/[sessionId]/relationships` for relationship meters and dynamic character state
  - `/session/[sessionId]/backstage` for protagonist editing, world controls, RAG, model settings, exports, and save management
- Richer frontend presentation with a more deliberate visual system across the entry hall, chat shell, and backstage console.
- New protagonist profile system on the session layer:
  - display name
  - role / identity
  - outward persona
  - background
  - current motivation
  - speaking style
- Status metrics now support per-metric `max` values instead of a hardcoded 10-point scale.
- Added world-level director controls:
  - `pacing`: `slow | balanced | fast`
  - `beatLabel`: target experience label
  - retrieval window sizes for memory / facts / dialogue
- Added lightweight RAG-style retrieval into prompt construction.
- Fixed the persistent-facts bug:
  - player-edited facts stay protected
  - AI can still append new facts later
  - the whole field no longer freezes after a manual edit

## Core Features

- Interactive long-form narrative generation with a configurable minimum reply length.
- Chat-first multi-page UI with a dedicated reading/writing route.
- Separate route surfaces for memory, relationships, and backstage controls.
- Session-based branching and save slots.
- Static character cards plus dynamic per-session runtime character state.
- Relationship meters with configurable caps and stage labels.
- World-level narrative rules and pacing controls.
- Lightweight anti-hallucination character whitelist rules in prompts.
- Novel export:
  - quick draft markdown
  - AI-polished markdown
- Windows desktop packaging via Electron.

## Product Model

The project now has a clearer responsibility split:

- `World`
  - world premise
  - static character templates
  - metric templates
  - director pacing config
- `Session`
  - player / protagonist profile
  - messages
  - memory summaries
  - dynamic character runtime state
  - page-level navigation context for chat / memory / relationships / backstage
- `Character`
  - static role card
  - public summary
  - secret summary
  - initial metric template

## Route Design

The frontend is now intentionally split by task:

- `World entry`
  - choose a world
  - create a world card
  - continue from saved branches
- `Chat`
  - read the current scene
  - send the next action or line
  - save the current chapter
- `Memory`
  - inspect scene changes
  - inspect accumulated long-term memory
  - inspect retained facts and narrative context
- `Relationships`
  - inspect per-character metric states
  - inspect dynamic runtime character state
- `Backstage`
  - edit protagonist profile
  - edit world and director settings
  - edit status metric caps
  - edit characters and persistent facts
  - switch model, manage local API key, export novel drafts
  - manage branches and saves

## RAG Strategy

This version uses lightweight retrieval instead of a full vector database.

For each turn, the prompt can pull relevant context from:

- long-term memory summaries
- scene facts and character persistent facts
- recent dialogue

The retrieval window size is configurable from the world director settings.

## Persistent Facts Fix

Previous behavior:

- once a player manually edited the "persistent facts" field, later AI updates could stop affecting it entirely

Current behavior:

- player-confirmed facts remain protected
- AI can still add newly discovered facts
- manual edits no longer freeze the entire field

This logic is covered by unit tests.

## Local Development

Install dependencies:

```bash
npm install
```

Prepare the database schema:

```bash
npm run db:push
```

Optional seed data:

```bash
npm run db:seed
```

Run development server:

```bash
npm run dev
```

## Validation

Unit tests:

```bash
npm run test:unit
```

Production build:

```bash
npm run build
```

## Windows Desktop Build

Build the desktop app:

```bash
npm run desktop:dist
```

Output:

```text
dist-desktop/Love Realm-win32-x64/
```

The generated desktop app starts the bundled Next.js app locally and uses a SQLite database stored in the player's own app data directory.
The packaging script uses the local Electron cache and then copies `standalone` and `db-template` into the packaged app explicitly, so the final EXE does not depend on a live network download during packaging.

## Important Paths

```text
desktop/                  Electron shell and app icons
prisma/
  schema.prisma           Database schema
  seed.ts                 Seed world and character data
src/
  app/api/                API routes
  app/session/            Session routes for chat, memory, relationships, backstage
  components/             Frontend UI
  components/session/     Session shell and page-level client components
  lib/ai/                 DeepSeek adapter
  lib/prompt.ts           Prompt building with retrieval injection
  lib/session-service.ts  Session, world, and state orchestration
  lib/status-metrics.ts   Configurable metric definitions and caps
  lib/story-director.ts   Director pacing and protagonist profile models
  lib/story-retrieval.ts  Lightweight retrieval helpers
docs/
  frontend-chat-first-rebuild-prompt.md
                          Frontend continuation prompt for keeping the app chat-first
```

## Notes

- `next-env.d.ts` may be regenerated by Next.js depending on local dev/build mode.
- Prisma client should be regenerated after schema changes:

```bash
npx prisma generate
```
