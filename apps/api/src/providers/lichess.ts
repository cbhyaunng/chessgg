import type { GameResult, GameSummary, PlayerProfile, TimeControlFilter } from "@chessgg/shared";
import { parseMovesWithClock } from "../lib/pgn.js";
import { env } from "../config/env.js";
import { fetchWithRetry } from "../lib/http.js";

type LichessProfile = {
  id: string;
  username: string;
  title?: string;
  perfs?: {
    bullet?: { rating?: number };
    blitz?: { rating?: number };
    rapid?: { rating?: number };
  };
  profile?: {
    flag?: string;
  };
  createdAt?: number;
};

type LichessGame = {
  id: string;
  createdAt?: number;
  speed?: string;
  rated?: boolean;
  winner?: "white" | "black";
  players: {
    white?: {
      user?: { name?: string };
      rating?: number;
    };
    black?: {
      user?: { name?: string };
      rating?: number;
    };
  };
  opening?: {
    eco?: string;
    name?: string;
  };
  pgn?: string;
  clock?: {
    initial?: number;
    increment?: number;
  };
};

const MAX_GAMES = env.LICHESS_MAX_GAMES;

function mapSpeed(value: string | undefined): TimeControlFilter | "other" {
  if (value === "bullet" || value === "blitz" || value === "rapid") {
    return value;
  }
  return "other";
}

function mapResult(color: "white" | "black", winner: "white" | "black" | undefined): GameResult {
  if (!winner) {
    return "draw";
  }

  return color === winner ? "win" : "loss";
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (res.status === 404) {
    throw new Error("NOT_FOUND");
  }

  if (!res.ok) {
    throw new Error(`Lichess API error (${res.status})`);
  }

  return (await res.json()) as T;
}

export async function fetchLichessProfile(username: string): Promise<PlayerProfile> {
  const data = await fetchJson<LichessProfile>(`https://lichess.org/api/user/${encodeURIComponent(username)}`);

  return {
    platform: "lichess",
    username: data.username,
    title: data.title,
    country: data.profile?.flag,
    joinedAt: data.createdAt ? new Date(data.createdAt).toISOString() : undefined,
    ratingBullet: data.perfs?.bullet?.rating,
    ratingBlitz: data.perfs?.blitz?.rating,
    ratingRapid: data.perfs?.rapid?.rating,
  };
}

export async function fetchLichessGames(username: string): Promise<GameSummary[]> {
  const res = await fetchWithRetry(
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${MAX_GAMES}&pgnInJson=true&clocks=true&opening=true&sort=dateDesc`,
    {
      headers: {
        Accept: "application/x-ndjson",
      },
    },
  );

  if (res.status === 404) {
    throw new Error("NOT_FOUND");
  }

  if (!res.ok) {
    throw new Error(`Lichess games API error (${res.status})`);
  }

  const body = await res.text();
  const lines = body.split("\n").filter((line) => line.trim().length > 0);
  const lower = username.toLowerCase();

  const games: GameSummary[] = [];

  for (const line of lines) {
    const game = JSON.parse(line) as LichessGame;
    const whiteUsername = game.players.white?.user?.name;
    const blackUsername = game.players.black?.user?.name;

    const color = whiteUsername?.toLowerCase() === lower ? "white" : blackUsername?.toLowerCase() === lower ? "black" : null;
    if (!color) {
      continue;
    }

    const player = color === "white" ? game.players.white : game.players.black;
    const opponent = color === "white" ? game.players.black : game.players.white;
    const moves = game.pgn ? parseMovesWithClock(game.pgn) : [];

    const timeSpentSec = moves
      .filter((move) => (color === "white" ? move.ply % 2 === 1 : move.ply % 2 === 0))
      .reduce((sum, move) => sum + (move.spentSec ?? 0), 0);

    games.push({
      id: `lichess:${game.id}`,
      platform: "lichess",
      platformGameId: game.id,
      url: `https://lichess.org/${game.id}`,
      playedAt: game.createdAt ? new Date(game.createdAt).toISOString() : new Date().toISOString(),
      timeControl:
        game.clock?.initial !== undefined && game.clock?.increment !== undefined
          ? `${game.clock.initial}+${game.clock.increment}`
          : game.speed ?? "unknown",
      timeControlCategory: mapSpeed(game.speed),
      rated: Boolean(game.rated),
      color,
      result: mapResult(color, game.winner),
      opponent: {
        username: opponent?.user?.name ?? "unknown",
        rating: opponent?.rating,
      },
      playerRating: player?.rating,
      opening: game.opening?.name,
      eco: game.opening?.eco,
      pgn: game.pgn,
      totalMoves: Math.ceil(moves.length / 2),
      timeSpentSec,
    });
  }

  return games;
}
