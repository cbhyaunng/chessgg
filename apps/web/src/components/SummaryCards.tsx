import type { PlayerSummary } from "@chessgg/shared";
import { formatPercent } from "../lib/format";

type SummaryCardsProps = {
  summary: PlayerSummary;
};

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="summary-grid">
      <article className="card">
        <h3>총 경기</h3>
        <p className="metric">{summary.games}</p>
      </article>
      <article className="card">
        <h3>승 / 무 / 패</h3>
        <p className="metric">
          {summary.wins} / {summary.draws} / {summary.losses}
        </p>
      </article>
      <article className="card">
        <h3>승률</h3>
        <p className="metric">{formatPercent(summary.winRate)}</p>
      </article>
    </div>
  );
}
