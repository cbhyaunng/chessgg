import {
  parseTimeControlKey,
  type GameSummary,
  type RangeFilter,
  type TimeControlDetailFilter,
  type TimeControlFilter,
} from "@chessgg/shared";

export function normalizeRange(value: string | undefined): RangeFilter {
  if (value === "7d" || value === "30d" || value === "all") {
    return value;
  }
  return "30d";
}

export function normalizeTimeControl(value: string | undefined): TimeControlFilter {
  if (value === "bullet" || value === "blitz" || value === "rapid" || value === "all") {
    return value;
  }
  return "all";
}

export function normalizeTimeControlDetail(value: string | undefined): TimeControlDetailFilter {
  if (!value || value === "all") {
    return "all";
  }

  const parsed = parseTimeControlKey(value);
  return parsed ?? "all";
}

export function normalizePlatform(value: string | undefined): "chesscom" | "lichess" {
  if (value === "chesscom" || value === "lichess") {
    return value;
  }
  throw new Error("platform must be 'chesscom' or 'lichess'");
}

function buildThreshold(range: RangeFilter): Date | null {
  if (range === "all") {
    return null;
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = range === "7d" ? 7 : 30;
  return new Date(now - days * dayMs);
}

export function filterGames(
  games: GameSummary[],
  range: RangeFilter,
  timeControl: TimeControlFilter,
  timeControlDetail: TimeControlDetailFilter,
): GameSummary[] {
  const threshold = buildThreshold(range);

  return games
    .filter((game) => {
      if (threshold && new Date(game.playedAt) < threshold) {
        return false;
      }
      if (timeControl !== "all" && game.timeControlCategory !== timeControl) {
        return false;
      }
      if (timeControlDetail !== "all") {
        const parsed = parseTimeControlKey(game.timeControl);
        if (parsed !== timeControlDetail) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
}
