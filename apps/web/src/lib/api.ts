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

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string | null;
  headers?: Record<string, string>;
};

type SearchResult = {
  profile: PlayerProfile;
  games: number;
  latestPlayedAt?: string;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
  };
  subscription: {
    plan: "FREE" | "PRO";
    status: "INACTIVE" | "ACTIVE" | "CANCELED" | "PAST_DUE";
    periodEnd: string | null;
  };
};

export type MeResponse = {
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
  subscription: {
    plan: "FREE" | "PRO";
    status: "INACTIVE" | "ACTIVE" | "CANCELED" | "PAST_DUE";
    periodEnd: string | null;
  };
};

export type BillingSubscriptionResponse = {
  plan: "FREE" | "PRO";
  status: "INACTIVE" | "ACTIVE" | "CANCELED" | "PAST_DUE";
  periodEnd: string | null;
};

export type CheckoutResponse = {
  sessionId: string;
  url: string | null;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? `Request failed: ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
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

export function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  return request("/v1/auth/google", {
    method: "POST",
    body: { idToken },
  });
}

export function refreshAuth(refreshToken: string): Promise<AuthResponse> {
  return request("/v1/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });
}

export function logoutAuth(accessToken: string, refreshToken?: string, all = true): Promise<void> {
  return request("/v1/auth/logout", {
    method: "POST",
    accessToken,
    body: { refreshToken, all },
  });
}

export function getMe(accessToken: string): Promise<MeResponse> {
  return request("/v1/auth/me", { accessToken });
}

export function getBillingSubscription(accessToken: string): Promise<BillingSubscriptionResponse> {
  return request("/v1/billing/subscription", { accessToken });
}

export function createCheckoutSession(accessToken: string): Promise<CheckoutResponse> {
  return request("/v1/billing/checkout-session", {
    method: "POST",
    accessToken,
  });
}

export function runAnalysis(accessToken: string, platform: Platform, username: string, gameId: string): Promise<{
  jobId: string;
  status: string;
  message: string;
}> {
  return request(`/v1/analysis/games/${platform}/${encodeURIComponent(username)}/${encodeURIComponent(gameId)}/run`, {
    method: "POST",
    accessToken,
  });
}

export function getAnalysisJob(accessToken: string, jobId: string): Promise<{
  id: string;
  status: string;
  requestedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
  platform: string;
  username: string;
  platformGameId: string;
}> {
  return request(`/v1/analysis/jobs/${encodeURIComponent(jobId)}`, {
    accessToken,
  });
}
