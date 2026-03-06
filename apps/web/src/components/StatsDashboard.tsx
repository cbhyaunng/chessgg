import type { BasicStats } from "@chessgg/shared";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type StatsDashboardProps = {
  stats: BasicStats;
};

export function StatsDashboard({ stats }: StatsDashboardProps) {
  return (
    <section className="stack-large">
      <div className="summary-grid">
        <article className="card">
          <h3>최대 연승</h3>
          <p className="metric">{stats.longestWinStreak}</p>
        </article>
        <article className="card">
          <h3>최대 연패</h3>
          <p className="metric">{stats.longestLoseStreak}</p>
        </article>
      </div>

      <article className="card chart-card">
        <h3>레이팅 추이</h3>
        {stats.ratingTrend.length === 0 ? (
          <p>표시할 레이팅 데이터가 없습니다.</p>
        ) : (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.ratingTrend}>
                <XAxis
                  dataKey="playedAt"
                  tick={{ fill: "#d8d3ca", fontSize: 12 }}
                  axisLine={{ stroke: "#5a564f" }}
                  tickLine={{ stroke: "#5a564f" }}
                  tickFormatter={(value) =>
                    new Date(value as string).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })
                  }
                />
                <YAxis
                  domain={["dataMin - 20", "dataMax + 20"]}
                  tick={{ fill: "#d8d3ca", fontSize: 12 }}
                  axisLine={{ stroke: "#5a564f" }}
                  tickLine={{ stroke: "#5a564f" }}
                />
                <Tooltip
                  labelFormatter={(value) => new Date(String(value)).toLocaleString("ko-KR")}
                  formatter={(value) => [String(value), "레이팅"]}
                  contentStyle={{
                    background: "#262421",
                    border: "1px solid #4a4641",
                    borderRadius: "8px",
                    color: "#f2f0ec",
                  }}
                />
                <Line type="monotone" dataKey="rating" stroke="#81b64c" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>
    </section>
  );
}
