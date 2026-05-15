CREATE TABLE IF NOT EXISTS "World" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "premise" TEXT NOT NULL,
  "storyGuide" TEXT NOT NULL,
  "defaultScene" TEXT NOT NULL,
  "defaultTime" TEXT NOT NULL,
  "initialMemory" TEXT NOT NULL,
  "statusMetrics" JSONB,
  "directorConfig" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Character" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "worldId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "gender" TEXT NOT NULL DEFAULT '未知',
  "roleLabel" TEXT NOT NULL,
  "publicSummary" TEXT NOT NULL,
  "secretSummary" TEXT NOT NULL,
  "personalityTags" JSONB NOT NULL,
  "initialMetrics" JSONB NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Character_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "worldId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "turnCount" INTEGER NOT NULL DEFAULT 0,
  "isSaved" BOOLEAN NOT NULL DEFAULT false,
  "playerProfile" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Session_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "World" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "turnNumber" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "RelationshipState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "metrics" JSONB NOT NULL,
  "dynamicProfile" JSONB,
  "note" TEXT,
  "updatedAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RelationshipState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RelationshipState_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MemorySummary" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "turnNumber" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemorySummary_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SceneState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "turnNumber" INTEGER NOT NULL,
  "currentScene" TEXT NOT NULL,
  "currentTime" TEXT NOT NULL,
  "atmosphere" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "changes" JSONB NOT NULL,
  "facts" JSONB NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SceneState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "World_slug_key" ON "World"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Character_worldId_slug_key" ON "Character"("worldId", "slug");
CREATE INDEX IF NOT EXISTS "Message_sessionId_createdAt_idx" ON "Message"("sessionId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "RelationshipState_sessionId_characterId_key" ON "RelationshipState"("sessionId", "characterId");
CREATE INDEX IF NOT EXISTS "MemorySummary_sessionId_createdAt_idx" ON "MemorySummary"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "SceneState_sessionId_createdAt_idx" ON "SceneState"("sessionId", "createdAt");
