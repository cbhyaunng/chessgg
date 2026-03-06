import type { OpeningStat } from "@chessgg/shared";
import { formatNumber, formatOpeningName, formatPercent } from "../lib/format";

type OpeningTableProps = {
  items: OpeningStat[];
};

export function OpeningTable({ items }: OpeningTableProps) {
  return (
    <article className="card stack-small">
      <h3>오프닝별 성적</h3>
      <p className="muted-text">오프닝별 사용 횟수와 백/흑 성적을 한 번에 확인합니다.</p>
      <div className="table-wrap">
        <table className="games-table">
          <thead>
            <tr>
              <th>오프닝</th>
              <th>판수</th>
              <th>백 전적</th>
              <th>백 승률</th>
              <th>흑 전적</th>
              <th>흑 승률</th>
              <th>평균 퍼포먼스</th>
            </tr>
          </thead>
          <tbody>
            {items.map((opening) => (
              <tr key={`${opening.eco ?? "unknown"}-${opening.opening}`}>
                <td>
                  <strong>{formatOpeningName(opening.opening)}</strong>
                  {opening.eco ? <div className="table-subtext">{opening.eco}</div> : null}
                </td>
                <td>{formatNumber(opening.games)}</td>
                <td>
                  {opening.white.games === 0
                    ? "-"
                    : `${opening.white.wins}/${opening.white.draws}/${opening.white.losses}`}
                </td>
                <td>{opening.white.games === 0 ? "-" : formatPercent(opening.white.winRate)}</td>
                <td>
                  {opening.black.games === 0
                    ? "-"
                    : `${opening.black.wins}/${opening.black.draws}/${opening.black.losses}`}
                </td>
                <td>{opening.black.games === 0 ? "-" : formatPercent(opening.black.winRate)}</td>
                <td>{opening.avgPerformance?.toFixed(0) ?? "-"}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  오프닝 데이터가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </article>
  );
}
