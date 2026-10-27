-- The welcome email, queued in email_outbox like the account-deleted one and sent by the site
-- (apps/web/app/api/emails), which also puts the address in Resend's "App users" group.
-- Requires the site's sender to know the 'welcome' kind: deploy the web change first.

alter table public.email_outbox drop constraint email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check check (kind in ('account_deleted', 'welcome'));

-- One welcome per account, when it first has a confirmed address: at insert for Apple and
-- Google, after the emailed code for email sign-up, or when a guest adds an address. Apple
-- sends the name after the account exists, so a later name fills in a welcome still queued.
-- Accounts that existed before this migration get no welcome.
create or replace function public.queue_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')), '');
begin
  if new.email is null or new.email = '' or coalesce(new.is_anonymous, false) or new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'INSERT' or old.email_confirmed_at is null or coalesce(old.is_anonymous, false) then
    insert into public.email_outbox (email, kind, name) values (new.email, 'welcome', display_name);
  elsif display_name is not null then
    update public.email_outbox set name = display_name
      where email = new.email and kind = 'welcome' and name is distinct from display_name;
  end if;
  return new;
end;
$$;

revoke execute on function public.queue_welcome() from public, anon, authenticated;

create trigger on_auth_user_welcome
  after insert or update of email_confirmed_at, is_anonymous, raw_user_meta_data on auth.users
  for each row execute function public.queue_welcome();

-- Deleting an account before its welcome goes out cancels the welcome.
create or replace function public.queue_account_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.email_outbox where email = old.email and kind = 'welcome';
  if old.email is not null and old.email <> '' and coalesce(old.is_anonymous, false) = false then
    insert into public.email_outbox (email, kind, name)
      values (old.email, 'account_deleted', nullif(trim(coalesce(old.raw_user_meta_data ->> 'name', old.raw_user_meta_data ->> 'full_name', '')), ''));
  end if;
  return old;
end;
$$;
