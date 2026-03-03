import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="stack-small">
      <h1>페이지를 찾을 수 없습니다.</h1>
      <Link to="/">홈으로 이동</Link>
    </section>
  );
}
