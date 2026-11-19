# Daily faceless posts

Two five-slide photo posts are prepared for 9 a.m. Eastern each day: one broad, practical productivity page and one softer, more aspirational page. The working names are **Next on the List** and **Her Better Hours**. The 30 original ideas in each account's bank cycle after 30 days, with a different photo order on later cycles. Review the first month of posts and refresh the ideas before treating this as a long-term content strategy.

Photos came from Unsplash and Pexels; each rendered deck includes `sources.json`. The renderer makes 1080×1920 JPEG slides and a short caption. It does not pick or add sounds. The Pexels files are in `photos/` and their source pages label them free under the Pexels license.

```sh
python3 design/faceless/daily.py --date 2026-11-20
python3 design/faceless/send_daily.py --dry-run
```

`send_daily.py` uses a gitignored `.recipient` file containing one `+1` phone number. Its send state is saved in the gitignored `state/delivery.json`, one item at a time. The LaunchAgent file is `com.semli.faceless-daily.plist` and uses the Mac's local 9 a.m.; this Mac was set to `America/New_York` when configured. The Mac must be awake and signed in. Messages scripting sends each image as its own message after a text with the caption; the delivery state records an accepted send command, not a confirmed read receipt. If a send command fails, inspect `state/launch.err` and retry `send_daily.py` the same day.

The first two sample sets are in `out/2026-11-19/`. They were sent manually through Messages and are separate from the revised queue. The revised preview sets are in `out/2026-11-20-preview/`.
