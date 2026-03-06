import { PlatformSyncStatus, Prisma } from "@prisma/client";
import type { GameSummary, Platform, PlayerProfile } from "@chessgg/shared";
import { env } from "../config/env.js";
import { TtlCache } from "../lib/cache.js";
import { prisma } from "../lib/db.js";
import { fetchChessComGames, fetchChessComProfile } from "../providers/chesscom.js";
import { fetchLichessGames, fetchLichessProfile } from "../providers/lichess.js";
import type { PlatformDataset } from "../providers/types.js";

const memoryCache = new TtlCache<PlatformDataset>(env.DATASET_TTL_MS);
const pendingSyncs = new Map<string, Promise<PlatformDataset>>();

type StoredDatasetRow = Prisma.PlatformProfileCacheGetPayload<{
  include: {
    games: {
      orderBy: {
        playedAt: "desc";
      };
    };
  };
}>;

type SyncMode = "full" | "incremental";

function buildCacheKey(platform: Platform, usernameLower: string): string {
  return `${platform}:${usernameLower}`;
}

function normalizeUsername(username: string): { display: string; lower: string } {
  const display = username.trim();
  return {
    display,
    lower: display.toLowerCase(),
  };
}

function isSyncExpired(startedAt: Date | null): boolean {
  if (!startedAt) {
    return true;
  }

  return Date.now() - startedAt.getTime() > env.DATASET_SYNC_TIMEOUT_MS;
}

function isStale(row: StoredDatasetRow): boolean {
  return row.staleAt.getTime() <= Date.now();
}

function mapStoredProfile(profileJson: Prisma.JsonValue): PlayerProfile {
  return profileJson as unknown as PlayerProfile;
}

function mapStoredGame(row: StoredDatasetRow["games"][number], platform: Platform): GameSummary {
  return {
    id: `${platform}:${row.platformGameId}`,
    platform,
    platformGameId: row.platformGameId,
    url: row.url,
    playedAt: row.playedAt.toISOString(),
    timeControl: row.timeControl,
    timeControlCategory: row.timeControlCategory as GameSummary["timeControlCategory"],
    rated: row.rated,
    color: row.color as GameSummary["color"],
    result: row.result as GameSummary["result"],
    opponent: {
      username: row.opponentUsername,
      rating: row.opponentRating ?? undefined,
    },
    playerRating: row.playerRating ?? undefined,
    opening: row.opening ?? undefined,
    eco: row.eco ?? undefined,
    pgn: row.pgn ?? undefined,
    totalMoves: row.totalMoves ?? undefined,
    timeSpentSec: row.timeSpentSec ?? undefined,
  };
}

function buildDatasetFromRow(row: StoredDatasetRow): PlatformDataset {
  const platform = row.platform as Platform;

  return {
    platform,
    username: row.usernameDisplay,
    profile: mapStoredProfile(row.profileJson),
    games: row.games.map((game) => mapStoredGame(game, platform)),
  };
}

function chunkGames(games: GameSummary[], size = 250): GameSummary[][] {
  const chunks: GameSummary[][] = [];

  for (let index = 0; index < games.length; index += size) {
    chunks.push(games.slice(index, index + size));
  }

  return chunks;
}

function toStoredGameInput(profileCacheId: string, game: GameSummary): Prisma.PlatformGameCacheCreateManyInput {
  return {
    profileCacheId,
    platformGameId: game.platformGameId,
    url: game.url,
    playedAt: new Date(game.playedAt),
    timeControl: game.timeControl,
    timeControlCategory: game.timeControlCategory,
    rated: game.rated,
    color: game.color,
    result: game.result,
    opponentUsername: game.opponent.username,
    opponentRating: game.opponent.rating ?? null,
    playerRating: game.playerRating ?? null,
    opening: game.opening ?? null,
    eco: game.eco ?? null,
    pgn: game.pgn ?? null,
    totalMoves: game.totalMoves ?? null,
    timeSpentSec: game.timeSpentSec ?? null,
  };
}

async function fetchStoredDatasetRow(platform: Platform, usernameLower: string): Promise<StoredDatasetRow | null> {
  return prisma.platformProfileCache.findUnique({
    where: {
      platform_usernameLower: {
        platform,
        usernameLower,
      },
    },
    include: {
      games: {
        orderBy: {
          playedAt: "desc",
        },
      },
    },
  });
}

async function setSyncStatus(
  platform: Platform,
  usernameLower: string,
  status: PlatformSyncStatus,
  errorMessage?: string,
): Promise<void> {
  const now = new Date();

  await prisma.platformProfileCache.updateMany({
    where: {
      platform,
      usernameLower,
    },
    data: {
      syncStatus: status,
      syncStartedAt: status === PlatformSyncStatus.SYNCING ? now : undefined,
      syncFinishedAt: status === PlatformSyncStatus.SYNCING ? null : now,
      syncError: errorMessage ?? null,
    },
  });
}

async function persistDataset(input: {
  platform: Platform;
  usernameLower: string;
  profile: PlayerProfile;
  games: GameSummary[];
  mode: SyncMode;
}): Promise<PlatformDataset> {
  const now = new Date();
  const staleAt = new Date(now.getTime() + env.DATASET_STALE_MS);
  const latestPlayedAt =
    input.games.length > 0 ? new Date(input.games.reduce((latest, game) => (game.playedAt > latest ? game.playedAt : latest), input.games[0]!.playedAt)) : null;
  const isTruncated = input.mode === "full" && input.games.length >= env.PLATFORM_SYNC_MAX_GAMES;

  return prisma.$transaction(async (tx) => {
    const cacheRow = await tx.platformProfileCache.upsert({
      where: {
        platform_usernameLower: {
          platform: input.platform,
          usernameLower: input.usernameLower,
        },
      },
      create: {
        platform: input.platform,
        usernameLower: input.usernameLower,
        usernameDisplay: input.profile.username,
        profileJson: input.profile as unknown as Prisma.InputJsonValue,
        gamesCount: 0,
        latestPlayedAt,
        lastFullSyncAt: input.mode === "full" ? now : null,
        lastIncrementalSyncAt: input.mode === "incremental" ? now : null,
        staleAt,
        syncStatus: PlatformSyncStatus.IDLE,
        syncStartedAt: now,
        syncFinishedAt: now,
        syncError: null,
        isTruncated,
      },
      update: {
        usernameDisplay: input.profile.username,
        profileJson: input.profile as unknown as Prisma.InputJsonValue,
        latestPlayedAt,
        lastFullSyncAt: input.mode === "full" ? now : undefined,
        lastIncrementalSyncAt: input.mode === "incremental" ? now : undefined,
        staleAt,
        syncStatus: PlatformSyncStatus.IDLE,
        syncFinishedAt: now,
        syncError: null,
        isTruncated: input.mode === "full" ? isTruncated : undefined,
      },
    });

    if (input.mode === "full") {
      await tx.platformGameCache.deleteMany({
        where: {
          profileCacheId: cacheRow.id,
        },
      });
    }

    for (const chunk of chunkGames(input.games)) {
      await tx.platformGameCache.createMany({
        data: chunk.map((game) => toStoredGameInput(cacheRow.id, game)),
        skipDuplicates: input.mode === "incremental",
      });
    }

    const gamesCount = await tx.platformGameCache.count({
      where: {
        profileCacheId: cacheRow.id,
      },
    });

    const latestStoredGame = await tx.platformGameCache.findFirst({
      where: {
        profileCacheId: cacheRow.id,
      },
      orderBy: {
        playedAt: "desc",
      },
      select: {
        playedAt: true,
      },
    });

    await tx.platformProfileCache.update({
      where: {
        id: cacheRow.id,
      },
      data: {
        gamesCount,
        latestPlayedAt: latestStoredGame?.playedAt ?? null,
        lastFullSyncAt: input.mode === "full" ? now : undefined,
        lastIncrementalSyncAt: input.mode === "incremental" ? now : undefined,
        staleAt,
        syncStatus: PlatformSyncStatus.IDLE,
        syncFinishedAt: now,
        syncError: null,
        isTruncated: input.mode === "full" ? isTruncated : undefined,
      },
    });

    const stored = await tx.platformProfileCache.findUniqueOrThrow({
      where: {
        id: cacheRow.id,
      },
      include: {
        games: {
          orderBy: {
            playedAt: "desc",
          },
        },
      },
    });

    return buildDatasetFromRow(stored);
  });
}

async function fetchPlatformDataset(
  platform: Platform,
  username: string,
  mode: SyncMode,
  latestPlayedAt?: string,
): Promise<{ profile: PlayerProfile; games: GameSummary[] }> {
  const maxGames = env.PLATFORM_SYNC_MAX_GAMES;

  if (platform === "chesscom") {
    const [profile, games] = await Promise.all([
      fetchChessComProfile(username),
      fetchChessComGames(username, {
        maxGames,
        since: mode === "incremental" ? latestPlayedAt : undefined,
      }),
    ]);

    return { profile, games };
  }

  const [profile, games] = await Promise.all([
    fetchLichessProfile(username),
    fetchLichessGames(username, {
      maxGames,
      since: mode === "incremental" ? latestPlayedAt : undefined,
    }),
  ]);

  return { profile, games };
}

function runSyncOnce(key: string, factory: () => Promise<PlatformDataset>): Promise<PlatformDataset> {
  const existing = pendingSyncs.get(key);
  if (existing) {
    return existing;
  }

  const next = factory().finally(() => {
    pendingSyncs.delete(key);
  });

  pendingSyncs.set(key, next);
  return next;
}

async function syncDataset(platform: Platform, username: string, mode: SyncMode): Promise<PlatformDataset> {
  const normalized = normalizeUsername(username);
  const stored = await prisma.platformProfileCache.findUnique({
    where: {
      platform_usernameLower: {
        platform,
        usernameLower: normalized.lower,
      },
    },
    select: {
      latestPlayedAt: true,
    },
  });

  if (stored) {
    await setSyncStatus(platform, normalized.lower, PlatformSyncStatus.SYNCING);
  }

  try {
    const effectiveMode = mode === "incremental" && stored?.latestPlayedAt ? "incremental" : "full";
    const fetched = await fetchPlatformDataset(
      platform,
      normalized.display,
      effectiveMode,
      stored?.latestPlayedAt?.toISOString(),
    );
    const dataset = await persistDataset({
      platform,
      usernameLower: normalized.lower,
      profile: fetched.profile,
      games: fetched.games,
      mode: effectiveMode,
    });

    memoryCache.set(buildCacheKey(platform, normalized.lower), dataset);
    return dataset;
  } catch (error) {
    await setSyncStatus(
      platform,
      normalized.lower,
      PlatformSyncStatus.FAILED,
      error instanceof Error ? error.message : "Dataset sync failed",
    );
    throw error;
  }
}

function scheduleBackgroundRefresh(platform: Platform, username: string, row: StoredDatasetRow): void {
  const key = buildCacheKey(platform, row.usernameLower);

  if (pendingSyncs.has(key)) {
    return;
  }

  if (row.syncStatus === PlatformSyncStatus.SYNCING && !isSyncExpired(row.syncStartedAt)) {
    return;
  }

  void runSyncOnce(key, () => syncDataset(platform, username, "incremental")).catch(() => undefined);
}

export async function getDataset(platform: Platform, username: string): Promise<PlatformDataset> {
  const normalized = normalizeUsername(username);
  const key = buildCacheKey(platform, normalized.lower);

  const memoryHit = memoryCache.get(key);
  if (memoryHit) {
    return memoryHit;
  }

  const stored = await fetchStoredDatasetRow(platform, normalized.lower);
  if (stored) {
    const dataset = buildDatasetFromRow(stored);
    memoryCache.set(key, dataset);

    if (isStale(stored)) {
      scheduleBackgroundRefresh(platform, normalized.display, stored);
    }

    return dataset;
  }

  const pending = pendingSyncs.get(key);
  if (pending) {
    return pending;
  }

  return runSyncOnce(key, () => syncDataset(platform, normalized.display, "full"));
}
