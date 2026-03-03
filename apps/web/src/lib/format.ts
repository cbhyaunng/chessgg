import { formatTimeControlLabel } from "@chessgg/shared";

export function formatDateTime(iso: string | undefined): string {
  if (!iso) {
    return "-";
  }

  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number | undefined): string {
  if (value === undefined) {
    return "-";
  }
  return value.toLocaleString("ko-KR");
}

export function formatDurationSec(value: number | undefined): string {
  if (value === undefined) {
    return "-";
  }

  const totalSec = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;

  return `${String(minutes).padStart(2, "0")}분${String(seconds).padStart(2, "0")}초`;
}

export function formatTimeControl(raw: string | undefined): string {
  return formatTimeControlLabel(raw);
}

export function toGameResultLabel(result: "win" | "draw" | "loss"): string {
  if (result === "win") {
    return "승";
  }
  if (result === "draw") {
    return "무";
  }
  return "패";
}

export function toColorLabel(color: "white" | "black"): string {
  return color === "white" ? "백" : "흑";
}
