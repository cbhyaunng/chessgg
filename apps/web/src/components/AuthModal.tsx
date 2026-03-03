import { GoogleLogin } from "@react-oauth/google";
import { useEffect, useState } from "react";
import { useAuth } from "../context/useAuth";
import { isSupabaseConfigured } from "../lib/supabase";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isAuthModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setError(null);
        setPending(false);
        closeAuthModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) {
    return null;
  }

  return (
    <div
      className="auth-modal-backdrop"
      onClick={() => {
        setError(null);
        setPending(false);
        closeAuthModal();
      }}
    >
      <article
        className="auth-modal card stack-small"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="auth-modal-header">
          <h2>로그인 하기</h2>
          <button
            type="button"
            className="nav-action"
            onClick={() => {
              setError(null);
              setPending(false);
              closeAuthModal();
            }}
          >
            닫기
          </button>
        </div>

        <p>현재 화면에서 바로 로그인할 수 있습니다.</p>

        {!googleClientId ? <p className="error-text">VITE_GOOGLE_CLIENT_ID가 설정되지 않았습니다.</p> : null}
        {!isSupabaseConfigured ? (
          <p className="error-text">VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 설정되지 않았습니다.</p>
        ) : null}

        <div className="google-login-wrap">
          {googleClientId && isSupabaseConfigured ? (
            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                const idToken = credentialResponse.credential;
                if (!idToken) {
                  setError("Google credential을 받지 못했습니다.");
                  return;
                }

                setError(null);
                setPending(true);

                try {
                  await loginWithGoogle(idToken);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setPending(false);
                }
              }}
              onError={() => {
                setError("Google 로그인에 실패했습니다.");
              }}
              useOneTap={false}
            />
          ) : null}
        </div>

        {pending ? <p>로그인 처리 중...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </article>
    </div>
  );
}
