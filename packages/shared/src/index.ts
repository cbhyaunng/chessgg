export type Platform = "chesscom" | "lichess";

export type RangeFilter = "7d" | "30d" | "all";

export type TimeControlFilter = "bullet" | "blitz" | "rapid" | "all";
export type TimeControlCategory = Exclude<TimeControlFilter, "all">;
export type TimeControlDetailFilter = "all" | `${number}+${number}`;

export type GameResult = "win" | "draw" | "loss";

export type KeyMomentType = "swing" | "blunder" | "miss" | "inaccuracy";

export interface PlayerProfile {
  platform: Platform;
  username: string;
  avatarUrl?: string;
  title?: string;
  country?: string;
  joinedAt?: string;
  ratingBullet?: number;
  ratingBlitz?: number;
  ratingRapid?: number;
}

export interface PlayerSummary {
  profile: PlayerProfile;
  range: RangeFilter;
  timeControl: TimeControlFilter;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

export interface OpponentInfo {
  username: string;
  rating?: number;
}

export interface GameSummary {
  id: string;
  platform: Platform;
  platformGameId: string;
  url: string;
  playedAt: string;
  timeControl: string;
  timeControlCategory: TimeControlFilter | "other";
  rated: boolean;
  color: "white" | "black";
  result: GameResult;
  opponent: OpponentInfo;
  playerRating?: number;
  opening?: string;
  eco?: string;
  pgn?: string;
  totalMoves?: number;
  timeSpentSec?: number;
}

export interface MoveInfo {
  ply: number;
  san: string;
  clockSec?: number;
  spentSec?: number;
}

export interface KeyMoment {
  ply: number;
  type: KeyMomentType;
  label: string;
  description: string;
}

export interface GameDetail {
  summary: GameSummary;
  pgn: string;
  moves: MoveInfo[];
  keyMoments: KeyMoment[];
}

export interface RatingPoint {
  playedAt: string;
  rating: number;
}

export interface HourlyRecord {
  hour: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
}

export interface OpeningStat {
  opening: string;
  eco?: string;
  asColor: "white" | "black";
  games: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  avgPerformance?: number;
}

export interface BasicStats {
  range: RangeFilter;
  timeControl: TimeControlFilter;
  wins: number;
  draws: number;
  losses: number;
  longestWinStreak: number;
  longestLoseStreak: number;
  ratingTrend: RatingPoint[];
  hourly: HourlyRecord[];
}

export interface PaginatedResponse<T> {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
}

export interface TimeControlPreset {
  key: `${number}+${number}`;
  label: string;
  category: TimeControlCategory;
}

export const TIME_CONTROL_PRESETS: TimeControlPreset[] = [
  { category: "bullet", key: "60+0", label: "1분" },
  { category: "bullet", key: "60+1", label: "1|1" },
  { category: "bullet", key: "120+1", label: "2|1" },
  { category: "bullet", key: "30+0", label: "30초" },
  { category: "bullet", key: "20+1", label: "20초|1" },

  { category: "blitz", key: "180+0", label: "3분" },
  { category: "blitz", key: "180+2", label: "3|2" },
  { category: "blitz", key: "300+0", label: "5분" },
  { category: "blitz", key: "300+5", label: "5|5" },
  { category: "blitz", key: "300+2", label: "5|2" },

  { category: "rapid", key: "600+0", label: "10분" },
  { category: "rapid", key: "900+10", label: "15|10" },
  { category: "rapid", key: "1800+0", label: "30분" },
  { category: "rapid", key: "600+5", label: "10|5" },
  { category: "rapid", key: "1200+0", label: "20분" },
  { category: "rapid", key: "3600+0", label: "60분" },
];

export const TIME_CONTROL_PRESETS_BY_CATEGORY: Record<TimeControlCategory, TimeControlPreset[]> = {
  bullet: TIME_CONTROL_PRESETS.filter((preset) => preset.category === "bullet"),
  blitz: TIME_CONTROL_PRESETS.filter((preset) => preset.category === "blitz"),
  rapid: TIME_CONTROL_PRESETS.filter((preset) => preset.category === "rapid"),
};

const presetLabelMap = new Map<string, string>(
  TIME_CONTROL_PRESETS.map((preset) => [preset.key, preset.label]),
);

export function parseTimeControlKey(raw: string | undefined): `${number}+${number}` | undefined {
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.replace(/\s+/g, "+");

  const plusMatch = normalized.match(/^(\d+)\+(\d+)$/);
  if (plusMatch) {
    return `${Number(plusMatch[1])}+${Number(plusMatch[2])}`;
  }

  const plainMatch = normalized.match(/^(\d+)$/);
  if (plainMatch) {
    return `${Number(plainMatch[1])}+0`;
  }

  return undefined;
}

function secBaseLabel(initialSec: number): string {
  if (initialSec % 60 === 0) {
    return `${initialSec / 60}`;
  }
  return `${initialSec}초`;
}

export function formatTimeControlLabel(raw: string | undefined): string {
  if (!raw) {
    return "-";
  }

  const parsed = parseTimeControlKey(raw);
  if (!parsed) {
    return raw;
  }

  const preset = presetLabelMap.get(parsed);
  if (preset) {
    return preset;
  }

  const [initialRaw, incrementRaw] = parsed.split("+");
  const initialSec = Number(initialRaw);
  const incrementSec = Number(incrementRaw);

  if (incrementSec === 0) {
    return initialSec % 60 === 0 ? `${initialSec / 60}분` : `${initialSec}초`;
  }

  return `${secBaseLabel(initialSec)}|${incrementSec}`;
}
