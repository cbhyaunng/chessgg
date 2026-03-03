import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { GameDetail, PaginatedResponse, PlayerSummary } from "@chessgg/shared";
import { buildKeyMoments, parseMovesWithClock } from "./lib/pgn.js";
import {
  filterGames,
  normalizePlatform,
  normalizeRange,
  normalizeTimeControl,
  normalizeTimeControlDetail,
} from "./lib/filters.js";
import { buildBasicStats, buildOpeningStats } from "./lib/stats.js";
import { getDataset } from "./services/platform-service.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "chessgg-api" });
});

app.get("/v1/search", async (req, res, next) => {
  try {
    const platform = normalizePlatform(String(req.query.platform ?? ""));
    const query = String(req.query.query ?? "").trim();

    if (!query) {
      res.status(400).json({ message: "query is required" });
      return;
    }

    const dataset = await getDataset(platform, query);
    res.json({
      profile: dataset.profile,
      games: dataset.games.length,
      latestPlayedAt: dataset.games[0]?.playedAt,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/v1/profiles/:platform/:username/summary", async (req, res, next) => {
  try {
    const platform = normalizePlatform(req.params.platform);
    const range = normalizeRange(String(req.query.range ?? undefined));
    const timeControl = normalizeTimeControl(String(req.query.tc ?? undefined));
    const timeControlDetail = normalizeTimeControlDetail(String(req.query.tcd ?? undefined));

    const dataset = await getDataset(platform, req.params.username);
    const filtered = filterGames(dataset.games, range, timeControl, timeControlDetail);

    const wins = filtered.filter((g) => g.result === "win").length;
    const draws = filtered.filter((g) => g.result === "draw").length;
    const losses = filtered.filter((g) => g.result === "loss").length;
    const winRate = filtered.length === 0 ? 0 : Math.round((wins / filtered.length) * 1000) / 10;

    const payload: PlayerSummary = {
      profile: dataset.profile,
      range,
      timeControl,
      games: filtered.length,
      wins,
      draws,
      losses,
      winRate,
    };

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get("/v1/profiles/:platform/:username/games", async (req, res, next) => {
  try {
    const platform = normalizePlatform(req.params.platform);
    const range = normalizeRange(String(req.query.range ?? undefined));
    const timeControl = normalizeTimeControl(String(req.query.tc ?? undefined));
    const timeControlDetail = normalizeTimeControlDetail(String(req.query.tcd ?? undefined));

    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize ?? 20)));

    const dataset = await getDataset(platform, req.params.username);
    const filtered = filterGames(dataset.games, range, timeControl, timeControlDetail);

    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize);

    const payload: PaginatedResponse<(typeof filtered)[number]> = {
      page,
      pageSize,
      total: filtered.length,
      items,
    };

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get("/v1/profiles/:platform/:username/games/:gameId", async (req, res, next) => {
  try {
    const platform = normalizePlatform(req.params.platform);
    const dataset = await getDataset(platform, req.params.username);

    const game = dataset.games.find((item) => item.platformGameId === req.params.gameId);

    if (!game) {
      res.status(404).json({ message: "Game not found" });
      return;
    }

    if (!game.pgn) {
      res.status(404).json({ message: "PGN is not available for this game" });
      return;
    }

    const moves = parseMovesWithClock(game.pgn);
    const keyMoments = buildKeyMoments(moves, game.result, game.color);

    const payload: GameDetail = {
      summary: game,
      pgn: game.pgn,
      moves,
      keyMoments,
    };

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get("/v1/profiles/:platform/:username/stats/basic", async (req, res, next) => {
  try {
    const platform = normalizePlatform(req.params.platform);
    const range = normalizeRange(String(req.query.range ?? undefined));
    const timeControl = normalizeTimeControl(String(req.query.tc ?? undefined));
    const timeControlDetail = normalizeTimeControlDetail(String(req.query.tcd ?? undefined));

    const dataset = await getDataset(platform, req.params.username);
    const filtered = filterGames(dataset.games, range, timeControl, timeControlDetail);

    res.json(buildBasicStats(filtered, range, timeControl));
  } catch (error) {
    next(error);
  }
});

app.get("/v1/profiles/:platform/:username/stats/openings", async (req, res, next) => {
  try {
    const platform = normalizePlatform(req.params.platform);
    const range = normalizeRange(String(req.query.range ?? undefined));
    const timeControl = normalizeTimeControl(String(req.query.tc ?? undefined));
    const timeControlDetail = normalizeTimeControlDetail(String(req.query.tcd ?? undefined));

    const dataset = await getDataset(platform, req.params.username);
    const filtered = filterGames(dataset.games, range, timeControl, timeControlDetail);

    res.json(buildOpeningStats(filtered));
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof Error && error.message === "NOT_FOUND") {
    res.status(404).json({ message: "Player not found" });
    return;
  }

  if (error instanceof Error && error.message.includes("platform must")) {
    res.status(400).json({ message: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ message: "Internal Server Error" });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`chessgg API listening on port ${port}`);
});
