DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PlatformSyncStatus'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."PlatformSyncStatus" AS ENUM ('IDLE', 'SYNCING', 'FAILED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "public"."PlatformProfileCache" (
  "id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "usernameLower" TEXT NOT NULL,
  "usernameDisplay" TEXT NOT NULL,
  "profileJson" JSONB NOT NULL,
  "gamesCount" INTEGER NOT NULL DEFAULT 0,
  "latestPlayedAt" TIMESTAMPTZ,
  "lastFullSyncAt" TIMESTAMPTZ,
  "lastIncrementalSyncAt" TIMESTAMPTZ,
  "staleAt" TIMESTAMPTZ NOT NULL,
  "syncStatus" "public"."PlatformSyncStatus" NOT NULL DEFAULT 'IDLE',
  "syncStartedAt" TIMESTAMPTZ,
  "syncFinishedAt" TIMESTAMPTZ,
  "syncError" TEXT,
  "isTruncated" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PlatformProfileCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."PlatformGameCache" (
  "id" TEXT NOT NULL,
  "profileCacheId" TEXT NOT NULL,
  "platformGameId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "playedAt" TIMESTAMPTZ NOT NULL,
  "timeControl" TEXT NOT NULL,
  "timeControlCategory" TEXT NOT NULL,
  "rated" BOOLEAN NOT NULL,
  "color" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "opponentUsername" TEXT NOT NULL,
  "opponentRating" INTEGER,
  "playerRating" INTEGER,
  "opening" TEXT,
  "eco" TEXT,
  "pgn" TEXT,
  "totalMoves" INTEGER,
  "timeSpentSec" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "PlatformGameCache_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformGameCache_profileCacheId_fkey"
    FOREIGN KEY ("profileCacheId")
    REFERENCES "public"."PlatformProfileCache" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformProfileCache_platform_usernameLower_key"
  ON "public"."PlatformProfileCache" ("platform", "usernameLower");

CREATE INDEX IF NOT EXISTS "PlatformProfileCache_platform_staleAt_idx"
  ON "public"."PlatformProfileCache" ("platform", "staleAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformGameCache_profileCacheId_platformGameId_key"
  ON "public"."PlatformGameCache" ("profileCacheId", "platformGameId");

CREATE INDEX IF NOT EXISTS "PlatformGameCache_profileCacheId_playedAt_idx"
  ON "public"."PlatformGameCache" ("profileCacheId", "playedAt");

CREATE INDEX IF NOT EXISTS "PlatformGameCache_profileCacheId_timeControlCategory_playedAt_idx"
  ON "public"."PlatformGameCache" ("profileCacheId", "timeControlCategory", "playedAt");
