import { useQuery } from "@tanstack/react-query";
import type { Platform, RangeFilter, TimeControlDetailFilter, TimeControlFilter } from "@chessgg/shared";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { FilterBar } from "../components/FilterBar";
import { GameTable } from "../components/GameTable";
import { OpeningTable } from "../components/OpeningTable";
import { SearchForm } from "../components/SearchForm";
import { StatsDashboard } from "../components/StatsDashboard";
import { SummaryCards } from "../components/SummaryCards";
import { getBasicStats, getGames, getOpeningStats, getProfileSummary } from "../lib/api";

function toRange(value: string | null): RangeFilter {
  if (value === "7d" || value === "30d" || value === "all") {
    return value;
  }
  return "30d";
}

function toTimeControl(value: string | null): TimeControlFilter {
  if (value === "bullet" || value === "blitz" || value === "rapid" || value === "all") {
    return value;
  }
  return "all";
}

function toTimeControlDetail(value: string | null): TimeControlDetailFilter {
  if (!value || value === "all") {
    return "all";
  }
  const normalized = value.replace(/\s+/g, "+");
  return /^\d+\+\d+$/.test(normalized) ? (normalized as TimeControlDetailFilter) : "all";
}

export function PlayerPage() {
  const params = useParams<{ platform: string; username: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const platform = (params.platform === "chesscom" || params.platform === "lichess" ? params.platform : "chesscom") as Platform;
  const username = decodeURIComponent(params.username ?? "");

  const range = toRange(searchParams.get("range"));
  const tc = toTimeControl(searchParams.get("tc"));
  const tcd = toTimeControlDetail(searchParams.get("tcd"));
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

  const summaryQuery = useQuery({
    queryKey: ["summary", platform, username, range, tc, tcd],
    queryFn: () => getProfileSummary(platform, username, range, tc, tcd),
  });

  const gamesQuery = useQuery({
    queryKey: ["games", platform, username, range, tc, tcd, page],
    queryFn: () => getGames(platform, username, range, tc, tcd, page, 20),
  });

  const statsQuery = useQuery({
    queryKey: ["basic-stats", platform, username, range, tc, tcd],
    queryFn: () => getBasicStats(platform, username, range, tc, tcd),
  });

  const openingQuery = useQuery({
    queryKey: ["opening-stats", platform, username, range, tc, tcd],
    queryFn: () => getOpeningStats(platform, username, range, tc, tcd),
  });

  const isLoading = summaryQuery.isLoading || gamesQuery.isLoading || statsQuery.isLoading || openingQuery.isLoading;
  const error = summaryQuery.error ?? gamesQuery.error ?? statsQuery.error ?? openingQuery.error;

  const totalPages = useMemo(() => {
    if (!gamesQuery.data) {
      return 1;
    }
    return Math.max(1, Math.ceil(gamesQuery.data.total / gamesQuery.data.pageSize));
  }, [gamesQuery.data]);

  const updateFilters = (next: {
    range?: RangeFilter;
    tc?: TimeControlFilter;
    tcd?: TimeControlDetailFilter;
    page?: number;
  }) => {
    setSearchParams((prev) => {
      const draft = new URLSearchParams(prev);
      if (next.range) {
        draft.set("range", next.range);
      }
      if (next.tc) {
        draft.set("tc", next.tc);
      }
      if (next.tcd) {
        draft.set("tcd", next.tcd);
      }
      draft.set("page", String(next.page ?? 1));
      return draft;
    });
  };

  return (
    <section className="stack-large">
      <article className="card stack-small">
        <h1>
          {platform === "chesscom" ? "Chess.com" : "Lichess"} · {username}
        </h1>
        <SearchForm
          defaultPlatform={platform}
          defaultUsername={username}
          onSubmit={({ platform: nextPlatform, username: nextUsername }) => {
            window.location.href = `/player/${nextPlatform}/${encodeURIComponent(nextUsername)}`;
          }}
        />
      </article>

      <FilterBar
        range={range}
        tc={tc}
        tcDetail={tcd}
        onRangeChange={(nextRange) => updateFilters({ range: nextRange })}
        onTcChange={(nextTc) => updateFilters({ tc: nextTc, tcd: "all" })}
        onTcDetailChange={(nextTcd) => updateFilters({ tcd: nextTcd })}
      />

      {isLoading ? <p>데이터를 불러오는 중입니다...</p> : null}
      {error ? <p className="error-text">{(error as Error).message}</p> : null}

      {!isLoading && !error && summaryQuery.data && gamesQuery.data && statsQuery.data && openingQuery.data ? (
        <>
          <SummaryCards summary={summaryQuery.data} />

          <article className="card stack-small">
            <h2>게임 리스트</h2>
            <GameTable platform={platform} username={username} games={gamesQuery.data.items} />
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => updateFilters({ page: page - 1 })}>
                이전
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => updateFilters({ page: page + 1 })}>
                다음
              </button>
            </div>
          </article>

          <StatsDashboard stats={statsQuery.data} />
          <OpeningTable items={openingQuery.data} />
        </>
      ) : null}
    </section>
  );
}
