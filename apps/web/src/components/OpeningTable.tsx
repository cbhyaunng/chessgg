import type { OpeningStat } from "@chessgg/shared";

type OpeningTableProps = {
  items: OpeningStat[];
};

export function OpeningTable({ items }: OpeningTableProps) {
  return (
    <article className="card">
      <h3>오프닝별 성적</h3>
      <div className="table-wrap">
        <table className="games-table">
          <thead>
            <tr>
              <th>오프닝</th>
              <th>색</th>
              <th>판수</th>
              <th>승/무/패</th>
              <th>승률</th>
              <th>평균 퍼포먼스</th>
            </tr>
          </thead>
          <tbody>
            {items.map((opening) => (
              <tr key={`${opening.opening}-${opening.asColor}`}>
                <td>{opening.opening}</td>
                <td>{opening.asColor === "white" ? "백" : "흑"}</td>
                <td>{opening.games}</td>
                <td>
                  {opening.wins}/{opening.draws}/{opening.losses}
                </td>
                <td>{opening.winRate.toFixed(1)}%</td>
                <td>{opening.avgPerformance?.toFixed(0) ?? "-"}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">
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
