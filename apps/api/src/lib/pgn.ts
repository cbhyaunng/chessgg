import type { GameResult, KeyMoment, MoveInfo } from "@chessgg/shared";

const RESULT_TOKENS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);

const DRAW_RESULTS = new Set([
  "agreed",
  "repetition",
  "stalemate",
  "insufficient",
  "50move",
  "timevsinsufficient",
  "draw",
]);

export function parsePgnTags(pgn: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const tagMatches = pgn.matchAll(/^\[(\w+)\s+"(.*)"\]$/gm);

  for (const match of tagMatches) {
    const [, key, value] = match;
    tags[key] = value;
  }

  return tags;
}

function parseClockToSec(raw: string): number | undefined {
  const parts = raw.split(":").map((p) => Number(p));
  if (parts.some((v) => Number.isNaN(v))) {
    return undefined;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return undefined;
}

function isMoveNumberToken(token: string): boolean {
  return /^\d+\.{1,3}$/.test(token);
}

function isNAGToken(token: string): boolean {
  return /^\$\d+$/.test(token);
}

export function parseMovesWithClock(pgn: string): MoveInfo[] {
  const body = pgn.split(/\n\n/).slice(1).join(" ");
  if (!body.trim()) {
    return [];
  }

  const tokens = body.match(/\{[^}]*\}|[^\s]+/g) ?? [];
  const moves: MoveInfo[] = [];

  for (const token of tokens) {
    if (token.startsWith("{")) {
      const clockMatch = token.match(/\[%clk\s+([^\]]+)\]/);
      if (clockMatch && moves.length > 0) {
        const sec = parseClockToSec(clockMatch[1]);
        if (sec !== undefined) {
          moves[moves.length - 1].clockSec = sec;
        }
      }
      continue;
    }

    if (isMoveNumberToken(token) || RESULT_TOKENS.has(token) || isNAGToken(token)) {
      continue;
    }

    const cleaned = token.replace(/[!?+#]+$/g, "");
    if (!cleaned) {
      continue;
    }

    moves.push({
      ply: moves.length + 1,
      san: cleaned,
    });
  }

  let prevWhiteClock: number | undefined;
  let prevBlackClock: number | undefined;

  for (const move of moves) {
    const isWhite = move.ply % 2 === 1;
    const prev = isWhite ? prevWhiteClock : prevBlackClock;

    if (move.clockSec !== undefined && prev !== undefined && prev >= move.clockSec) {
      move.spentSec = prev - move.clockSec;
    }

    if (move.clockSec !== undefined) {
      if (isWhite) {
        prevWhiteClock = move.clockSec;
      } else {
        prevBlackClock = move.clockSec;
      }
    }
  }

  return moves;
}

export function mapResultFromPlayerResult(raw: string): GameResult {
  if (raw === "win") {
    return "win";
  }

  if (DRAW_RESULTS.has(raw)) {
    return "draw";
  }

  return "loss";
}

export function buildKeyMoments(
  moves: MoveInfo[],
  result: GameResult,
  color: "white" | "black",
): KeyMoment[] {
  const keyMoments: KeyMoment[] = [];

  for (const move of moves) {
    const isPlayersMove = color === "white" ? move.ply % 2 === 1 : move.ply % 2 === 0;
    if (!isPlayersMove) {
      continue;
    }

    if (move.clockSec !== undefined && move.clockSec <= 20) {
      keyMoments.push({
        ply: move.ply,
        type: "swing",
        label: "타임 트러블",
        description: "남은 시간이 20초 이하로 내려갔습니다.",
      });
      continue;
    }

    if (move.spentSec !== undefined && move.spentSec >= 30) {
      keyMoments.push({
        ply: move.ply,
        type: "inaccuracy",
        label: "장고 구간",
        description: "한 수에 30초 이상 사용했습니다.",
      });
    }
  }

  if (moves.length > 0) {
    keyMoments.push({
      ply: Math.max(1, moves.length - 3),
      type: result === "loss" ? "blunder" : "swing",
      label: result === "loss" ? "종반 결정 구간" : "종반 핵심 구간",
      description:
        result === "loss"
          ? "종반에서 결과가 기울어진 구간입니다."
          : "결과를 확정지은 종반 흐름입니다.",
    });
  }

  return keyMoments.slice(0, 8);
}
