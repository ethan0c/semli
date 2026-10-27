-- Welcome emails within the hour (decided Oct 27, 2026). Every 10 minutes the database asks the
-- site to send, but only when a row is due, so most runs make no request. The site sends account
-- emails at once and a welcome 45 minutes after it was queued (apps/web/app/api/emails), so it
-- lands 45 to 55 minutes after sign-up, once the person has had time to try an import. Vercel's
-- daily cron stays as the backup. The send route takes no secret: it only sends what is queued.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- cron.schedule with an existing name replaces that job, so rerunning this is safe.
select cron.schedule(
  'send-email-outbox',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://www.semli.app/api/emails',
    body := '{}'::jsonb,
    headers := '{"content-type": "application/json"}'::jsonb
  )
  where exists (
    select 1 from public.email_outbox
    where kind <> 'welcome' or created_at <= now() - interval '45 minutes'
  )
  $$
);
