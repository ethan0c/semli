# School postcard outreach

Status: Oct 27, 2026. Three schools for the January push, each with a friend who hands out postcards. Extends the one-campus plan in [marketing-500.md](marketing-500.md) §6; the budget line is the $50 flyers-and-stickers item there, which this plan exceeds (see Price). The research behind the fronts, the one-second flash test and the reference pieces from Duolingo, Hinge, Spotify, Oatly, Fizz and others are on the card drafts board: <https://claude.ai/artifact/WDyW5jc9XJDdcAv3YeiJV9>.

## Schools

| School | Name on the E card | Who hands them out |
|---|---|---|
| York College of PA | York | |
| Pomona College | Pomona | |
| Georgia Tech | Georgia Tech | |

Fill in the names once each friend has said yes. The deal for helpers is the ambassador deal in [launch-guide.md](launch-guide.md): Plus free for a year, $50 after 25 installs. The friend's one line at the hand-off: "It reads your syllabus. Flip it, scan it, two minutes." The hand-off is the channel; the card is what stays in the bag.

## The pieces

Made by `design/render-cards.py` into `design/cards/out/`, one PDF per line item (front, then back); see its docstring. Decided Oct 27, 2026: **1,000 postcards, five line items, three fronts, one back system.** Multiple fronts are a hedge and a coarse read, not a clean test: at 30 to 50 installs in total, the January counts can say which fronts got scans at all and which school pulled, not which front converts a point better.

| Tag in the QR | Front | Qty | Goes to |
|---|---|---|---|
| `york-e` | E: "York, your syllabus is a to-do list now." | 200 | York |
| `pomona-e` | E, Pomona wording | 200 | Pomona |
| `gatech-e` | E, Georgia Tech wording | 200 | Georgia Tech |
| `pile` | The sticker pile and "Buried?" only; the survey line and the flip cue are gone | 250 | 100 York, 75 Pomona, 75 Georgia Tech |
| `c` | "That assignment you forgot about is due on Thu", the rest of the word running off the trim; the back answers "Thursday." | 150 | York |

- E names the school, so it is printed per school. The pile and C do not, so each is printed once and the school is known from who hands it out.
- Every back is lavender with the same scan block in the same place: a verb caption, a plain QR with its quiet zone, "Free iPhone beta", `semli.app`. Each back has its own headline.
- Spec: 4 × 6 in landscape, 14 pt, full color both sides, UV both sides, 3-business-day turnaround, 1/8 in bleed.
- Held for the fall reorder: B, the "Dear person with an essay, a quiz and a café shift on the same Thursday" front. Out: D (the 83% number) and the letter-size flyer. Most campus boards take registered clubs only, and every campus story in the research where an app ignored that ended with the posters pulled. If a friend asks student life and a non-club poster can be stamped, that is their call; nothing is designed for it.
- **Stickers**, 3 in die-cut, undesigned, still in the plan: a sticker on someone's own laptop is not a posting.
- Draft E on the board carries a per-school Plus code (the one element shown to raise keep rate in eye tracking). It is not in the print copy: it contradicts the beta's no-free-Plus rule in marketing-500.md, and the decision is open.

Every QR goes through `semli.app/beta?r=<tag>`, which logs one row per scan in `beta_clicks` and then redirects, so `select ref, count(*) from beta_clicks group by ref` counts scans per front and, for E, per school. Installs are not attributed per tag while the link goes to TestFlight (Apple does not pass the tag through); signups in `waitlist` keep it only while the route points at the waitlist. If 1.0 is on the App Store by Jan 5, point the route at the App Store link with a campaign token (`ct=<tag>`) and App Store Connect reports downloads per front.

The copy says "Free iPhone beta". That is right until the App Store release. If 1.0 ships Jan 5, cards handed out from Jan 11 should say "Free on iPhone": change `BETA` in the script and reprint, or accept it for the first batch and fix it on the reorder.

## Price

Estimates, Oct 27, 2026. NextDayFlyers prices each design in an order at its own quantity (their FAQ), and the calculator could not be read from outside, so the card figures are built from the two numbers their pages publish (27¢ each for 100 glossy 14 pt, $73.95 for 100 with UV). **The cart is the source of truth; confirm before paying.**

| Item | Estimate |
|---|---|
| Five card line items, 1,000 cards | $160 to $190 |
| Shipping, one box | $15 to $25 |
| Stickers, 100 to 150 | $50 to $70 |
| Proof run, 25 of `c` only, for the cut word at trim | $15 to $20 |
| Flyers | $0 |
| Flash test, ten people | $0 |
| Total | $240 to $305 |

Against the $500 plan: January has $150, of which $100 is the two ambassadors, so this overruns the plan by roughly $150 to $250. If the cart shows the 150 to 250 tiers above 20¢ a card, drop `c` first (one line item and the only print risk). The cheapest version that still tests a front is E per school plus the pile, four line items, about $140 to $165 shipped.

## Printer

NextDayFlyers, US-based, same-day to 3-business-day production, 14 or 16 pt with UV both sides, minimum 25 per design, multiple designs per order with their own quantities. Cart (session-based, may not survive a new browser): <https://checkout.nextdayflyers.com/cart>. If it is empty, rebuild it from their postcards page: 4 × 6, full color both sides, 14 pt, UV both sides, slowest turnaround, one design per line item at the quantities above.

Checked and rejected Oct 26: AliExpress (2 to 4 weeks from China, order would have to go by Dec 1) and Bizay (overseas fulfilment, 2026 reviews report late and missing deliveries; its "4.1 × 6" is likely A6, not 4 × 6).

## Timeline

- By Nov 15: flash-test ten people who have not seen the board (one second per front, "what did it say?", "would you turn it over?"); settle the final wording.
- By Nov 22: fronts final in `design/render-cards.py`; friends asked.
- By Dec 1: friends confirmed, names in the table above. Order 25 proofs of `c`; scan every proof on three phones under a desk lamp and check the cut word at trim.
- By Dec 20: the real order placed (NextDayFlyers makes it in days, so there is slack).
- By Jan 8: postcards in each friend's hands with the one-line script.
- Jan 11 onward: hand out in the two weeks around each school's first day. Check each school's calendar; Pomona and Georgia Tech may not start on Jan 11.
- Mon Jan 18: first read of `ref` counts. Expect 30 to 50 installs in total. Fronts with scans: reorder for February, weighted to the school that pulled. Fronts with none: the message, not the quantity. The fall push (Aug 15 to Sep 10) gets B and the post-release wording.
