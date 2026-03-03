import { useState } from "react";
import { useAuth } from "../context/useAuth";

export function PricingPage() {
  const { isAuthenticated, session, startCheckout, openAuthModal } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPro = session?.subscription.plan === "PRO" && session.subscription.status === "ACTIVE";

  return (
    <section className="stack-large">
      <header className="stack-small">
        <h1>요금제</h1>
        <p>기본 전적 검색은 무료, 분석/코칭급 기능은 PRO에서 제공합니다.</p>
      </header>

      <div className="summary-grid">
        <article className="card stack-small">
          <h2>FREE</h2>
          <p className="metric">₩0</p>
          <ul>
            <li>전적 검색/필터/게임 상세</li>
            <li>기본 통계 대시보드</li>
          </ul>
        </article>

        <article className="card stack-small pro-card">
          <h2>PRO</h2>
          <p className="metric">월 구독</p>
          <ul>
            <li>분석 요청(서버 큐)</li>
            <li>블런더/미스 분류 기반 리포트 (M3에서 확장)</li>
            <li>더 높은 분석 쿼터</li>
          </ul>

          {isPro ? <p>현재 PRO 활성 상태입니다.</p> : null}

          <button
            type="button"
            disabled={pending || isPro}
            onClick={async () => {
              if (!isAuthenticated) {
                openAuthModal();
                return;
              }

              setError(null);
              setPending(true);
              try {
                await startCheckout();
              } catch (e) {
                setError((e as Error).message);
                setPending(false);
              }
            }}
          >
            {isPro ? "구독 중" : pending ? "이동 중..." : "PRO 시작"}
          </button>
        </article>
      </div>

      {!isAuthenticated ? (
        <p>
          결제하려면{" "}
          <button
            type="button"
            className="inline-auth-button"
            onClick={() => {
              openAuthModal();
            }}
          >
            로그인
          </button>
          이 필요합니다.
        </p>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}
