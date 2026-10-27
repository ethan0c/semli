-- Free imports from guests (anonymous sessions), counted per network per day (Oct 27, 2026). Every
-- guest gets five free imports, and a guest costs a script nothing to make, so without this a loop
-- of new guests could spend the AI budget until the provider's spend limit stopped imports for
-- everyone. Signed-in and Plus users never touch this table, and signing in (free) lifts the cap.
-- Only the site's server may call these (service role): open to anon, anyone could use up a
-- campus network's allowance on purpose by hashing its address.
create table public.guest_import_usage (
  ip_hash text not null,
  day date not null,
  count int not null default 0,
  primary key (ip_hash, day)
);
alter table public.guest_import_usage enable row level security;

create or replace function public.claim_guest_import(p_ip_hash text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := (now() at time zone 'utc')::date;
  used int;
begin
  insert into public.guest_import_usage (ip_hash, day, count) values (p_ip_hash, d, 0)
    on conflict (ip_hash, day) do nothing;
  update public.guest_import_usage set count = count + 1
    where ip_hash = p_ip_hash and day = d and count < p_limit
    returning count into used;
  return used is not null;
end;
$$;

-- A read that failed or found nothing gives its claim back, as refund_import does for the account.
create or replace function public.refund_guest_import(p_ip_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.guest_import_usage set count = greatest(count - 1, 0)
    where ip_hash = p_ip_hash and day = (now() at time zone 'utc')::date;
$$;

revoke execute on function public.claim_guest_import(text, int) from public, anon, authenticated;
revoke execute on function public.refund_guest_import(text) from public, anon, authenticated;
grant execute on function public.claim_guest_import(text, int) to service_role;
grant execute on function public.refund_guest_import(text) to service_role;
