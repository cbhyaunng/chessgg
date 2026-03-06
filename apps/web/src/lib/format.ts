import { formatTimeControlLabel } from "@chessgg/shared";

const OPENING_TRANSLATIONS: Array<[string, string]> = [
  ["King's Pawn Opening", "킹즈 폰 오프닝"],
  ["Kings Pawn Opening", "킹즈 폰 오프닝"],
  ["King's Knight Variation", "킹즈 나이트 바리에이션"],
  ["Kings Knight Variation", "킹즈 나이트 바리에이션"],
  ["King's Indian Attack", "킹즈 인디언 어택"],
  ["Kings Indian Attack", "킹즈 인디언 어택"],
  ["King's Indian Defense", "킹즈 인디언 디펜스"],
  ["Kings Indian Defense", "킹즈 인디언 디펜스"],
  ["Queen's Indian Defense", "퀸즈 인디언 디펜스"],
  ["Queens Indian Defense", "퀸즈 인디언 디펜스"],
  ["Nimzo-Indian Defense", "님조 인디언 디펜스"],
  ["Queen's Gambit Declined", "퀸즈 갬빗 거절"],
  ["Queens Gambit Declined", "퀸즈 갬빗 거절"],
  ["Queen's Gambit Accepted", "퀸즈 갬빗 수락"],
  ["Queens Gambit Accepted", "퀸즈 갬빗 수락"],
  ["King's Gambit Accepted", "킹즈 갬빗 수락"],
  ["Kings Gambit Accepted", "킹즈 갬빗 수락"],
  ["King's Gambit Declined", "킹즈 갬빗 거절"],
  ["Kings Gambit Declined", "킹즈 갬빗 거절"],
  ["Semi-Slav Defense", "세미슬라브 디펜스"],
  ["Scandinavian Defense", "스칸디나비안 디펜스"],
  ["Sicilian Defense", "시실리안 디펜스"],
  ["French Defense", "프렌치 디펜스"],
  ["Caro-Kann Defense", "카로칸 디펜스"],
  ["Alekhine's Defense", "알레힌 디펜스"],
  ["Alekhine Defense", "알레힌 디펜스"],
  ["Alekhines Defense", "알레힌 디펜스"],
  ["Pirc Defense", "피르크 디펜스"],
  ["Philidor Defense", "필리도르 디펜스"],
  ["Petrov's Defense", "페트로프 디펜스"],
  ["Petrovs Defense", "페트로프 디펜스"],
  ["Modern Defense", "모던 디펜스"],
  ["Grunfeld Defense", "그룬펠트 디펜스"],
  ["Grünfeld Defense", "그룬펠트 디펜스"],
  ["Benoni Defense", "베노니 디펜스"],
  ["Benko Gambit", "벤코 갬빗"],
  ["Catalan Opening", "카탈란 오프닝"],
  ["English Opening", "잉글리시 오프닝"],
  ["Ruy Lopez", "루이 로페즈"],
  ["Italian Game", "이탈리안 게임"],
  ["Scotch Game", "스카치 게임"],
  ["Vienna Game", "비엔나 게임"],
  ["London System", "런던 시스템"],
  ["Slav Defense", "슬라브 디펜스"],
  ["Dutch Defense", "더치 디펜스"],
  ["Bird Opening", "버드 오프닝"],
  ["Bird's Opening", "버드 오프닝"],
  ["Queen's Gambit", "퀸즈 갬빗"],
  ["Queens Gambit", "퀸즈 갬빗"],
  ["King's Gambit", "킹즈 갬빗"],
  ["Kings Gambit", "킹즈 갬빗"],
  ["Reti Opening", "레티 오프닝"],
  ["Réti Opening", "레티 오프닝"],
  ["Trompowsky Attack", "트롬포프스키 어택"],
  ["Jobava London System", "요바바 런던 시스템"],
  ["Smith-Morra Gambit", "스미스-모라 갬빗"],
  ["Evans Gambit", "에반스 갬빗"],
  ["Bishop's Opening", "비숍 오프닝"],
  ["Four Knights Game", "포 나이츠 게임"],
  ["Three Knights Opening", "쓰리 나이츠 오프닝"],
  ["English Defense", "잉글리시 디펜스"],
  ["Indian Defense", "인디언 디펜스"],
  ["Jaenisch", "예니시"],
  ["Schallopp", "샬로프"],
  ["Mieses", "미제스"],
  ["Kotrc", "코트르치"],
  ["Falkbeer", "팔크비어"],
  ["Marshall", "마셜"],
  ["Berlin", "베를린"],
  ["Ponziani", "폰지아니"],
  ["Max Lange", "막스 랑게"],
  ["Petrov", "페트로프"],
  ["Alekhine", "알레힌"],
  ["Vienna", "비엔나"],
  ["Scotch", "스카치"],
  ["Italian", "이탈리안"],
  ["French", "프렌치"],
  ["Scandinavian", "스칸디나비안"],
  ["Sicilian", "시실리안"],
  ["English", "잉글리시"],
  ["Indian", "인디언"],
  ["Accepted", "수락"],
  ["Declined", "거절"],
  ["Countergambit", "카운터갬빗"],
  ["Counterattack", "카운터어택"],
  ["Defense", "디펜스"],
  ["Opening", "오프닝"],
  ["Game", "게임"],
  ["Gambit", "갬빗"],
  ["Attack", "어택"],
  ["Variation", "바리에이션"],
  ["System", "시스템"],
  ["Classical", "클래식"],
  ["Modern", "모던"],
  ["Accelerated", "가속형"],
  ["Exchange", "익스체인지"],
  ["Formation", "포메이션"],
  ["Main Line", "메인 라인"],
  ["Line", "라인"],
  ["Queenside", "퀸사이드"],
  ["Kingside", "킹사이드"],
  ["Queen", "퀸"],
  ["King", "킹"],
  ["Queen's", "퀸즈"],
  ["King's", "킹즈"],
  ["Queens", "퀸즈"],
  ["Kings", "킹즈"],
  ["Bishop's", "비숍"],
  ["Bishops", "비숍"],
  ["Knight", "나이트"],
  ["Pawn", "폰"],
];

function stripMoveNotation(raw: string): string {
  return raw
    .replace(/\b\d+\.(?:\.\.)?[A-Za-z0-9+#=]+\b/g, " ")
    .replace(/\b(?:O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h]x?[a-h][1-8](?:=[QRBN])?[+#]?|[KQRBN][a-h][1-8]|[a-h][1-8])\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupOpeningLabel(raw: string): string {
  return raw
    .replace(/\s+:\s+/g, ": ")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .replace(/\s+:/g, ":")
    .trim();
}

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

export function formatOpeningName(raw: string | undefined): string {
  if (!raw) {
    return "미분류";
  }

  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") {
    return "미분류";
  }

  let next = stripMoveNotation(trimmed);
  for (const [source, target] of OPENING_TRANSLATIONS) {
    next = next.replaceAll(source, target);
  }

  return cleanupOpeningLabel(next) || "미분류";
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
