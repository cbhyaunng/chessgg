# chessgg Deployment Status (2026-03-04)

## 1) 현재 배포 상태
- 프론트엔드: Vercel 배포 완료
- 백엔드 API: Railway 배포 진행/운영
- 인증/DB: Supabase 배포 및 연결 완료

## 2) 운영 아키텍처
- Vercel: `apps/web` (React + Vite)
- Railway: `apps/api` (Express + Prisma)
- Supabase:
  - Auth: Google OAuth
  - Database: PostgreSQL (`public`, `auth` 스키마 사용)

## 3) Railway API 서비스 기준 설정값
### Build / Start
- Root Directory: `/` (repo root)
- Build Command:
```bash
npm run build -w @chessgg/shared && npm run build -w @chessgg/api
```
- Start Command:
```bash
npm run start -w @chessgg/api
```

### Variables (API 서비스에만 입력)
- `DATABASE_URL` = Supabase Session Pooler URL
  - 예시 형태:
  - `postgresql://postgres.<project-ref>:<password>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require&pgbouncer=true`
- `JWT_ACCESS_SECRET` = 랜덤 긴 문자열
- `JWT_REFRESH_SECRET` = 랜덤 긴 문자열
- `SUPABASE_URL` = `https://hixjygfmxotoqlrgxoao.supabase.co`
- `SUPABASE_ANON_KEY` = Supabase anon public key
- `GOOGLE_CLIENT_ID` = Google OAuth Web Client ID
- `NODE_ENV` = `production`

주의:
- `VITE_`로 시작하는 변수는 Railway API가 아니라 Vercel Web 프로젝트에 넣어야 함.

## 4) Vercel Web 프로젝트 기준 변수
- `VITE_API_BASE_URL` = Railway API 도메인
- `VITE_GOOGLE_CLIENT_ID` = Google OAuth Web Client ID
- `VITE_SUPABASE_URL` = `https://hixjygfmxotoqlrgxoao.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = Supabase anon public key

## 5) Supabase 설정 메모
- Google Provider 활성화
- Callback URL:
  - `https://hixjygfmxotoqlrgxoao.supabase.co/auth/v1/callback`
- `public.profiles` 테이블 사용
  - `role`: `admin | user | null`
- 첫 admin은 SQL Editor에서 지정

## 6) 운영 점검 체크
1. Railway API 도메인 확인 후 `/health` 확인
2. Vercel `VITE_API_BASE_URL`이 Railway 도메인을 가리키는지 확인
3. Google 로그인 성공 여부 확인
4. 전적 검색/게임 상세 API 호출 정상 여부 확인

## 7) 다음으로 할 작업 (우선순위)
1. Railway API 도메인 고정 후 Vercel 연결 최종 확인
2. 첫 admin 계정 지정 및 `/v1/admin/users/:userId/role` 테스트
3. 프로덕션 smoke 테스트 스크립트 실행
4. 장애 대응용 로그/알림(Sentry) 활성화
5. 배포 파이프라인 정리 (web/api 분리 배포 규칙 문서화)

## 8) 보안 주의사항
- 실제 비밀번호/토큰/JWT secret은 문서나 Git에 커밋 금지
- `service_role` 키는 프론트에 절대 사용 금지
