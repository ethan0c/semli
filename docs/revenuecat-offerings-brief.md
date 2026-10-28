# Brief: set up Semli's RevenueCat offerings and App Store products

For: Rico. From: Ethan. Date: Oct 19, 2026; status added Oct 20.
Project: RevenueCat project **Semli** (`a2c96d90`). App bundle id `app.semli.mobile`. The app code reads these identifiers exactly, so please copy them character for character.

## Status, Oct 20, 2026

Done by Ethan: RevenueCat App Store app **Semli (App Store)** created with bundle id `app.semli.mobile` and the In-App Purchase .p8 key; App Store Connect subscription group created (named **plus**; rename it to **Semli Plus** when you're in there); App Store Server Notifications and the shared secret are being wired by Ethan. The app record is `6824600264`.

Still yours: the six products in App Store Connect (section 1, steps 2 to 4 and 6), the entitlement and offerings in RevenueCat (section 2), and the Test Store mirror. Skip section 2 step 6; Ethan has the public SDK key. Ethan's paste-ready message to you is at the bottom.

## What we sell

One paid tier, **Semli Plus**, with three terms and two price lists. Student pricing is on the honor system (the app has a toggle, nothing is verified), so student and regular are simply two sets of products at different prices.

| Term | Apple duration | Student price | Regular price |
|---|---|---|---|
| Monthly | 1 month, auto-renewing | $4.99 | $7.99 |
| Semester | **6 months**, auto-renewing (Apple has no 4-month term) | $14.99 | $24.99 |
| Yearly | 1 year, auto-renewing | $24.99 | $44.99 |

Every product gets a **7-day free trial** (introductory offer, "free", 7 days, one per customer). No lifetime product. Free users are not a product; the app handles the free tier itself.

## 1. App Store Connect

1. Create one subscription group named **Semli Plus**. All six products go in this group so a customer can only hold one at a time and upgrades/downgrades work.
2. Create six auto-renewable subscriptions with these **product IDs** (lowercase, exactly):

| Product ID | Reference name | Duration | Price (USD) |
|---|---|---|---|
| `semli_plus_monthly_student` | Plus Monthly (student) | 1 month | 4.99 |
| `semli_plus_semester_student` | Plus Semester (student) | 6 months | 14.99 |
| `semli_plus_yearly_student` | Plus Yearly (student) | 1 year | 24.99 |
| `semli_plus_monthly_regular` | Plus Monthly | 1 month | 7.99 |
| `semli_plus_semester_regular` | Plus Semester | 6 months | 24.99 |
| `semli_plus_yearly_regular` | Plus Yearly | 1 year | 44.99 |

3. On each: add an introductory offer, type **Free**, duration **1 week** (that is Apple's "7 days"), all territories. Localized display name "Semli Plus (Monthly)" etc., description "Unlimited AI imports of syllabi, schedules, and messages."
4. Group ranking (for upgrade/downgrade direction): yearly regular > yearly student > semester regular > semester student > monthly regular > monthly student.
5. Set the group's localized name to "Semli Plus". Make sure the app's paid-apps agreement, tax, and banking are complete or the products will not load in sandbox.
6. Create a sandbox tester account and send me the email.

## 2. RevenueCat

1. **Entitlement**: identifier `semli_plus` (keep this exact id; the app checks it), display name "Semli Plus". Attach all six App Store products to it.
2. Import the six App Store products into the catalog (App Store Connect integration or manual).
3. Create **two offerings**:
   - `student`: packages `$rc_monthly` → `semli_plus_monthly_student`, `$rc_six_month` → `semli_plus_semester_student`, `$rc_annual` → `semli_plus_yearly_student`. **Make this the current offering.**
   - `regular`: packages `$rc_monthly` → `semli_plus_monthly_regular`, `$rc_six_month` → `semli_plus_semester_regular`, `$rc_annual` → `semli_plus_yearly_regular`.
   Use the standard package types, not custom identifiers. The app reads `offerings.all.student`, `offerings.all.regular`, and the `.monthly`, `.sixMonth`, `.annual` packages on each.
4. **Test Store**: mirror the same two offerings with the same package types and the six prices, so debug builds (which use the test store key) show the right plans. Test Store product ids can be `monthly_student`, `semester_student`, `yearly_student`, `monthly_regular`, `semester_regular`, `yearly_regular`.
5. Remove the old `lifetime` product and any `default` offering that still lists it, or at least make sure `student` is current and no offering exposes `$rc_lifetime`.
6. Public SDK keys: send me the **Apple public SDK key** (`appl_…`) for the project. Never the secret `sk_` key. It goes in the app as `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`.
7. Leave Paywalls (the hosted editor) and Customer Center alone for now; the paywall is built in the app.

## 3. How I'll verify

From a development build on a phone with the sandbox account:
- `Purchases.getOfferings()` returns `current.identifier === 'student'` and `all.regular` exists, each with monthly, sixMonth, and annual packages.
- Each package's `product.introPrice` shows a 7-day free trial.
- Buying `semli_plus_semester_student` activates the `semli_plus` entitlement; restore on a second install recovers it.

Questions: the only decision worth a call is the 6-month semester term. If we prefer 3 months, change the duration on the two semester products and nothing else.


## Message sent Oct 20

> Rico, RevenueCat and the App Store app record are set up. Three things left, all in docs/revenuecat-offerings-brief.md in the repo:
>
> 1. App Store Connect → Subscriptions: the group is there (called "plus", rename to "Semli Plus"). Create the six products with the exact IDs in the brief, 1-week free intro offer on each, ranking as listed. Reference name, product ID and duration are the only fields the first screen asks for.
> 2. RevenueCat → Entitlements: `semli_plus`, attach all six. Offerings: `student` (current) and `regular`, standard package types monthly / six_month / annual.
> 3. Test Store: mirror both offerings so dev builds show real prices.
>
> IDs are read by the app character for character. Don't make a lifetime product or a default offering. Ping me when the products show "Ready to Submit" and I'll do a sandbox purchase.

## 4. Web (RevenueCat Billing), added Oct 28, 2026

The web planner at app.semli.app sells the same Plus through RevenueCat Billing (Stripe). Ethan has created the billing configuration (Stripe, USD, Stripe Tax with code `txcd_10103000`, SaaS personal use) and keeps the keys. What's left is the catalog, the same shape as the App Store one:

1. In the **RevenueCat Billing** app, create six products. Same prices and terms as the App Store, so nobody pays more on one than the other:

| Product ID | Title | Duration | Price (USD) | Free trial |
|---|---|---|---|---|
| `semli_plus_monthly_student_web` | Semli Plus (Monthly) | 1 month | 4.99 | 7 days |
| `semli_plus_semester_student_web` | Semli Plus (6 months) | 6 months | 14.99 | 7 days |
| `semli_plus_yearly_student_web` | Semli Plus (Yearly) | 1 year | 24.99 | 7 days |
| `semli_plus_monthly_regular_web` | Semli Plus (Monthly) | 1 month | 7.99 | 7 days |
| `semli_plus_semester_regular_web` | Semli Plus (6 months) | 6 months | 24.99 | 7 days |
| `semli_plus_yearly_regular_web` | Semli Plus (Yearly) | 1 year | 44.99 | 7 days |

   Description on each: "Unlimited AI imports of syllabi, schedules, and messages." The title is what checkout and receipts show, so it says "6 months", never "Semester" (App Review 3.1.2 wording, kept the same on the web).
2. **Entitlement**: attach all six to the existing `semli_plus`. No new entitlement; a web purchase has to unlock the iPhone and the other way round.
3. **Offerings**: add each web product to the existing packages, not new ones. `student`: `$rc_monthly` → `semli_plus_monthly_student_web`, `$rc_six_month` → `semli_plus_semester_student_web`, `$rc_annual` → `semli_plus_yearly_student_web`. `regular`: the same with the `_regular_web` products. Each package then holds one App Store product and one web product. `student` stays current. No lifetime product, no `default` offering.
4. Leave the billing configuration, tax, and the hosted paywall and purchase links alone; the paywall is built into the app.

How Ethan verifies: with the sandbox key (`rcb_sb_…`) in the web build, the web paywall shows the six prices with the trial, a Stripe test card buys `semli_plus_semester_student_web`, and the same account then shows Plus on the iPhone.

### Message for Oct 28

> Rico, the web planner is live at app.semli.app and sells Plus through RevenueCat Billing (Stripe). I've done the billing configuration and tax. Your part, also in docs/revenuecat-offerings-brief.md section 4:
>
> 1. RevenueCat → the RevenueCat Billing app → Products: six products, same prices as the App Store, 7-day free trial on each. IDs are the App Store ones with `_web` on the end (`semli_plus_monthly_student_web`, `semli_plus_semester_student_web`, `semli_plus_yearly_student_web`, and the same three with `_regular_web`). Titles "Semli Plus (Monthly)", "Semli Plus (6 months)", "Semli Plus (Yearly)"; never "Semester".
> 2. Attach all six to the existing `semli_plus` entitlement.
> 3. Add them to the existing packages in `student` and `regular` (monthly, six month, annual), next to the App Store products. Don't make new offerings or packages.
>
> Leave the billing config, tax and hosted paywalls as they are. Ping me when it's done and I'll run a test purchase.
