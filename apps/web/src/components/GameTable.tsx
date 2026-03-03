import { Link } from "react-router-dom";
import type { GameSummary, Platform } from "@chessgg/shared";
import {
  formatDateTime,
  formatDurationSec,
  formatNumber,
  formatTimeControl,
  toColorLabel,
  toGameResultLabel,
} from "../lib/format";

type GameTableProps = {
  platform: Platform;
  username: string;
  games: GameSummary[];
};

export function GameTable({ platform, username, games }: GameTableProps) {
  return (
    <div className="table-wrap">
      <table className="games-table">
        <thead>
          <tr>
            <th>일시</th>
            <th>결과</th>
            <th>흑백</th>
            <th>타임컨트롤</th>
            <th>오프닝</th>
            <th>상대</th>
            <th>상대 레이팅</th>
            <th>내 시간 사용량</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.id}>
              <td>{formatDateTime(game.playedAt)}</td>
              <td className={`result-${game.result}`}>{toGameResultLabel(game.result)}</td>
              <td>
                <span className={`color-badge color-${game.color}`}>{toColorLabel(game.color)}</span>
              </td>
              <td>{formatTimeControl(game.timeControl)}</td>
              <td>{game.opening ?? "-"}</td>
              <td>{game.opponent.username}</td>
              <td>{formatNumber(game.opponent.rating)}</td>
              <td>{formatDurationSec(game.timeSpentSec)}</td>
              <td>
                <Link to={`/player/${platform}/${encodeURIComponent(username)}/game/${game.platformGameId}`}>상세</Link>
              </td>
            </tr>
          ))}
          {games.length === 0 ? (
            <tr>
              <td colSpan={9} className="empty-cell">
                조건에 맞는 게임이 없습니다.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
