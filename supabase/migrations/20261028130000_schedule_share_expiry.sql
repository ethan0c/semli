-- A share link can stop on its own: after a week, or at the end of the term, chosen when it's made.
-- Null keeps the default, until the owner stops it. Past its end a link reads exactly like a stopped
-- one (the page says it stopped working) and no longer counts toward the 20 live links.

alter table public.schedule_shares add column expires_at timestamptz;

create or replace function public.guard_schedule_share()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.schedule_shares
        where owner = new.owner and revoked_at is null and (expires_at is null or expires_at > now())) >= 20 then
      raise exception 'Too many share links' using errcode = 'P0001';
    end if;
    new.revoked_at := null;
    if new.expires_at is not null and new.expires_at <= now() then
      raise exception 'A share link has to end in the future' using errcode = 'P0001';
    end if;
  else
    -- The address, its owner, its age and its end never change, and a stopped link stays stopped.
    if old.revoked_at is not null then
      raise exception 'This share link was stopped' using errcode = 'P0001';
    end if;
    new.id := old.id;
    new.owner := old.owner;
    new.token := old.token;
    new.created_at := old.created_at;
    new.expires_at := old.expires_at;
    if new.revoked_at is not null then
      new.entries := '[]'::jsonb;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.shared_schedule(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('title', s.title, 'options', s.options, 'entries', s.entries, 'updated_at', s.updated_at, 'expires_at', s.expires_at)
  from public.schedule_shares s
  where s.token = p_token and s.revoked_at is null and (s.expires_at is null or s.expires_at > now()) and char_length(p_token) = 32;
$$;
