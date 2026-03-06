# 체스 전적 영구 캐시/증분 동기화 구현 문서

## 목적

기존 구현은 외부 플랫폼 API를 호출한 뒤 메모리 TTL 캐시에만 저장했다. 그래서 서버가 재시작되거나 TTL이 지나면 같은 유저를 다시 검색할 때 외부 API를 다시 읽어야 했다.

이번 변경의 목표는 다음과 같다.

1. 첫 검색만 오래 걸려도 괜찮다.
2. 이후 검색은 DB에서 바로 읽어서 빠르게 응답한다.
3. 데이터가 오래되었으면 사용자 응답은 즉시 주고, 백그라운드에서 새 게임만 동기화한다.
4. 첫 검색에서 전체 1만 판 때문에 500이 나지 않도록 초기 응답은 가볍게 유지한다.

## 구현 파일

핵심 변경 파일:

- `/Users/changminbyun/chessgg/apps/api/prisma/schema.prisma`
- `/Users/changminbyun/chessgg/apps/api/src/services/platform-service.ts`
- `/Users/changminbyun/chessgg/apps/api/src/providers/chesscom.ts`
- `/Users/changminbyun/chessgg/apps/api/src/providers/lichess.ts`
- `/Users/changminbyun/chessgg/apps/api/src/config/env.ts`
- `/Users/changminbyun/chessgg/apps/api/prisma/20260306_platform_cache.sql`
- `/Users/changminbyun/chessgg/apps/api/.env.example`
- `/Users/changminbyun/chessgg/apps/api/.env.production.example`
- `/Users/changminbyun/chessgg/apps/api/.env.staging.example`

## 데이터 모델

### `PlatformProfileCache`

플랫폼 + 닉네임 단위의 캐시 메타데이터를 저장한다.

주요 필드:

- `platform`, `usernameLower`: 캐시 키
- `usernameDisplay`: 화면에 보여줄 원본 닉네임
- `profileJson`: 플랫폼 프로필 JSON
- `gamesCount`: 저장된 게임 수
- `latestPlayedAt`: 가장 최근 게임 시각
- `lastFullSyncAt`: 최초 전체 동기화 시각
- `lastIncrementalSyncAt`: 마지막 증분 동기화 시각
- `staleAt`: 이 시각이 지나면 오래된 데이터로 간주
- `syncStatus`: `IDLE`, `SYNCING`, `FAILED`
- `syncError`: 마지막 동기화 오류 메시지
- `isTruncated`: `PLATFORM_SYNC_MAX_GAMES`까지만 저장되어 잘린 경우

### `PlatformGameCache`

실제 게임 목록을 저장한다.

주요 필드:

- `platformGameId`
- `playedAt`
- `timeControl`, `timeControlCategory`
- `rated`
- `color`, `result`
- `opponentUsername`, `opponentRating`
- `playerRating`
- `opening`, `eco`
- `pgn`
- `totalMoves`
- `timeSpentSec`

유니크 키:

- `(profileCacheId, platformGameId)`

이 키를 사용해서 증분 동기화 시 같은 게임이 다시 들어와도 중복 저장되지 않도록 했다.

## 동작 흐름

### 1. 첫 검색

`getDataset()` 호출 시 DB에 캐시가 없으면 먼저 bootstrap 동기화를 수행한다.

동작:

1. 외부 플랫폼에서 프로필 조회
2. 최근 일부 게임만 우선 조회
3. DB에 프로필/게임 저장
4. 응답은 이 bootstrap 데이터로 먼저 반환
5. 응답 뒤에서 전체 동기화를 백그라운드로 이어서 수행

이 구조로 검색 시 서버 에러 가능성을 줄이고, 큰 계정도 우선 페이지에 진입할 수 있게 했다.

### 2. 재검색

이미 DB에 캐시가 있으면 외부 API를 기다리지 않고 바로 DB 값을 반환한다.

이후:

- 요약
- 게임 리스트
- 기본 통계
- 오프닝 통계

모두 같은 저장 데이터에서 계산된다.

### 3. 오래된 캐시

캐시가 `staleAt`을 넘겼으면 사용자에게는 즉시 저장된 데이터를 반환하고, 백그라운드에서 증분 동기화를 실행한다.

증분 동기화 방식:

- Lichess: `since` 파라미터로 마지막 게임 이후 데이터만 요청
- Chess.com: 최신 월 아카이브부터 읽으면서 마지막 저장 시점 이후 게임만 반영

## 캐시 계층

현재는 2단 캐시 구조다.

1. 메모리 캐시
2. PostgreSQL 영구 캐시

메모리 캐시는 같은 서버 인스턴스 안에서 같은 유저 페이지의 여러 API 호출을 빠르게 처리하기 위한 용도다.

영구 캐시는 서버 재시작 이후에도 남는다.

## 현재 API 동작

기존 엔드포인트 경로는 유지했다.

- `/v1/search`
- `/v1/profiles/:platform/:username/summary`
- `/v1/profiles/:platform/:username/games`
- `/v1/profiles/:platform/:username/games/:gameId`
- `/v1/profiles/:platform/:username/stats/basic`
- `/v1/profiles/:platform/:username/stats/openings`

프론트엔드 변경 없이 동작하도록 서비스 내부 구현만 교체했다.

## 환경변수

새로 중요해진 값:

- `DATASET_STALE_MS`
  - DB 캐시를 오래된 것으로 판단하는 기준
- `DATASET_SYNC_TIMEOUT_MS`
  - `SYNCING` 상태가 너무 오래 지속될 때 재시도 가능한 상태로 보기 위한 기준
- `PLATFORM_BOOTSTRAP_MAX_GAMES`
  - 첫 검색에서 빠르게 가져올 최근 게임 수
- `PLATFORM_SYNC_MAX_GAMES`
  - 한 유저당 저장할 최대 게임 수

기본값:

- `DATASET_STALE_MS=600000`
- `DATASET_SYNC_TIMEOUT_MS=900000`
- `PLATFORM_BOOTSTRAP_MAX_GAMES=100`
- `PLATFORM_SYNC_MAX_GAMES=10000`

플랫폼별 기본값:

- `CHESSCOM_MAX_ARCHIVES=120`
- `LICHESS_MAX_GAMES=10000`

## 적용 방법

로컬 또는 서버에서 아래 순서로 반영한다.

1. Prisma client 생성

```bash
npm run prisma:generate -w @chessgg/api
```

2. Supabase DB 스키마 반영

Supabase는 `public.profiles -> auth.users` 외래키를 갖고 있어서 `prisma db push`를 그대로 쓰면 Supabase 내부 `auth` 테이블을 Prisma가 관리 대상으로 오해할 수 있다.

그래서 실제 반영은 아래 SQL 파일을 raw execute 하는 방식으로 적용한다.

```bash
DATABASE_URL=... npx prisma db execute \
  --url "$DATABASE_URL" \
  --file apps/api/prisma/20260306_platform_cache.sql
```

3. 전체 빌드 확인

```bash
npm run build
```

## 이번 구현의 한계

1. 백그라운드 증분 동기화는 별도 워커/큐 없이 API 프로세스 안에서 돈다.
2. 서버가 재시작되면 진행 중이던 백그라운드 작업은 중단된다.
3. `PLATFORM_SYNC_MAX_GAMES`를 넘는 유저는 최신 게임 위주로만 저장된다.
4. Chess.com은 구조상 Lichess처럼 깔끔한 `since` 스트리밍이 아니라 월별 아카이브를 역순으로 읽는다.
5. Supabase 프로젝트에서는 Prisma가 `auth` 스키마를 직접 관리하지 않도록 datasource를 `public`만 보게 설정했다.

## 다음 단계 추천

1. `platform cache status` API 추가
2. 첫 검색 시 "동기화 중" 상태를 프론트에서 표시
3. RabbitMQ/Redis 기반 워커 분리
4. 오프닝 통계/기본 통계 사전 집계 테이블 추가
5. `isTruncated`를 UI에 노출해서 1만 판 제한 여부 안내
