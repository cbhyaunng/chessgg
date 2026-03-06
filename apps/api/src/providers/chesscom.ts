import type { GameSummary, PlayerProfile, TimeControlFilter } from "@chessgg/shared";
import { extractOpeningInfoFromPgn, mapResultFromPlayerResult, parseMovesWithClock } from "../lib/pgn.js";
import { env } from "../config/env.js";
import { fetchWithRetry } from "../lib/http.js";
import type { FetchGamesOptions } from "./types.js";

const USER_AGENT = "chessgg/0.1 (https://github.com/chessgg/chessgg)";
const MAX_ARCHIVES = env.CHESSCOM_MAX_ARCHIVES;
const DEFAULT_MAX_GAMES = env.PLATFORM_SYNC_MAX_GAMES;

type ChessComProfile = {
  username: string;
  avatar?: string;
  title?: string;
  country?: string;
  joined?: number;
};

type ChessComStats = {
  chess_bullet?: { last?: { rating?: number } };
  chess_blitz?: { last?: { rating?: number } };
  chess_rapid?: { last?: { rating?: number } };
};

type ChessComGamesArchiveResponse = {
  games: Array<{
    url: string;
    pgn?: string;
    rated?: boolean;
    time_class?: string;
    time_control?: string;
    end_time?: number;
    white: {
      username: string;
      rating?: number;
      result: string;
    };
    black: {
      username: string;
      rating?: number;
      result: string;
    };
  }>;
};

function mapTimeClass(value: string | undefined): TimeControlFilter | "other" {
  if (value === "bullet" || value === "blitz" || value === "rapid") {
    return value;
  }
  return "other";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });

  if (res.status === 404) {
    throw new Error("NOT_FOUND");
  }

  if (!res.ok) {
    throw new Error(`Chess.com API error (${res.status})`);
  }

  return (await res.json()) as T;
}

function toMonthKey(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getArchiveMonthKey(url: string): string | null {
  const match = url.match(/\/games\/(\d{4})\/(\d{2})$/);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}`;
}

export async function fetchChessComProfile(username: string): Promise<PlayerProfile> {
  const [profile, stats] = await Promise.all([
    fetchJson<ChessComProfile>(`https://api.chess.com/pub/player/${encodeURIComponent(username)}`),
    fetchJson<ChessComStats>(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/stats`),
  ]);

  return {
    platform: "chesscom",
    username: profile.username,
    avatarUrl: profile.avatar,
    title: profile.title,
    country: profile.country?.split("/").at(-1),
    joinedAt: profile.joined ? new Date(profile.joined * 1000).toISOString() : undefined,
    ratingBullet: stats.chess_bullet?.last?.rating,
    ratingBlitz: stats.chess_blitz?.last?.rating,
    ratingRapid: stats.chess_rapid?.last?.rating,
  };
}

export async function fetchChessComGames(username: string, options: FetchGamesOptions = {}): Promise<GameSummary[]> {
  const archivePayload = await fetchJson<{ archives: string[] }>(
    `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`,
  );

  const maxGames = Math.max(1, options.maxGames ?? DEFAULT_MAX_GAMES);
  const sinceMs = options.since ? new Date(options.since).getTime() : Number.NaN;
  const hasSince = Number.isFinite(sinceMs);
  const sinceMonthKey = hasSince ? toMonthKey(new Date(sinceMs)) : null;
  const archiveUrls = [...archivePayload.archives].reverse().slice(0, MAX_ARCHIVES);
  const targetUsername = username.toLowerCase();
  const games: GameSummary[] = [];

  archiveLoop: for (const archiveUrl of archiveUrls) {
    const archiveMonthKey = getArchiveMonthKey(archiveUrl);
    if (sinceMonthKey && archiveMonthKey && archiveMonthKey < sinceMonthKey) {
      break;
    }

    const archive = await fetchJson<ChessComGamesArchiveResponse>(archiveUrl);
    const archiveGames: GameSummary[] = [];

    for (const game of archive.games) {
      const whiteUsername = game.white.username?.toLowerCase();
      const blackUsername = game.black.username?.toLowerCase();

      const color = whiteUsername === targetUsername ? "white" : blackUsername === targetUsername ? "black" : null;
      if (!color) {
        continue;
      }

      const player = color === "white" ? game.white : game.black;
      const opponent = color === "white" ? game.black : game.white;
      const openingInfo = extractOpeningInfoFromPgn(game.pgn ?? "");
      const moves = game.pgn ? parseMovesWithClock(game.pgn) : [];

      const timeSpentSec = moves
        .filter((move) => (color === "white" ? move.ply % 2 === 1 : move.ply % 2 === 0))
        .reduce((sum, move) => sum + (move.spentSec ?? 0), 0);

      const platformGameId = game.url.split("/").at(-1) ?? `${game.end_time ?? Date.now()}`;

      archiveGames.push({
        id: `chesscom:${platformGameId}`,
        platform: "chesscom",
        platformGameId,
        url: game.url,
        playedAt: game.end_time ? new Date(game.end_time * 1000).toISOString() : new Date().toISOString(),
        timeControl: game.time_control ?? game.time_class ?? "unknown",
        timeControlCategory: mapTimeClass(game.time_class),
        rated: Boolean(game.rated),
        color,
        result: mapResultFromPlayerResult(player.result),
        opponent: {
          username: opponent.username,
          rating: opponent.rating,
        },
        playerRating: player.rating,
        opening: openingInfo.opening,
        eco: openingInfo.eco,
        pgn: game.pgn,
        totalMoves: Math.ceil(moves.length / 2),
        timeSpentSec,
      });
    }

    archiveGames.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());

    for (const game of archiveGames) {
      if (hasSince && new Date(game.playedAt).getTime() < sinceMs) {
        continue;
      }

      games.push(game);
      if (games.length >= maxGames) {
        break archiveLoop;
      }
    }
  }

  return games.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()).slice(0, maxGames);
}
