import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { getBillingSubscription } from "../lib/api";
import { formatDateTime } from "../lib/format";

export function BillingPage() {
  const [searchParams] = useSearchParams();
  const { session, isAuthenticated, refreshMe, openAuthModal } = useAuth();

  const checkoutState = searchParams.get("checkout");

  const subscriptionQuery = useQuery({
    queryKey: ["billing-subscription", session?.user.id],
    queryFn: async () => {
      if (!session) {
        throw new Error("로그인이 필요합니다.");
      }
      return getBillingSubscription(session.accessToken);
    },
    enabled: Boolean(session),
  });

  if (!isAuthenticated || !session) {
    return (
      <section className="stack-large">
        <article className="card stack-small">
          <h1>결제/구독 관리</h1>
          <p>로그인이 필요합니다.</p>
          <button
            type="button"
            className="inline-auth-button"
            onClick={() => {
              openAuthModal();
            }}
          >
            로그인 열기
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="stack-large">
      <header className="stack-small">
        <h1>결제/구독 관리</h1>
        <p>현재 구독 상태를 확인하고 결제를 진행할 수 있습니다.</p>
      </header>

      {checkoutState === "success" ? <p>결제가 완료되었습니다. 잠시 후 상태가 반영됩니다.</p> : null}
      {checkoutState === "cancel" ? <p>결제가 취소되었습니다.</p> : null}

      <article className="card stack-small">
        {subscriptionQuery.isLoading ? <p>구독 상태를 조회하는 중입니다...</p> : null}
        {subscriptionQuery.isError ? <p className="error-text">{subscriptionQuery.error.message}</p> : null}
        {subscriptionQuery.data ? (
          <>
            <p>
              플랜: <strong>{subscriptionQuery.data.plan}</strong>
            </p>
            <p>
              상태: <strong>{subscriptionQuery.data.status}</strong>
            </p>
            <p>만료일: {formatDateTime(subscriptionQuery.data.periodEnd ?? undefined)}</p>
          </>
        ) : null}

        <div className="billing-actions">
          <button type="button" onClick={() => void refreshMe()}>
            상태 새로고침
          </button>
          <Link to="/pricing">요금제 보기</Link>
        </div>
      </article>
    </section>
  );
}
