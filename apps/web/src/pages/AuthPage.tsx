import { GoogleLogin } from "@react-oauth/google";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function AuthPage() {
  const navigate = useNavigate();
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <section className="stack-large auth-page">
      <article className="card stack-small auth-card">
        <h1>구글 로그인</h1>
        <p>일반 이메일 로그인은 비활성화되었습니다. 구글 계정으로 로그인하세요.</p>

        {!googleClientId ? <p className="error-text">VITE_GOOGLE_CLIENT_ID가 설정되지 않았습니다.</p> : null}

        <div className="google-login-wrap">
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
                navigate("/");
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
        </div>

        {pending ? <p>로그인 처리 중...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </article>
    </section>
  );
}
