import type { BasicStats, GameSummary, OpeningColorStat, OpeningStat } from "@chessgg/shared";

function calcStreaks(gamesAsc: GameSummary[]): { win: number; loss: number } {
  let currentWin = 0;
  let currentLoss = 0;
  let longestWin = 0;
  let longestLoss = 0;

  for (const game of gamesAsc) {
    if (game.result === "win") {
      currentWin += 1;
      currentLoss = 0;
    } else if (game.result === "loss") {
      currentLoss += 1;
      currentWin = 0;
    } else {
      currentWin = 0;
      currentLoss = 0;
    }

    longestWin = Math.max(longestWin, currentWin);
    longestLoss = Math.max(longestLoss, currentLoss);
  }

  return { win: longestWin, loss: longestLoss };
}

export function buildBasicStats(
  games: GameSummary[],
  range: BasicStats["range"],
  timeControl: BasicStats["timeControl"],
): BasicStats {
  const wins = games.filter((g) => g.result === "win").length;
  const draws = games.filter((g) => g.result === "draw").length;
  const losses = games.filter((g) => g.result === "loss").length;

  const ratingTrend = games
    .filter((g) => g.playerRating !== undefined)
    .sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime())
    .map((g) => ({
      playedAt: g.playedAt,
      rating: g.playerRating ?? 0,
    }));

  const hourlySeed = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    games: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    winRate: 0,
  }));

  for (const game of games) {
    const hour = new Date(game.playedAt).getHours();
    const bucket = hourlySeed[hour];
    bucket.games += 1;
    if (game.result === "win") {
      bucket.wins += 1;
    } else if (game.result === "draw") {
      bucket.draws += 1;
    } else {
      bucket.losses += 1;
    }
  }

  for (const bucket of hourlySeed) {
    bucket.winRate = bucket.games === 0 ? 0 : Math.round((bucket.wins / bucket.games) * 1000) / 10;
  }

  const gamesAsc = [...games].sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());
  const streaks = calcStreaks(gamesAsc);

  return {
    range,
    timeControl,
    wins,
    draws,
    losses,
    longestWinStreak: streaks.win,
    longestLoseStreak: streaks.loss,
    ratingTrend,
    hourly: hourlySeed,
  };
}

export function buildOpeningStats(games: GameSummary[]): OpeningStat[] {
  type OpeningAccumulator = OpeningStat & {
    performanceSum: number;
    performanceCount: number;
  };

  const createColorStat = (): OpeningColorStat => ({
    games: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    winRate: 0,
  });

  const updateColorStat = (stat: OpeningColorStat, result: GameSummary["result"]): void => {
    stat.games += 1;

    if (result === "win") {
      stat.wins += 1;
    } else if (result === "draw") {
      stat.draws += 1;
    } else {
      stat.losses += 1;
    }

    stat.winRate = stat.games === 0 ? 0 : Math.round((stat.wins / stat.games) * 1000) / 10;
  };

  const map = new Map<string, OpeningAccumulator>();

  for (const game of games) {
    const opening = game.opening ?? "Unknown";
    const key = `${game.eco ?? ""}|${opening}`;
    const existing = map.get(key);

    if (!existing) {
      const next: OpeningAccumulator = {
        opening,
        eco: game.eco,
        games: 1,
        white: createColorStat(),
        black: createColorStat(),
        avgPerformance: undefined,
        performanceSum: 0,
        performanceCount: 0,
      };

      updateColorStat(next[game.color], game.result);
      if (game.playerRating !== undefined) {
        next.performanceSum = game.playerRating;
        next.performanceCount = 1;
        next.avgPerformance = game.playerRating;
      }

      map.set(key, next);
      continue;
    }

    existing.games += 1;
    updateColorStat(existing[game.color], game.result);

    if (game.playerRating !== undefined) {
      existing.performanceSum += game.playerRating;
      existing.performanceCount += 1;
      existing.avgPerformance = Math.round((existing.performanceSum / existing.performanceCount) * 10) / 10;
    }
  }

  return [...map.values()]
    .map(({ performanceSum: _performanceSum, performanceCount: _performanceCount, ...item }) => item)
    .sort((a, b) => b.games - a.games)
    .slice(0, 30);
}
