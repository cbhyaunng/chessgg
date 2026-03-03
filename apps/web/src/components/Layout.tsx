import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { AuthModal } from "./AuthModal";

export function Layout() {
  const { session, isAuthenticated, logout, openAuthModal } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="brand">
            chessgg
          </Link>
          <nav className="top-nav">
            <Link to="/" className="nav-link">
              전적 검색
            </Link>
            <Link to="/pricing" className="nav-link">
              요금제
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/account/billing" className="nav-link">
                  결제관리
                </Link>
                <span className="auth-email">{session?.user.email}</span>
                <button
                  type="button"
                  className="nav-action"
                  onClick={() => {
                    void logout();
                  }}
                >
                  로그아웃
                </button>
              </>
            ) : (
              <button
                type="button"
                className="nav-action"
                onClick={() => {
                  openAuthModal();
                }}
              >
                로그인
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="container page-content">
        <Outlet />
      </main>
      <AuthModal />
    </div>
  );
}
