# School flyer outreach

Status: Oct 26, 2026. Three schools for the January push, each with a friend who hands out postcards and puts up flyers. Extends the one-campus plan in [marketing-500.md](marketing-500.md) §6; the budget line is the $50 flyers-and-stickers item there, which this will exceed by about $20 to $40.

## Schools

| School | Tag on the postcard QR | Tag on the flyer QR | Who hands them out |
|---|---|---|---|
| York College of PA | `york` | `york-flyer` | |
| Pomona College | `pomona` | `pomona-flyer` | |
| Georgia Tech | `gatech` | `gatech-flyer` | |

Fill in the names once each friend has said yes. The deal for helpers is the ambassador deal in [launch-guide.md](launch-guide.md): Plus free for a year, $50 after 25 installs.

## The pieces

Made by `design/render-cards.py` into `design/cards/out/`; see its docstring. The concept is "Buried? / Sorted.": a pile of due-date stickers burying the front with one paper label (wordmark, "Buried?", the 83% survey line), and the same stickers lined up on the lavender back with "Sorted." and the QR.

- **Postcard**, 4 × 6 in landscape, 14 or 16 pt, full color both sides, matte or UV, 1/8 in bleed. One file per school: `<school>-postcard.pdf`, front then back.
- **Flyer**, 8.5 × 11 in, one side. `<school>-flyer.pdf`. Printed at each campus (print shop or FedEx Office), 10 to 20 per school, for the library, the nursing or engineering building and dorm boards. Check the posting rules; most boards need a student-life stamp.
- **Stickers**, 3 in die-cut, already in the January budget; not designed yet.

Every QR goes through `semli.app/beta?r=<tag>`, so `select ref, count(*) from waitlist group by ref` (and `beta_clicks`) says which school and which piece sent each install.

The copy says "Join the free iPhone beta". That is right until the App Store release. If 1.0 ships Jan 5, cards handed out from Jan 11 should say "Free on iPhone": change `BETA` in the script and reprint, or accept it for the first batch and fix it on the reorder.

## Printer

NextDayFlyers, US-based, same-day or next-day production, 14 or 16 pt with UV both sides. Cart (session-based, may not survive a new browser): <https://checkout.nextdayflyers.com/cart>. If it is empty, rebuild it from their postcards page: 4 × 6, full color both sides, 14 pt, UV both sides, slowest turnaround.

Checked and rejected Oct 26: AliExpress (2 to 4 weeks from China, order would have to go by Dec 1) and Bizay (overseas fulfilment, 2026 reviews report late and missing deliveries; its "4.1 × 6" is likely A6, not 4 × 6).

## Quantity

Decided Oct 26, 2026: **1,000 postcards for January**, split 400 York (the campus with the most people on the ground), 300 Pomona, 300 Georgia Tech. Three designs, so three line items or three orders; confirm the per-design pricing before paying.

Why not 2,000: the January model expects about 60 campus installs in total ([milestones.md](milestones.md)); at a 3 to 5% scan-to-install rate, 1,000 cards is 30 to 50 of them, the right share next to the two ambassadors. The beta wording goes stale after the release, and the first batch will show which school is worth going back to. Reorder for the fall push (Aug 15 to Sep 10) with the updated copy and the winning school weighted.

## Timeline

- By Dec 1: friends confirmed, names in the table above.
- By Dec 20: postcards ordered (the checklist's date; NextDayFlyers makes it in days, so there is slack).
- By Jan 8: postcards in each friend's hands; flyers printed locally the week classes start.
- Jan 11 onward: hand out in the two weeks around each school's first day. Check each school's calendar; Pomona and Georgia Tech may not start on Jan 11.
- Mon Jan 18: first read of `ref` counts. Cards pulling installs: reorder for February. Cards not pulling: the message, not the quantity.
