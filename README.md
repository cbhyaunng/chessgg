# chessgg

체스 전적 검색 사이트 MVP 구현본입니다.

## 현재 구현 범위 (M1)
- 유저/닉네임 전적 검색
  - 플랫폼: `Chess.com`, `Lichess`
- 플랫폼별 프로필/전적 요약
- 필터
  - 기간: `7d`, `30d`, `all`
  - 시간 컨트롤: `bullet`, `blitz`, `rapid`, `all`
- 게임 리스트 + 한 판 상세
  - PGN
  - 착수 목록
  - 중요 국면 하이라이트(룰 기반)
  - 결과/오프닝/상대 레이팅/시간 사용량
- 기본 통계 대시보드
  - 승/무/패
  - 레이팅 추이
  - 연승/연패
  - 시간대별 성적
  - 오프닝별 성적(백/흑, 승률, 평균 퍼포먼스)

## 폴더 구조
- `apps/web`: React(Vite) 프론트엔드
- `apps/api`: Express + TypeScript 백엔드 API
- `packages/shared`: 프론트/백 공유 타입

## 로컬 실행
1. 의존성 설치
```bash
npm install
```

2. 환경변수 파일 준비
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

3. 개발 서버 실행 (API + Web)
```bash
npm run dev
```

4. 접속
- Web: `http://localhost:5173`
- API: `http://localhost:4000`

## 주요 API
- `GET /health`
- `GET /v1/search?platform=chesscom&query={nickname}`
- `GET /v1/profiles/:platform/:username/summary?range=30d&tc=all`
- `GET /v1/profiles/:platform/:username/games?range=30d&tc=all&page=1&pageSize=20`
- `GET /v1/profiles/:platform/:username/games/:gameId`
- `GET /v1/profiles/:platform/:username/stats/basic?range=30d&tc=all`
- `GET /v1/profiles/:platform/:username/stats/openings?range=30d&tc=all`

## 검증 명령
```bash
npm run typecheck
npm run lint
npm run build
```

## 순차 구현 로드맵
1. `M1` 완료: 검색/요약/필터/게임상세/기본통계
2. `M2` 예정: 로그인 + 구독 결제(Stripe) + 기능 제한
3. `M3` 예정: 엔진 기반 실수 분류(블런더/미스/부정확) + 국면별/시간관리 분석
4. `M4` 예정: 오프닝 추천 + 맞춤 퍼즐 생성
