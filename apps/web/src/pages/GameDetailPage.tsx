import { useMutation, useQuery } from "@tanstack/react-query";
import type { Platform } from "@chessgg/shared";
import { Chess } from "chess.js";
import { useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getAnalysisJob, getGameDetail, runAnalysis } from "../lib/api";
import { useAuth } from "../context/useAuth";
import {
  formatDateTime,
  formatDurationSec,
  formatNumber,
  formatTimeControl,
  toColorLabel,
  toGameResultLabel,
} from "../lib/format";

function toPlatform(value: string | undefined): Platform {
  return value === "lichess" ? "lichess" : "chesscom";
}

export function GameDetailPage() {
  const params = useParams<{ platform: string; username: string; gameId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const platform = toPlatform(params.platform);
  const username = decodeURIComponent(params.username ?? "");
  const gameId = params.gameId ?? "";
  const { session, isAuthenticated, openAuthModal } = useAuth();

  const detailQuery = useQuery({
    queryKey: ["game-detail", platform, username, gameId],
    queryFn: () => getGameDetail(platform, username, gameId),
  });

  const analysisJobId = searchParams.get("analysisJob") ?? "";
  const analysisQuery = useQuery({
    queryKey: ["analysis-job", analysisJobId, session?.user.id],
    queryFn: () => getAnalysisJob(session!.accessToken, analysisJobId),
    enabled: Boolean(analysisJobId && session?.accessToken),
    refetchInterval: (query) => (query.state.data?.status === "QUEUED" || query.state.data?.status === "PROCESSING" ? 5000 : false),
  });

  const analysisMutation = useMutation({
    mutationFn: async () => {
      if (!session) {
        throw new Error("로그인이 필요합니다.");
      }
      return runAnalysis(session.accessToken, platform, username, gameId);
    },
    onSuccess: (result) => {
      setSearchParams((prev) => {
        const draft = new URLSearchParams(prev);
        draft.set("analysisJob", result.jobId);
        return draft;
      });
    },
  });

  const fens = useMemo(() => {
    if (!detailQuery.data) {
      return [new Chess().fen()];
    }

    const chess = new Chess();
    const snapshots = [chess.fen()];

    for (const move of detailQuery.data.moves) {
      try {
        chess.move(move.san, { strict: false });
      } catch {
        break;
      }
      snapshots.push(chess.fen());
    }

    return snapshots;
  }, [detailQuery.data]);

  if (detailQuery.isLoading) {
    return <p>게임 데이터를 불러오는 중입니다...</p>;
  }

  if (detailQuery.isError) {
    return <p className="error-text">{detailQuery.error.message}</p>;
  }

  if (!detailQuery.data) {
    return <p>게임 데이터를 찾을 수 없습니다.</p>;
  }

  const { summary, moves, keyMoments, pgn } = detailQuery.data;
  const plyFromQuery = Number(searchParams.get("ply") ?? `${moves.length}`);
  const plyIndex = Number.isFinite(plyFromQuery) ? Math.max(0, Math.min(moves.length, plyFromQuery)) : moves.length;

  const updatePly = (next: number) => {
    setSearchParams((prev) => {
      const draft = new URLSearchParams(prev);
      draft.set("ply", String(Math.max(0, Math.min(moves.length, next))));
      return draft;
    });
  };

  const groupedMoves = [] as Array<{ moveNo: number; white?: number; black?: number }>;
  for (let i = 0; i < moves.length; i += 2) {
    groupedMoves.push({
      moveNo: Math.floor(i / 2) + 1,
      white: i + 1,
      black: i + 2 <= moves.length ? i + 2 : undefined,
    });
  }

  return (
    <section className="stack-large">
      <article className="card stack-small">
        <Link to={`/player/${platform}/${encodeURIComponent(username)}`}>← 플레이어 페이지로</Link>
        <h1>게임 상세</h1>
        <p>
          {formatDateTime(summary.playedAt)} · {toGameResultLabel(summary.result)} · {formatTimeControl(summary.timeControl)}{" "}
          · {summary.opening ?? "Unknown"}
        </p>
        <p>
          내 색: <strong>{toColorLabel(summary.color)}</strong> / 상대: {summary.opponent.username} (
          {formatNumber(summary.opponent.rating)}) / 내 시간 사용량: {formatDurationSec(summary.timeSpentSec)}
        </p>
      </article>

      <div className="game-detail-grid">
        <article className="card stack-small">
          <h2>보드 ({toColorLabel(summary.color)} 아래)</h2>
          <div className="board-wrap">
            <Chessboard
              position={fens[Math.min(plyIndex, fens.length - 1)]}
              arePiecesDraggable={false}
              boardOrientation={summary.color}
            />
          </div>
          <div className="board-controls">
            <button onClick={() => updatePly(0)} disabled={plyIndex <= 0}>
              처음
            </button>
            <button onClick={() => updatePly(plyIndex - 1)} disabled={plyIndex <= 0}>
              이전 수
            </button>
            <span>
              {plyIndex} / {moves.length}
            </span>
            <button
              onClick={() => updatePly(plyIndex + 1)}
              disabled={plyIndex >= moves.length}
            >
              다음 수
            </button>
            <button onClick={() => updatePly(moves.length)} disabled={plyIndex >= moves.length}>
              마지막
            </button>
          </div>
        </article>

        <div className="stack-large">
          <article className="card stack-small">
            <h2>착수 목록</h2>
            <div className="moves-table">
              {groupedMoves.map((row) => (
                <div key={row.moveNo} className="move-row">
                  <span className="move-no">{row.moveNo}.</span>
                  <button
                    className={plyIndex === row.white ? "active" : ""}
                    onClick={() => row.white && updatePly(row.white)}
                    disabled={!row.white}
                  >
                    {row.white ? moves[row.white - 1].san : ""}
                  </button>
                  <button
                    className={plyIndex === row.black ? "active" : ""}
                    onClick={() => row.black && updatePly(row.black)}
                    disabled={!row.black}
                  >
                    {row.black ? moves[row.black - 1].san : ""}
                  </button>
                </div>
              ))}
            </div>
          </article>

          <article className="card stack-small">
            <h2>중요 국면 하이라이트</h2>
            <ul className="highlight-list">
              {keyMoments.map((moment) => (
                <li key={`${moment.ply}-${moment.label}`}>
                  <strong>{moment.label}</strong> (ply {moment.ply})
                  <p>{moment.description}</p>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>

      <article className="card stack-small">
        <h2>PGN</h2>
        <textarea readOnly value={pgn} className="pgn-box" />
      </article>

      <article className="card stack-small">
        <h2>PRO 분석 요청</h2>
        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => analysisMutation.mutate()}
            disabled={analysisMutation.isPending}
          >
            {analysisMutation.isPending ? "요청 중..." : "분석 요청"}
          </button>
        ) : (
          <p>
            <button
              type="button"
              className="inline-auth-button"
              onClick={() => {
                openAuthModal();
              }}
            >
              로그인
            </button>{" "}
            후 PRO 플랜에서 사용할 수 있습니다.
          </p>
        )}

        {analysisMutation.isError ? <p className="error-text">{analysisMutation.error.message}</p> : null}
        {analysisMutation.isSuccess ? <p>분석 작업이 큐에 등록되었습니다.</p> : null}
        {analysisQuery.data ? (
          <p>
            분석 상태: <strong>{analysisQuery.data.status}</strong> / 작업 ID: {analysisQuery.data.id}
          </p>
        ) : null}
        {analysisQuery.isError ? <p className="error-text">{analysisQuery.error.message}</p> : null}
      </article>
    </section>
  );
}
