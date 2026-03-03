import type { GameSummary, PlayerProfile, TimeControlFilter } from "@chessgg/shared";
import { mapResultFromPlayerResult, parseMovesWithClock, parsePgnTags } from "../lib/pgn.js";

const USER_AGENT = "chessgg/0.1 (https://github.com/chessgg/chessgg)";
const MAX_ARCHIVES = Number(process.env.CHESSCOM_MAX_ARCHIVES ?? 12);

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
  const res = await fetch(url, {
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

export async function fetchChessComGames(username: string): Promise<GameSummary[]> {
  const archivePayload = await fetchJson<{ archives: string[] }>(
    `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`,
  );

  const archiveUrls = [...archivePayload.archives].reverse().slice(0, MAX_ARCHIVES);
  const archiveResponses = await Promise.all(archiveUrls.map((url) => fetchJson<ChessComGamesArchiveResponse>(url)));

  const targetUsername = username.toLowerCase();
  const games: GameSummary[] = [];

  for (const archive of archiveResponses) {
    for (const game of archive.games) {
      const whiteUsername = game.white.username?.toLowerCase();
      const blackUsername = game.black.username?.toLowerCase();

      const color = whiteUsername === targetUsername ? "white" : blackUsername === targetUsername ? "black" : null;
      if (!color) {
        continue;
      }

      const player = color === "white" ? game.white : game.black;
      const opponent = color === "white" ? game.black : game.white;
      const tags = parsePgnTags(game.pgn ?? "");
      const moves = game.pgn ? parseMovesWithClock(game.pgn) : [];

      const timeSpentSec = moves
        .filter((move) => (color === "white" ? move.ply % 2 === 1 : move.ply % 2 === 0))
        .reduce((sum, move) => sum + (move.spentSec ?? 0), 0);

      const platformGameId = game.url.split("/").at(-1) ?? `${game.end_time ?? Date.now()}`;

      games.push({
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
        opening: tags.Opening,
        eco: tags.ECO,
        pgn: game.pgn,
        totalMoves: Math.ceil(moves.length / 2),
        timeSpentSec,
      });
    }
  }

  return games.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
}
