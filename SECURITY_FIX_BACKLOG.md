# Security Fix Backlog

작성일: 2026-03-04  
목적: 나중에 "보안 항목 수정" 요청 시 바로 실행하기 위한 체크리스트

## P1 (우선)
- [ ] `/v1/auth/google` 운영 비활성화 또는 제거
  - 이유: Supabase Auth 우회 경로 제거, 인증 경로 단일화
  - 대상 파일: `apps/api/src/app.ts`
  - 작업 방향:
    - 운영(`NODE_ENV=production`)에서 410/404 처리 또는 라우트 제거
    - 프론트는 `/v1/auth/supabase`만 사용 유지

## P2 (중요)
- [ ] CORS 허용 도메인 화이트리스트 적용
  - 이유: 현재 전체 오리진 허용 상태(`app.use(cors())`)
  - 대상 파일: `apps/api/src/app.ts`, `apps/api/src/config/env.ts`, `.env.example`
  - 작업 방향:
    - `CORS_ALLOWED_ORIGINS` 환경변수(쉼표 구분) 추가
    - 운영에서는 지정된 origin만 허용
    - 로컬 개발 origin(`http://localhost:5173`)만 별도 허용

- [ ] 인증 토큰 저장 위치 개선(localStorage -> HttpOnly Cookie)
  - 이유: XSS 시 토큰 탈취 위험 감소
  - 대상 파일:
    - `apps/web/src/lib/auth-session.ts`
    - `apps/web/src/context/AuthContext.tsx`
    - `apps/api/src/app.ts` (set-cookie/clear-cookie/refresh 처리)
  - 작업 방향:
    - access/refresh token을 HttpOnly+Secure+SameSite 쿠키로 저장
    - 클라이언트 JS는 토큰 원문 접근하지 않도록 변경
    - API 호출은 쿠키 기반 세션 사용 또는 짧은-lived access token 전략 적용

## 운영 보안 작업
- [ ] `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` 회전(rotate)
  - 위치: Railway Variables
  - 주의: 회전 시 기존 세션 만료됨

- [ ] 노출 가능 정보 점검
  - 대상: 스크린샷/문서/이슈 코멘트
  - 금지: DB URL(비밀번호 포함), JWT secret, Stripe secret, service_role key

## 실행 순서(권장)
1. `/v1/auth/google` 비활성화
2. CORS 화이트리스트 적용
3. 토큰 저장 구조(HttpOnly 쿠키) 전환
4. 시크릿 rotate + 재로그인 검증
