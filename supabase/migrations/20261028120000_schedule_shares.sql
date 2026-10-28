-- Schedule share links: a private, read-only link to the coming two weeks that a parent or friend
-- opens in a browser. The phone writes only the projection a reader may see (dates, times, kind,
-- category, and titles or "Busy"), never plan records; the site reads one link at a time through
-- `shared_schedule`. A link is never deleted by its owner, only stopped: stopping clears what it
-- showed and the address stops working for good. Free for everyone (pricing-and-positioning.md).

create table public.schedule_shares (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 122 random bits; the link's only secret.
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  title text not null check (char_length(title) between 1 and 80),
  options jsonb not null check (jsonb_typeof(options) = 'object'),
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint schedule_shares_entries check (jsonb_typeof(entries) = 'array' and jsonb_array_length(entries) <= 600),
  constraint schedule_shares_size check (pg_column_size(entries) <= 128 * 1024)
);

create index schedule_shares_owner on public.schedule_shares (owner) where revoked_at is null;

-- At most this many live links per person; a stopped link doesn't count.
create or replace function public.guard_schedule_share()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.schedule_shares where owner = new.owner and revoked_at is null) >= 20 then
      raise exception 'Too many share links' using errcode = 'P0001';
    end if;
    new.revoked_at := null;
  else
    -- The address, its owner and its age never change, and a stopped link stays stopped.
    if old.revoked_at is not null then
      raise exception 'This share link was stopped' using errcode = 'P0001';
    end if;
    new.id := old.id;
    new.owner := old.owner;
    new.token := old.token;
    new.created_at := old.created_at;
    if new.revoked_at is not null then
      new.entries := '[]'::jsonb;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger schedule_shares_guard
  before insert or update on public.schedule_shares
  for each row execute function public.guard_schedule_share();

alter table public.schedule_shares enable row level security;

-- Signed-in accounts only: a guest's plan has no home to share from.
create policy "Read your own share links" on public.schedule_shares
  for select to authenticated using ((select auth.uid()) = owner);
create policy "Create share links for your account" on public.schedule_shares
  for insert to authenticated
  with check ((select auth.uid()) = owner and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
create policy "Update your own share links" on public.schedule_shares
  for update to authenticated using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);

-- What a reader's browser gets for a live link, and nothing for a stopped or unknown one.
create or replace function public.shared_schedule(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('title', s.title, 'options', s.options, 'entries', s.entries, 'updated_at', s.updated_at)
  from public.schedule_shares s
  where s.token = p_token and s.revoked_at is null and char_length(p_token) = 32;
$$;

revoke execute on function public.shared_schedule(text) from public;
grant execute on function public.shared_schedule(text) to anon, authenticated;
