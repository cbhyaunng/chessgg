import { Link, Outlet } from "react-router-dom";

export function Layout() {
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
          </nav>
        </div>
      </header>

      <main className="container page-content">
        <Outlet />
      </main>
    </div>
  );
}
