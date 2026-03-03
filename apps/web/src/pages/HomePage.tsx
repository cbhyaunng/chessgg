import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Platform } from "@chessgg/shared";
import { SearchForm } from "../components/SearchForm";
import { searchPlayer } from "../lib/api";

export function HomePage() {
  const navigate = useNavigate();
  const searchMutation = useMutation({
    mutationFn: ({ platform, username }: { platform: Platform; username: string }) => searchPlayer(platform, username),
    onSuccess: (_data, variables) => {
      navigate(`/player/${variables.platform}/${encodeURIComponent(variables.username)}`);
    },
  });

  return (
    <section className="stack-large home-page">
      <header className="stack-small home-header">
        <h1>체스 전적 검색</h1>
        <p>Chess.com, Lichess 닉네임으로 전적을 조회하고 오프닝/시간관리 통계를 확인하세요.</p>
      </header>

      <article className="card stack-small home-search-card">
        <h2>유저 검색</h2>
        <SearchForm onSubmit={(payload) => searchMutation.mutate(payload)} disabled={searchMutation.isPending} />
        {searchMutation.isPending ? <p>검색 중입니다...</p> : null}
        {searchMutation.isError ? <p className="error-text">{searchMutation.error.message}</p> : null}
      </article>

      <article className="card stack-small home-mvp-card">
        <h2>핵심 기능 (MVP)</h2>
        <ul className="home-mvp-list">
          <li>플랫폼별 프로필/전적 요약</li>
          <li>기간/시간컨트롤 필터</li>
          <li>게임 리스트 + 한 판 상세</li>
          <li>PGN + 중요 국면 하이라이트</li>
          <li>승무패, 레이팅 추이, 연승/연패, 시간대별 성적</li>
          <li>오프닝별 성적 (백/흑, 승률, 평균 퍼포먼스)</li>
        </ul>
      </article>
    </section>
  );
}
