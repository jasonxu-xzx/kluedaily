# Klue — project notes for Claude Code

**Klue** (https://kluedaily.com; working title "Chart Detective"). Daily K-pop song-guessing web game, built as a side project AND a marketing-analytics
project (acquisition, retention, share rate). Owner: Jason. Read README.md for the full
history and launch checklist.

## Current state
- `site/` is the static site Cloudflare Pages deploys (no build step; output dir = `site`).
  - `index.html` (head, OG tags, markup) · `privacy.html`
  - `assets/config.js`: **the one config spot**: site URL, PostHog key/host, report-form URL, data version.
  - `assets/analytics.js`: loads PostHog only when a key is set; `window.cdTrack(event, props)`.
  - `assets/engine.js`: shared rules (columns, comparisons, pools, lineup scoring, KST calendar). ES module,
    imported by the browser and by `tools/schedule.mjs`. No DOM here.
  - `assets/game.js`: UI, storage, share, analytics events (ES module).
  - `data/songs.json` (48 songs, stable slug `id`) and `data/artists.json` (gender F/M/X, debut, parent, aliases).
  - `data/schedule.json`: **the daily answers**: per filter, one entry per case
    `{case, date, song, clues, band}`. Generated, never hand-edited.
  - `og.png`, `apple-touch-icon.png` are rendered from `tools/og.html` + `favicon.svg` by `tools/make-images.ps1`.
- Local preview: `node tools/serve.mjs` → http://localhost:8787 (JSON fetch needs http, not file://).
- `game_started` fires on a game's first guess. Saved daily guesses are stored by song slug with
  the day's answer; if the answer differs on reload, the saved guesses are dropped.
- **Schedule workflow:** after any change to songs.json/artists.json run `npm run schedule`
  (= `node tools/schedule.mjs`), then deploy data + schedule together. It keeps every case through
  tomorrow KST unchanged (`--lock-through N` to keep more), regenerates later days with the new data,
  and extends 120 days ahead. `npm run check` exits 1 if invalid or < 14 days left (for CI).
  - Picks: weighted draw from the longest-waiting third of the pool, no same artist within 2 days,
    no same song as another filter that day; new songs count as waiting a full cycle, so they mix in
    within weeks. Lineup: random within the weekday's band, no lineup repeated within 14 days.
  - **Song `id`s must never change or be removed once scheduled**; the script refuses if a locked case
    would break. Fix a title by editing `title`/`aliases`, not `id`.
  - If a day is missing from the schedule, `engine.js` falls back to a seeded pick (console warning).
- **Jason's data corrections are still not applied.**
- `archive/chart-detective-v2-prototype.html` is the original single-file prototype.

## Game rules (decided — don't change without asking)
- Player guesses a mystery song in 8 tries.
- Clue columns: **Artist is always shown**, plus **4 rotating columns** chosen daily from a pool of 13:
  year, month, season, MV views (tiers), length, genre, label, title letters, title words,
  first letter, last letter, title language, career stage.
- Month and season never appear on the same day (`CLASH`).
- Feedback: exact = green (🟩 in share text), close = yellow (🟨), off = pale (⬜). Jason's call: keep
  green/yellow, players read them by habit. ↑↓ for numbers; ← → for letters (alphabetical).
- Look: single light theme from the Klue palette (Soft Peach, Coral Glow, Tomato Jam accent, Sky Blue) on a
  deeper sand page ground (#EBDDBC) so cards stand out; tokens at the top of `site/assets/style.css`. No dark mode.
- Clue categories show names only (no emoji). Their explanations are hidden behind the
  "What do these mean?" button in the lineup header (event `clue_help_opened`). Share text: header,
  "Difficulty: X", emoji rows, URL.
- Daily reset at **midnight KST**. Case #1 = 2026-11-20 (KST), set by `LAUNCH_DAY` in engine.js
  (temporary launch date). Before launch, `gameDay()` holds at launch day: Case #1 is playable now
  and the first refresh is midnight KST into Nov 21 (Case #2).
  To move the launch date *before launch*: change `LAUNCH_DAY`, delete `data/schedule.json`,
  run `npm run schedule`. Never after launch (it renumbers every case; `--check` flags date mismatches).
- Difficulty: every lineup is scored by how fast an average guess narrows the pool
  (`lineupScore`). Lineups are sorted; weekday picks a band (Mon easiest … Sun hardest);
  the hardest 15% are never used.
- Filters: All / Girl groups / Boy groups. Co-ed acts (KARD, ALLDAY PROJECT) are in both;
  soloists follow their gender; XG is a girl group. Each filter has its own daily case + stats.

## Data rules
- Label = company AT TIME OF RELEASE (e.g. Dynamite = Big Hit Ent., Butter = BIGHIT MUSIC).
- Year/month = original release date. Season: Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov fall.
- Title language = original Korean-market title (Spring Day/봄날 = Korean; God's Menu/神메뉴 = Mixed).
- Title letters = letters + digits only, no spaces/punctuation. Words = split on spaces.
- Career stage = release year − artist's first debut year (soloists use their group's debut).
- Genre = one of 6 fixed buckets: Dance-pop, EDM, Hip-hop, R&B, Rock/Band, Latin
  (neighbors in `GENRE_NEAR`). Tie-break: first genre in the label's own release description.
- MV views: tiers 0 No MV · 1 <10M · 2 10–50M · 3 50–100M · 4 100–300M · 5 300M–1B · 6 1B+.
  Count the official MV wherever it was first posted. No MV is its own tier.
- NewJeans: leave label-family questions neutral (ongoing ADOR/HYBE dispute).
- No audio, lyrics or album art in the game (licensing). Don't scrape Melon.

## Next engineering steps (in order)
1. Split data out of index.html into `data/songs.json` + `data/artists.json`; apply Jason's corrections.
2. Make a standalone page: doctype/head, title + description, Open Graph tags + 1200×630 preview image, favicon.
3. Analytics with PostHog (US cloud, `api_host: https://us.i.posthog.com`). Events:
   `game_started`, `guess_made`, `game_completed` (won, guesses, mode, filter, difficulty, clues),
   `share_clicked`, `filter_changed`, `mode_changed`, `report_error_clicked`. Keep the key in one config spot.
4. Share text ends with the site URL + `?utm_source=share&utm_medium=social` (referral attribution).
5. Privacy policy page; "Report a data error" link (Google Form URL from Jason).
6. Git repo → Cloudflare Pages on Jason's domain.
7. Later: build script that precomputes lineup scores (browser scoring gets slow past ~150 songs),
   weekly GitHub Action pulling YouTube view counts (videos.list, 50 IDs per call; never search.list),
   cover-color column via iTunes Search API artwork + dominant-color buckets.
