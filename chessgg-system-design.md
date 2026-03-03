# chessgg 프론트엔드/백엔드 설계안

## 1. 목표와 범위
- 목표: 체스 전적 검색 + 플랫폼 통합 요약 + 대시보드 + 게임 상세 분석을 제공하는 웹 서비스 구축
- 1차(핵심): 검색/요약/필터/게임상세/기본 대시보드
- 2차(유료 전환): 실수 분류, 국면별 분해, 시간 관리 분석, 오프닝 추천, 맞춤 퍼즐
- 원칙: 서버 비용이 큰 기능은 제한적으로 시작
  - 최근 N판만 분석
  - 요청한 게임만 분석
  - 사용자별 일일 분석 횟수 제한

## 2. 권장 아키텍처
- 모노레포 구조
  - `apps/web`: Next.js(React, TypeScript) 프론트엔드
  - `apps/api`: NestJS(TypeScript) REST API
  - `apps/worker`: 비동기 수집/분석 워커(BullMQ)
  - `packages/shared`: 공통 타입/유틸
- 인프라
  - PostgreSQL: 사용자, 게임, 통계, 구독 데이터
  - Redis: 큐(BullMQ), 캐시, 레이트 리밋
  - Object Storage(선택): 대용량 원본 PGN 보관 시 사용
  - Stockfish 엔진: 오프라인 분석 워커에서만 실행

## 3. 프론트엔드 설계

### 3-1. 화면 구조
- `/` : 닉네임/플랫폼 검색, 최근 조회 목록
- `/player/[platform]/[username]` : 프로필/전적 요약 + 필터 + 게임 리스트 + 기본 통계
- `/game/[gameId]` : 체스보드 + PGN + 하이라이트 + 시간 사용량/오프닝/결과 상세
- `/dashboard` : 기간별 통계(승무패, 레이팅 추이, 연승/연패, 시간대별 성적)
- `/pricing` : 구독 플랜 소개
- `/account/billing` : 결제 상태, 결제수단, 구독 관리
- `/auth/*` : 로그인/회원가입

### 3-2. 핵심 컴포넌트
- `SearchBar`: 플랫폼 + 닉네임 검색
- `ProfileSummaryCard`: 플랫폼별 프로필/레이팅 요약
- `FilterBar`: 기간(7/30/전체), 시간 컨트롤(불릿/블리츠/래피드)
- `GameTable`: 결과/오프닝/상대 레이팅/시간 사용량 컬럼
- `GameViewer`: 보드 + move list + PGN 복사/다운로드
- `KeyMomentsPanel`: 중요 국면 하이라이트(평가 급변, 블런더 시점)
- `StatsDashboard`: W/D/L, 레이팅 추이, streak, 시간대별 성적
- `OpeningPerformanceTable`: 백/흑 분리 승률, 판수, 평균 퍼포먼스

### 3-3. 상태/데이터 처리
- 서버 상태: TanStack Query(React Query)
- UI 상태: Zustand(필터, 보드 방향, 선택한 하이라이트 등)
- 차트: Recharts 또는 Apache ECharts
- 체스 UI: `react-chessboard` + `chess.js`
- 접근 제어: 미들웨어 + 서버 사이드 세션 체크

### 3-4. 모바일 UX 원칙
- 검색 결과는 카드형 요약 우선
- 게임 상세는 탭 분리
  - `보드`
  - `착수`
  - `하이라이트`
  - `통계`
- 한글 코멘트는 짧고 직관적인 문장으로 제한

## 4. 백엔드 설계

### 4-1. API 도메인
- `Auth`: 회원가입/로그인/JWT 갱신
- `Users`: 내 정보, 설정
- `Billing`: Stripe Checkout, Webhook, 구독 상태 조회
- `Profiles`: 플랫폼 계정 조회/요약
- `Games`: 게임 목록, 게임 상세, PGN
- `Stats`: 대시보드/오프닝/시간대별 지표
- `Analysis`: 분석 요청, 분석 결과 조회(유료)
- `Sync`: 플랫폼 수집 작업 상태

### 4-2. 주요 REST 엔드포인트 예시
- `GET /v1/search?platform=chesscom&query={nickname}`
- `GET /v1/profiles/{platform}/{username}/summary?range=7d&tc=blitz`
- `GET /v1/profiles/{platform}/{username}/games?range=30d&tc=rapid&page=1`
- `GET /v1/games/{gameId}`
- `GET /v1/games/{gameId}/pgn`
- `GET /v1/profiles/{platform}/{username}/stats/basic?range=30d&tc=all`
- `GET /v1/profiles/{platform}/{username}/stats/openings?range=all`
- `POST /v1/analysis/games/{gameId}/run` (유료, 제한 적용)
- `GET /v1/analysis/games/{gameId}`
- `POST /v1/billing/checkout-session`
- `POST /v1/billing/webhook`

### 4-3. DB 스키마(초안)
- `users`
  - id, email, password_hash, created_at
- `subscriptions`
  - id, user_id, plan, status, stripe_customer_id, stripe_subscription_id, period_end
- `platform_profiles`
  - id, platform(chesscom/lichess), username, external_id, avatar_url, country, title, rating_bullet, rating_blitz, rating_rapid, last_synced_at
- `games`
  - id, platform, platform_game_id(unique), white_profile_id, black_profile_id, started_at, ended_at, time_control, result, opening_eco, opening_name, pgn, raw_json
- `game_moves`
  - id, game_id, ply, san, uci, fen, clock_ms, spent_ms
- `game_key_moments`
  - id, game_id, ply, type(blunder/miss/inaccuracy/swing), score_before, score_after, comment_ko
- `player_daily_stats`
  - id, profile_id, date, tc, wins, draws, losses, rating, streak_win, streak_loss
- `opening_stats`
  - id, profile_id, opening_eco, opening_name, as_color, games, wins, draws, losses, win_rate, avg_performance
- `analysis_jobs`
  - id, game_id, user_id, status, priority, requested_at, finished_at, error

## 5. 데이터 수집/동기화 파이프라인
- 트리거
  - 유저가 검색하면 profile 캐시 확인
  - 데이터가 오래됐으면 `sync job` 큐에 적재 후 백그라운드 갱신
- 소스
  - Chess.com public API
  - Lichess API
- 처리 순서
  - 계정 조회 -> 게임 메타 수집 -> PGN 저장 -> 착수/시계 데이터 파싱 -> 통계 집계
- 중복 방지
  - `(platform, platform_game_id)` 유니크 키로 upsert
- 캐싱
  - 인기 프로필/요약은 Redis TTL 캐시

## 6. 하이라이트/분석 로직
- 1차(MVP): 라이트 규칙 기반
  - PGN 태그, 결과, 시간 정보 기반으로 하이라이트 생성
  - 평가지표 없으면 “전환점 후보”만 표시
- 2차(유료): 엔진 기반
  - Stockfish 평가 급변량으로 blunder/miss/inaccuracy 분류
  - `왜 나쁜지` 코멘트는 짧은 템플릿 + 상황 라벨 조합으로 생성
  - 반복 실수 유형 태깅(퀸 손실, 백랭크, 핀 무시 등)

## 7. 권한/구독 정책
- 비로그인: 검색/요약 일부만 허용, 상세 제한
- 무료 회원
  - 기본 대시보드 제공
  - 분석 요청 일일 소량 제한
- 유료 회원
  - 전체 분석 기능 + 더 긴 기간 + 더 많은 분석 횟수
- 서버에서 기능 플래그를 구독 상태로 강제

## 8. 성능/운영 가이드
- 읽기 트래픽 많은 API는 캐시 우선
- 무거운 분석은 반드시 비동기 큐
- 장애 대비
  - API timeout/retry/backoff
  - 외부 플랫폼 장애 시 stale 데이터 제공
- 모니터링
  - API latency, queue depth, analysis success rate, webhook 실패율

## 9. 구현 단계 제안
1. `M1 (핵심)`
   - 검색/프로필 요약/필터/게임리스트/게임상세/기본 통계
2. `M2 (계정/결제)`
   - 로그인, 구독 결제, 기능 제한 정책
3. `M3 (유료 분석)`
   - 엔진 분석 큐, 실수 라벨링, 국면별/시간관리 분석
4. `M4 (추천/훈련)`
   - 오프닝 추천, 맞춤 퍼즐 생성

## 10. 시작 시점 기술 스택 요약
- Frontend: Next.js + TypeScript + React Query + Zustand + Tailwind
- Backend: NestJS + PostgreSQL + Redis + BullMQ
- Payment: Stripe
- Analysis: Stockfish worker(비동기)
- Deploy: Web(Vercel) + API/Worker(Railway/Fly.io) + Managed Postgres/Redis
