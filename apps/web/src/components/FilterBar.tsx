import {
  TIME_CONTROL_PRESETS_BY_CATEGORY,
  type RangeFilter,
  type TimeControlDetailFilter,
  type TimeControlFilter,
} from "@chessgg/shared";

type FilterBarProps = {
  range: RangeFilter;
  tc: TimeControlFilter;
  tcDetail: TimeControlDetailFilter;
  onRangeChange: (next: RangeFilter) => void;
  onTcChange: (next: TimeControlFilter) => void;
  onTcDetailChange: (next: TimeControlDetailFilter) => void;
};

const categoryLabel: Record<Exclude<TimeControlFilter, "all">, string> = {
  bullet: "불릿",
  blitz: "블리츠",
  rapid: "래피드",
};

export function FilterBar({
  range,
  tc,
  tcDetail,
  onRangeChange,
  onTcChange,
  onTcDetailChange,
}: FilterBarProps) {
  const detailOptions = tc === "all" ? [] : TIME_CONTROL_PRESETS_BY_CATEGORY[tc];

  return (
    <div className="filters">
      <div className="filter-group">
        <span>기간</span>
        <button type="button" className={range === "7d" ? "active" : ""} onClick={() => onRangeChange("7d")}>
          최근 7일
        </button>
        <button type="button" className={range === "30d" ? "active" : ""} onClick={() => onRangeChange("30d")}>
          최근 30일
        </button>
        <button type="button" className={range === "all" ? "active" : ""} onClick={() => onRangeChange("all")}>
          전체
        </button>
      </div>

      <div className="filter-group">
        <span>타임컨트롤</span>
        <button type="button" className={tc === "all" ? "active" : ""} onClick={() => onTcChange("all")}>
          전체
        </button>
        <button type="button" className={tc === "bullet" ? "active" : ""} onClick={() => onTcChange("bullet")}>
          불릿
        </button>
        <button type="button" className={tc === "blitz" ? "active" : ""} onClick={() => onTcChange("blitz")}>
          블리츠
        </button>
        <button type="button" className={tc === "rapid" ? "active" : ""} onClick={() => onTcChange("rapid")}>
          래피드
        </button>
      </div>

      {tc !== "all" ? (
        <div className="filter-group time-detail-wrap">
          <span>{categoryLabel[tc]} 세부</span>
          <div className="time-detail-grid">
            <button
              type="button"
              className={tcDetail === "all" ? "active" : ""}
              onClick={() => onTcDetailChange("all")}
            >
              전체
            </button>
            {detailOptions.map((option) => (
              <button
                type="button"
                key={option.key}
                className={tcDetail === option.key ? "active" : ""}
                onClick={() => onTcDetailChange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
