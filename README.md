# chessgg

체스 전적 검색 + M2(구글 로그인/구독결제/권한제어)까지 구현된 버전입니다.

## 구현 상태

### M1 (완료)
- 유저/닉네임 전적 검색 (Chess.com, Lichess)
- 기간 필터 (`7d`, `30d`, `all`)
- 타임컨트롤 필터
  - 대분류: `불릿/블리츠/래피드`
  - 세부: `1분`, `1|1`, `3|2`, `15|10` 등
- 게임 리스트 + 게임 상세
  - 흑/백 표시
  - 내 색 기준 보드 방향 자동 전환
  - PGN, 착수 목록, 하이라이트
- 기본 통계 대시보드
  - 승/무/패, 연승/연패, 레이팅 추이, 시간대별 성적, 오프닝별 성적

### M2 (완료)
- 구글 로그인/로그아웃/토큰 갱신
  - 별도 페이지 이동 없이 현재 화면 중앙 모달 팝업 로그인
- 구독 결제 백엔드(Stripe Checkout + Webhook)
- 구독 상태 조회 페이지
- 서버 권한 강제
  - PRO 전용 분석 요청 API
- 분석 요청 일일 쿼터 제한

### 배포 전 안정화 항목 (이번 작업 반영)
- PostgreSQL 영속 저장(Prisma)
- 웹훅 서명 검증 + 멱등 처리(중복 이벤트 방지)
- API/Auth rate limit 미들웨어
- 외부 API timeout/retry
- Sentry 연동 포인트 추가(옵션)
- smoke 테스트 스크립트 추가
- 환경 분리용 `.env` 템플릿(dev/staging/prod)

## 폴더 구조
- `apps/web`: React(Vite) 프론트엔드
- `apps/api`: Express + Prisma + Stripe 백엔드
- `packages/shared`: 프론트/백 공통 타입/타임컨트롤 유틸

## 사전 준비
1. PostgreSQL 준비
2. 환경변수 파일 생성

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

3. `apps/api/.env`에서 최소 필수값 설정
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `GOOGLE_CLIENT_ID`
- `apps/web/.env`의 `VITE_GOOGLE_CLIENT_ID`

## 로컬 실행
1. 설치
```bash
npm install
```

2. Prisma 클라이언트 생성 + 스키마 반영
```bash
npm run prisma:generate -w @chessgg/api
npm run prisma:push -w @chessgg/api
```

3. 개발 서버 실행
```bash
npm run dev
```

4. 접속
- Web: `http://localhost:5173`
- API: `http://localhost:4000`

## 결제(Stripe) 활성화
`apps/api/.env`에 아래를 채우면 결제 버튼이 실제 Checkout으로 연결됩니다.
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_BILLING_SUCCESS_URL`
- `STRIPE_BILLING_CANCEL_URL`

Webhook 엔드포인트:
- `POST /v1/billing/webhook`

## 주요 API

### 인증
- `POST /v1/auth/google`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `GET /v1/auth/me`

### 구독/결제
- `GET /v1/billing/subscription`
- `POST /v1/billing/checkout-session`
- `POST /v1/billing/webhook`

### 전적 검색
- `GET /v1/search?platform=chesscom&query={nickname}`
- `GET /v1/profiles/:platform/:username/summary?range=30d&tc=rapid&tcd=900+10`
- `GET /v1/profiles/:platform/:username/games?...`
- `GET /v1/profiles/:platform/:username/games/:gameId`
- `GET /v1/profiles/:platform/:username/stats/basic?...`
- `GET /v1/profiles/:platform/:username/stats/openings?...`

### 분석
- `POST /v1/analysis/games/:platform/:username/:gameId/run` (PRO)
- `GET /v1/analysis/jobs/:jobId`

## 검증 명령
```bash
npm run typecheck
npm run lint
npm run build
```

API 스모크 테스트(서버 실행 중):
```bash
npm run test:smoke -w @chessgg/api
```

## 다음 단계 (M3)
- Stockfish 워커/BullMQ 연결
- 분석 결과(블런더/미스/부정확) 저장/조회
- 분석 리포트 UI 고도화
