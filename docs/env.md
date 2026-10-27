# Environment variables

Three places, one file each for local and for production. Local files stay on the Mac. Production
values live in the host, and the `.env.production` file is the copy you push from.

| File | Read by | Production copy goes to |
| --- | --- | --- |
| `apps/mobile/.env` | `expo start`, simulator builds | `apps/mobile/.env.production`, pushed with `npx eas-cli env:push --environment production --environment preview --path .env.production --force` |
| `apps/web/.env` | `next dev` | `apps/web/.env.production`, pasted into Vercel project settings (Production) |
| `.env` (repo root) | Supabase CLI and dashboard only | nowhere; nothing deployed reads it |

## Mobile

| Variable | What it does | Local vs production |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Site that runs imports | `http://localhost:3000` vs `https://semli.app` |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` | Accounts and backup | same |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Subscriptions | same |
| `EXPO_PUBLIC_REVENUECAT_CUSTOMER_CENTER_ENABLED` | Shows the RevenueCat customer center | same |
| `EXPO_PUBLIC_REVENUECAT_WEB_API_KEY` | Plus on the web planner (RevenueCat Web Billing, Stripe). Unset, the web paywall says it's on its way | `rcb_sb_…` sandbox vs `rcb_…` |
| `EXPO_PUBLIC_APPLE_WEB_SIGNIN` | `true` shows Sign in with Apple on the web, once its Services ID is set up (`docs/web.md`) | same |
| `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST` | Analytics | same |
| `EXPO_PUBLIC_SENTRY_DSN` | Crash reporting, project `semli-mobile` | same |
| `SENTRY_AUTH_TOKEN` | Build step uploads source maps and dSYMs. Secret. | same |

Every `EXPO_PUBLIC_*` value is compiled into the app binary, so none of them is secret. Only the
Sentry token is.

## Web

| Variable | What it does |
| --- | --- |
| `ANTHROPIC_API_KEY` | `/api/extract` reads schedules and syllabi. Secret. |
| `SUPABASE_URL`, `SUPABASE_KEY` | Import limits and the beta waitlist. Same project as the app. |
| `REVENUECAT_SECRET_KEY` | Confirms a Plus subscriber before a paid import. Secret. Production only. |
| `TESTFLIGHT_URL` | Set once the public TestFlight link exists; `semli.app/beta` then redirects there. |
| `APP_STORE_PROVIDER_TOKEN` | The `pt=` number from any App Store Connect campaign link (App Analytics → Campaigns). With it, `semli.app/beta?r=<tag>` sends people to the App Store with `ct=<tag>`, so installs are counted per tag. Not secret. |
| `SUPABASE_SERVICE_ROLE_KEY` | Reads and clears `email_outbox` for transactional email (`app/api/emails`). Secret; never in the app. |
| `RESEND_API_KEY` | Sends transactional email and keeps Resend's App users group in step with accounts (adds each welcomed address, deletes a deleted account's contact). Needs a full-access key for the group; with a send-only key the emails still go and `npm run email sync` catches the group up. Secret. |
| `CRON_SECRET` | Vercel sends it to the daily `/api/emails` cron (`vercel.json`); any long random string. Secret. |

## Tooling

| Variable | What it does |
| --- | --- |
| `DATABASE_PASSWORD` | `supabase db push` |
| `RESEND_API_KEY` | `npm run email` (status, sync, broadcasts). Needs a full-access key; the send-only key pasted into Supabase SMTP cannot list segments or create broadcasts |
| `EMAIL_POSTAL_ADDRESS` | Sender's postal address in every marketing email footer |
| `REVIEW_EMAIL`, `REVIEW_PASSWORD` | App Store review account, pasted into App Store Connect Sign-in Information |

Last reorganized Oct 20, 2026.
