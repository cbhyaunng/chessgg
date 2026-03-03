import type { Platform } from "@chessgg/shared";
import { TtlCache } from "../lib/cache.js";
import { fetchChessComGames, fetchChessComProfile } from "../providers/chesscom.js";
import { fetchLichessGames, fetchLichessProfile } from "../providers/lichess.js";
import type { PlatformDataset } from "../providers/types.js";

const cache = new TtlCache<PlatformDataset>(Number(process.env.DATASET_TTL_MS ?? 5 * 60 * 1000));

export async function getDataset(platform: Platform, username: string): Promise<PlatformDataset> {
  const normalizedUsername = username.trim();
  const cacheKey = `${platform}:${normalizedUsername.toLowerCase()}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const [profile, games] =
    platform === "chesscom"
      ? await Promise.all([fetchChessComProfile(normalizedUsername), fetchChessComGames(normalizedUsername)])
      : await Promise.all([fetchLichessProfile(normalizedUsername), fetchLichessGames(normalizedUsername)]);

  const dataset: PlatformDataset = {
    platform,
    username: normalizedUsername,
    profile,
    games,
  };

  cache.set(cacheKey, dataset);

  return dataset;
}
