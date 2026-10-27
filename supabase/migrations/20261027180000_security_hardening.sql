-- Security review, Oct 27, 2026.

-- 1. Refunds come only from the site's server. refund_import() was callable by any signed-in
--    account, so calling it before every import made the free allowance unlimited.
--    refund_import_for(user) is service-role only and gives back at most 5 imports a month per
--    person: real failures are rare, and a loop of "fail on purpose" reads stops refunding there.
alter table public.import_usage add column if not exists refunds int not null default 0;

revoke execute on function public.refund_import() from public, anon, authenticated;

create or replace function public.refund_import_for(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.import_usage set count = greatest(count - 1, 0), refunds = refunds + 1
    where user_id = p_user and month = to_char(now() at time zone 'utc', 'YYYY-MM') and refunds < 5 and count > 0;
$$;
revoke execute on function public.refund_import_for(uuid) from public, anon, authenticated;
grant execute on function public.refund_import_for(uuid) to service_role;

-- 2. Parallel claims in the first 30 days: the window's sum was read once per statement, so fifty
--    imports fired at once could all pass a limit of five. One lock per person serialises them.
create or replace function public.claim_import(p_limit int, p_start_limit int, p_start_days int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  m text := to_char(now() at time zone 'utc', 'YYYY-MM');
  since timestamptz;
  used int;
begin
  if auth.uid() is null then return false; end if;
  perform pg_advisory_xact_lock(hashtext('claim_import:' || auth.uid()::text));
  insert into public.import_usage (user_id, month, count) values (auth.uid(), m, 0)
    on conflict (user_id, month) do nothing;
  select created_at into since from auth.users where id = auth.uid();
  if since is not null and since > now() - make_interval(days => p_start_days) then
    -- Starting out: the whole window shares one allowance, whatever the month.
    if (select coalesce(sum(count), 0) from public.import_usage where user_id = auth.uid()) >= p_start_limit then
      return false;
    end if;
    update public.import_usage set count = count + 1
      where user_id = auth.uid() and month = m
      returning count into used;
  else
    update public.import_usage set count = count + 1
      where user_id = auth.uid() and month = m and count < p_limit
      returning count into used;
  end if;
  return used is not null;
end;
$$;
revoke execute on function public.claim_import(int, int, int) from public, anon;
grant execute on function public.claim_import(int, int, int) to authenticated;

-- 3. The website demo's counter and the link's click counter are server-only, like the guest limit:
--    open to anon, anyone could burn a campus network's demo previews by hashing its address, or
--    fill beta_clicks with junk that skews the per-channel numbers.
revoke execute on function public.claim_demo(text, int) from public, anon, authenticated;
grant execute on function public.claim_demo(text, int) to service_role;
revoke execute on function public.log_beta_click(text) from public, anon, authenticated;
grant execute on function public.log_beta_click(text) to service_role;
