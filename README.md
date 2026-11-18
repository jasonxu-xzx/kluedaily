# KueDrop

A daily K-pop song-guessing game with rotating clue columns, at **https://kuedrop.com**. Side project and marketing-analytics project.
Working title was "Chart Detective" (the history below and the `archive/` files use it); briefly "Klue"
(kluedaily.com) until we found an existing word game with that name.

**Play locally:** `npm run serve`, then open http://localhost:8787.
**After editing songs/artists:** `npm run schedule` (keeps today and tomorrow fixed, reschedules the rest).
**Deploy:** push to `main` on GitHub (this repo; its name, kluedaily, is left over from the Klue days); Cloudflare Pages deploys `site/` automatically
(preset "None", no build command, output directory `site`). Live at https://kuedrop.com; `www` and the old
kluedaily.com 301-redirect to it via Cloudflare Redirect Rules. `hello@kuedrop.com` forwards via Cloudflare Email Routing.
**Settings:** PostHog key, report-form URL and site URL live in `site/assets/config.js`.
**Preview image:** edit `tools/og.html`, run `powershell -File tools/make-images.ps1`, then bump `og.png?v=N` in
`site/index.html` (both tags). iMessage/Discord cache by image URL and keep showing the old picture otherwise.
**Daily social posts:** `npm run social` renders "Today's KueDrop!" for today's case (Instagram + Threads 1080×1350,
X 1600×900) into `brand/daily/` (git-ignored), plus one caption per platform (Meta Business Suite, X, Threads; also
printed, X checked against 280 chars). `-- --tomorrow`, `-- --date YYYY-MM-DD`, `-- --case N`, `-- --filter girl|boy`,
`-- --copy meta|x|threads` (puts that caption on the clipboard). Template: `tools/social.html`. Shows the 4 clue
categories and difficulty, never the answer. X/Threads links carry `utm_source=x|threads&utm_campaign=daily`; set the
Instagram bio link to `kuedrop.com/?utm_source=instagram&utm_medium=social&utm_campaign=bio`.
**Recap posts:** `npm run social -- --recap` makes the debrief for yesterday's case (the answer, its values for that
day's clues, % of players who got it, "Can you guess today's KueDrop?"; links use `utm_campaign=recap`). The % comes
from PostHog when `tools/posthog.local.json` holds a personal API key with query:read
(`{"key": "phx_…", "project": "<project id>"}`, git-ignored); otherwise pass `--rate 63 [--players 248 --avg 4.6]`.
"Players" = people who finished that daily case on kuedrop.com; "avg guesses" is over the winners.
**Brand images** (profile pictures, X header): `powershell -File tools/make-brand.ps1` → `brand/`.
`CLAUDE.md` has the game rules, data rules and next engineering steps in compact form.

## How we got here (Nov 2026)
1. **Chart Detective v1**: KPopdle-style song guessing with 6 fixed columns.
   Dropped: KPopdle (kpopdle.app) already has a Song mode with nearly the same columns.
2. **Other markets considered**: C-pop (mainland players can't easily reach US-hosted sites,
   analytics hard), Eurovision (no interest). Decision: stay in K-pop.
3. **K-nnection**: K-pop Connections with a generator (3 auto categories + 1 hand-written purple,
   ambiguity check, decoy scoring). Dropped: My K-Pop Shows (mykpopshows.com) already runs a
   daily K-pop Connections with shares on X. Code kept in `archive/knnection/`.
4. **Chart Detective v2 (current)**: back to song guessing, but the clue columns rotate daily
   (artist fixed + 4 of 13), with difficulty set by the lineup. This is the differentiator:
   fixed-column games can't copy it without redesigning.

Lesson from 1–3: in K-pop, assume every proven daily format already exists somewhere.
Web search missed both competitors; check X, TikTok and fan Discords too.

## Launch checklist
**Done**
- [x] Format playtested (artist + 4 rotating columns, girl/boy/all filters)
- [x] Current 48 songs verified by the owner (corrections still to be applied to the file)

**Before soft launch**
- [ ] Apply data corrections
- [x] ~~Klue / kluedaily.com~~: dropped, an existing word game is called Klue
- [x] Final name: **KueDrop**; domain **kuedrop.com**
- [x] kuedrop.com on Cloudflare: custom domain, www → root redirect, Always Use HTTPS, kluedaily.com (+www) 301 → kuedrop.com (path + query kept), Email Routing for hello@
- [x] Searched for other games called "KueDrop": none; social handles registered
- [x] Data split into `site/data/songs.json` + `artists.json`
- [x] Standalone page: head tags, Open Graph preview image, favicon
- [x] PostHog analytics with the events listed in CLAUDE.md (key set, events verified)
- [x] Share text includes URL with `utm_source=share` (+ native share button on phones)
- [x] Privacy policy page, contact hello@kuedrop.com (Email Routing)
- [x] "Report a data error" link (Google Form)
- [x] Stable daily schedule (`data/schedule.json`, `npm run schedule` after every data change)
- [x] Weekly GitHub Action running `npm run check` so the schedule never runs out
- [x] GitHub repo → Cloudflare → kuedrop.com
- [x] Cloudflare: "Always Use HTTPS" on (http:// → https://)
- [x] PostHog: internal/test filter (`$host` doesn't contain localhost, 127.0.0.1, pages.dev)
- [x] Phone check on the live site: play, share, link preview card
- [ ] PostHog insights: D1/D7 retention, share rate, win rate + avg guesses by difficulty

**Soft launch (late Nov)**
- [ ] 20–50 players: friends + one fan Discord, for one week
- [ ] Label it "beta"; add ~10 songs per week so filtered pools don't repeat
- [ ] Watch: D1/D7 return rate, share rate (shares per completed game), win rate, average guesses by difficulty

**Public launch (winter break)**
- [ ] Check each community's self-promo rules first (some K-pop subreddits restrict it)
- [ ] Channels: fan Discords, K-pop X/Twitter, TikTok, then Reddit if allowed
- [ ] Success after month one: D7 retention above 20–25%, organic growth without constant promotion

## Data pipeline (after launch)
- Curation table: title, artist, year, month, label at release, length, official MV link,
  genre (6 buckets), title language, Hangul/alternate titles.
- Script derives: letters, words, first/last letter, season, career stage, view tier.
- Artist table: debut year, gender (F/M/X), parent group, aliases.
- Weekly GitHub Action: refresh YouTube views via the YouTube Data API (`videos.list`,
  50 IDs per call = 1 quota unit; default quota is 10,000 units/day). Never use `search.list`
  (100 units per call): store each song's video ID by hand during curation.
- Balance the pool across artists so the artist column keeps narrowing things down.
- Future column: cover color (iTunes Search API artwork → dominant color → ~9 hue buckets, show a swatch in feedback).

## Archive
- `archive/chart-detective-v1.html`: first fixed-column prototype
- `archive/knnection/`: Connections generator (`python generate.py 30 2027 > puzzles.json`, then `python build.py`)
