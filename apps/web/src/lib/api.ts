import type {
  BasicStats,
  GameDetail,
  GameSummary,
  OpeningStat,
  PaginatedResponse,
  Platform,
  PlayerProfile,
  PlayerSummary,
  RangeFilter,
  TimeControlDetailFilter,
  TimeControlFilter,
} from "@chessgg/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type SearchResult = {
  profile: PlayerProfile;
  games: number;
  latestPlayedAt?: string;
};

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

export function searchPlayer(platform: Platform, query: string): Promise<SearchResult> {
  return request(`/v1/search?platform=${platform}&query=${encodeURIComponent(query)}`);
}

export function getProfileSummary(
  platform: Platform,
  username: string,
  range: RangeFilter,
  tc: TimeControlFilter,
  tcd: TimeControlDetailFilter,
): Promise<PlayerSummary> {
  return request(
    `/v1/profiles/${platform}/${encodeURIComponent(username)}/summary?range=${range}&tc=${tc}&tcd=${encodeURIComponent(tcd)}`,
  );
}

export function getGames(
  platform: Platform,
  username: string,
  range: RangeFilter,
  tc: TimeControlFilter,
  tcd: TimeControlDetailFilter,
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<GameSummary>> {
  return request(
    `/v1/profiles/${platform}/${encodeURIComponent(username)}/games?range=${range}&tc=${tc}&tcd=${encodeURIComponent(tcd)}&page=${page}&pageSize=${pageSize}`,
  );
}

export function getGameDetail(platform: Platform, username: string, gameId: string): Promise<GameDetail> {
  return request(`/v1/profiles/${platform}/${encodeURIComponent(username)}/games/${encodeURIComponent(gameId)}`);
}

export function getBasicStats(
  platform: Platform,
  username: string,
  range: RangeFilter,
  tc: TimeControlFilter,
  tcd: TimeControlDetailFilter,
): Promise<BasicStats> {
  return request(
    `/v1/profiles/${platform}/${encodeURIComponent(username)}/stats/basic?range=${range}&tc=${tc}&tcd=${encodeURIComponent(tcd)}`,
  );
}

export function getOpeningStats(
  platform: Platform,
  username: string,
  range: RangeFilter,
  tc: TimeControlFilter,
  tcd: TimeControlDetailFilter,
): Promise<OpeningStat[]> {
  return request(
    `/v1/profiles/${platform}/${encodeURIComponent(username)}/stats/openings?range=${range}&tc=${tc}&tcd=${encodeURIComponent(tcd)}`,
  );
}
