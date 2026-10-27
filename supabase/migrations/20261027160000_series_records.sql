-- Repeat rules sync as their own records (Oct 27, 2026). Without them a second device rebuilt
-- each series from its occurrences with no skipped dates, so a lecture deleted on one phone came
-- back the next time the other edited that class. Until this runs, the app keeps series rows
-- pending and retries them (logged once as cloud.series_unsupported); nothing else is affected.
alter table public.plan_records drop constraint if exists plan_records_kind_check;
alter table public.plan_records add constraint plan_records_kind_check
  check (kind in ('item', 'course', 'schedule', 'workdate', 'series', 'profile'));

-- The Canvas feed link is the only credential to a student's calendar and stays on the phone;
-- older versions uploaded it inside the profile. Take it out of what is already stored.
update public.plan_records set data = data #- '{settings,canvas}'
  where kind = 'profile' and data #> '{settings,canvas}' is not null;
update public.plans set data = data #- '{settings,canvas}'
  where data #> '{settings,canvas}' is not null;
