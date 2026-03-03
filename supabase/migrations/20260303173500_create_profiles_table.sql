-- Supabase 공식 문서 "Managing user data" 패턴을 기반으로 작성:
-- https://supabase.com/docs/guides/auth/managing-user-data
-- 목적:
-- 1) auth.users와 1:1로 연결되는 public.profiles 생성
-- 2) 가입 시 자동 프로필 생성
-- 3) RLS로 본인 데이터만 접근 허용
-- 4) role(admin/user/null) 구조 지원

-- 1) 권한 enum 타입 생성
-- role 컬럼은 nullable이므로 실제 허용값은 admin/user/null 입니다.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'profile_role'
      and n.nspname = 'public'
  ) then
    create type public.profile_role as enum ('admin', 'user');
  end if;
end
$$;

-- 2) 프로필 테이블 생성 (auth.users와 1:1 관계)
-- id는 auth.users.id를 그대로 사용하여 사용자별 단일 프로필을 보장합니다.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  role public.profile_role null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
'서비스 사용자 공개 프로필/권한 정보를 저장하는 테이블. auth.users와 1:1로 연결됩니다.';
comment on column public.profiles.id is
'auth.users.id와 동일한 사용자 고유 ID (PK, FK). 사용자가 삭제되면 프로필도 함께 삭제됩니다.';
comment on column public.profiles.username is
'서비스 내 표시 닉네임. unique 제약으로 중복 닉네임을 방지합니다.';
comment on column public.profiles.avatar_url is
'프로필 이미지 URL. 소셜 로그인 메타데이터에서 초기값을 가져올 수 있습니다.';
comment on column public.profiles.role is
'권한 컬럼. admin/user/null 중 하나를 가집니다. null은 권한 미지정 상태를 의미합니다.';
comment on column public.profiles.created_at is
'프로필 레코드 생성 시각(UTC timestamptz).';
comment on column public.profiles.updated_at is
'프로필 레코드 수정 시각(UTC timestamptz). UPDATE 트리거로 자동 갱신됩니다.';

alter table public.profiles enable row level security;

-- 3) updated_at 자동 갱신 함수/트리거
-- 프로필이 수정될 때마다 updated_at을 현재 시각으로 덮어씁니다.
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_profiles_updated on public.profiles;
create trigger on_profiles_updated
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

-- 3-1) 일반 로그인 사용자의 권한 상승 방지
-- - authenticated 세션에서는 admin 지정 금지
-- - authenticated 세션에서는 role 변경 자체 금지
-- (관리자 권한 부여는 신뢰 가능한 서버/운영 도구에서만 수행)
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
    -- 직접 admin으로 올리는 시도 차단
    if new.role = 'admin' then
      raise exception 'admin 권한은 신뢰된 백엔드에서만 부여할 수 있습니다';
    end if;

    -- 일반 사용자의 role 변경 시도 차단
    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception '일반 사용자는 role 값을 변경할 수 없습니다';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_profiles_role_guard on public.profiles;
create trigger on_profiles_role_guard
before insert or update on public.profiles
for each row
execute function public.guard_profile_role();

-- 4) 신규 가입(auth.users INSERT) 시 프로필 자동 생성
-- OAuth 메타데이터에서 표시 이름/아바타를 우선 반영합니다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'preferred_username', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- 5) RLS 정책
-- - 조회(SELECT): 본인 프로필만 허용
-- - 삽입(INSERT): auth.uid()와 id가 동일한 본인 레코드만 허용
-- - 수정(UPDATE): 본인 프로필만 허용
-- 주의: role 보호는 위 guard 트리거에서 추가로 강제됩니다.
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- 참고:
-- role은 nullable이므로 admin/user/null을 모두 표현할 수 있습니다.
-- 보안상 admin 부여는 서버(서비스 롤) 또는 운영자 전용 경로로만 처리하세요.
