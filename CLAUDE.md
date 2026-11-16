# KueDrop — project notes for Claude Code

**KueDrop** (https://kuedrop.com; "cue" + a comeback "drop"). Earlier names: "Chart Detective" (working title),
"Klue" (dropped Nov 2026: an existing word game already uses it; kluedaily.com should 301 to kuedrop.com). Daily K-pop song-guessing web game, built as a side project AND a marketing-analytics
project (acquisition, retention, share rate). Read README.md for the full
history and launch checklist.

## Current state
- `site/` is the static site Cloudflare Pages deploys (no build step; output dir = `site`).
  - `index.html` (head, OG tags, markup) · `privacy.html`
  - `assets/config.js`: **the one config spot**: site URL, PostHog key/host, report-form URL, data version.
  - `assets/analytics.js`: loads PostHog only when a key is set; `window.cdTrack(event, props)`.
  - `assets/engine.js`: shared rules (columns, comparisons, pools, lineup scoring, KST calendar). ES module,
    imported by the browser and by `tools/schedule.mjs`. No DOM here.
  - `assets/game.js`: UI, storage, share, analytics events (ES module).
  - `data/songs.json` (stable slug `id`) and `data/artists.json` (gender F/M/X, debut, parent, aliases).
  - `data/lineups.json`: generated ranked clue sets per filter (easiest first) for Practice mode, so the browser
    never runs the O(songs²) lineup scoring (36 s at 1,000 songs on a PC; now ~10 ms). Stamped with `dataHash`.
  - `data/schedule.json`: **the daily answers**: per filter, one entry per case
    `{case, date, song, clues, band}`. Generated, never hand-edited.
  - `og.png`, `apple-touch-icon.png` are rendered from `tools/og.html` + `favicon.svg` by `tools/make-images.ps1`.
- Local preview: `node tools/serve.mjs` → http://localhost:8787 (JSON fetch needs http, not file://).
- `game_started` fires on a game's first guess. Saved daily guesses are stored by song slug with
  the day's answer; if the answer differs on reload, the saved guesses are dropped.
- **Schedule workflow:** after any change to songs.json/artists.json run `npm run schedule`
  (= `node tools/schedule.mjs`), then deploy data + schedule together. It keeps every case through
  tomorrow KST unchanged (`--lock-through N` to keep more), regenerates later days with the new data,
  and extends 120 days ahead, and rewrites lineups.json. `npm run check` exits 1 if the data is invalid, the
  schedule is broken or < 14 days left, or lineups.json is stale (for CI).
  - **Data validation** (`tools/validate.mjs`, run by both): errors block (bad genre/lang/month/tier/length,
    unknown artist, release before debut, duplicate id, a label spelled two ways); warnings flag likely typos
    (look-alike label/artist names, same titles). Deliberate label renames go in `KNOWN_DISTINCT`.
  - Picks come from the **answer pool** (songs without `"guessOnly": true`); guessOnly songs can be guessed
    and count in difficulty scoring, but are never an answer (daily, practice or fallback).
  - Picks: weighted draw from the longest-waiting third of the pool, no same artist within 2 days,
    no same song as another filter that day; new songs count as waiting a full cycle, so they mix in
    within weeks. Lineup: random within the weekday's band, no lineup repeated within 14 days.
  - **Song `id`s must never change or be removed once scheduled**; the script refuses if a locked case
    would break. Fix a title by editing `title`/`aliases`, not `id`.
  - If a day is missing from the schedule, `engine.js` falls back to a seeded pick (console warning).
- `archive/chart-detective-v2-prototype.html` is the original single-file prototype.

## Game rules (decided — don't change without asking)
- Player guesses a mystery song in 8 tries.
- Clue columns (since Nov 15 2026): **Artist is always shown**, plus **2 fan clues + 2 stat clues** chosen daily
  (`kind` in engine.js COLS; 21 × 6 = 126 lineups).
  - Fan (7): members at release (±1), music show wins (0 / 1–4 / 5–9 / 10+, close = next tier), cover color
    (9 buckets, swatch shown; close = neighbor on the Red-Orange-Yellow-Green-Blue-Purple-Pink wheel; Black/White exact only),
    MV views (tiers), label (close = same parent company), comeback no. (Nth release, ±1), comeback gap
    (Debut / <3 months / 3–6 / 6–12 / 1 year+, close = next tier; Debut is never close).
  - Stat (4): release year, first letter, title letters, song length.
  - Dropped: month, season, genre, title words, last letter, title language, career stage (genre/titleLang stay in the data).
  - First-week sales: considered, left out for launch.
- Feedback: exact = green (🟩 in share text), close = yellow (🟨), off = pale (⬜). Owner's call: keep
  green/yellow, players read them by habit. ↑↓ for numbers; ← → for letters (alphabetical).
- Look ("pop", approved by the owner): aesthetic reference is 2020s K-pop pop-art album branding (the look only:
  never copy album art, logos or wordmarks). Lemon #FFE14F ground, cobalt #1F46C8 ink/outlines, bubblegum
  #FF8AC8 accent; white sticker cards (2.5px cobalt outline + 4px hard offset shadow); pill buttons/toggles;
  background decoration = `.deco` block in index/privacy HTML (bubbles, polka dots, sparkles, music notes,
  halftone patches), fixed and anchored to window edges/corners so some always show at any width. Rule: decorations
  never sit behind text on the lemon; text there gets a backing (footer is a white sticker card, label/message pills).
  Share box: pale bubblegum #FFE6F3 with dashed cobalt edge, Righteous. Fonts: Bagel Fat One (logo,
  headings, stat numbers; one weight), Righteous (small labels), IBM Plex Sans KR (body), IBM Plex Mono (share box,
  arrows). Tokens + "Pop look" section in `site/assets/style.css`. One theme, no dark mode.
  Tried and rejected: Honeydew/Tomato palette (too flat), Cerulean/Old Lace (looked good, not "K-pop").
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
- Title letters = letters + digits only, no spaces/punctuation.
- `members` = official lineup at release (members on hiatus count; soloists 1; BATTER UP 6, pre-Ahyeon).
- `wins` = first places on The Show, Show Champion, M Countdown, Music Bank, Show! Music Core, Inkigayo (no Show K-Pop etc.).
- `comeback` = the act's Nth comeback, **one album = one comeback** (owner's call): albums, EPs, single albums,
  repackages, and standalone digital singles (English-language ones too) that were never an album's pre-release.
  Pre-release singles fold into their album (Mantra + like JENNIE = Ruby; Ditto + OMG; Kitsch + I AM). Not: Japanese
  releases, OSTs, collabs/features on others' songs, SM Station, sub-units (soloists count only their solo releases).
  Debut = 1. `gapMonths` = whole months from the previous comeback to this one's first single (omitted for debuts).
  Every song of one comeback shares its number and gap; B-sides also use the album's cover. Wins are each song's own.
- `cover` = main color of the original release artwork: `tools/cover-colors.ps1` (iTunes Search API) writes
  `tools/cover-colors.csv` for review; nearly-gray pixels are ignored, so a cover counts as Black/White only when < 20% is colorful.
- Genre = one of 6 fixed buckets: Dance-pop, EDM, Hip-hop, R&B, Rock/Band, Latin
  (not a clue right now; kept in the data). Tie-break: first genre in the label's own release description.
- MV views: tiers 0 No MV · 1 <10M · 2 10–50M · 3 50–100M · 4 100–300M · 5 300M–1B · 6 1B+.
  Count the official MV wherever it was first posted. No MV is its own tier.
- NewJeans: leave label-family questions neutral (ongoing ADOR/HYBE dispute).
- No audio, lyrics or album art in the game (licensing). Don't scrape Melon.
- Song `id` = title slug (`hype-boy`); if two songs share a title, use `<title slug>-<artist key>` (`butterfly-bts`).
- `"guessOnly": true` (optional) = guessable deep cut that is never chosen as an answer. Default: answerable.
- Keep the girl/boy pools reasonably balanced: the smaller pool repeats daily answers sooner.

## Next engineering steps (in order)
1. Split data out of index.html into `data/songs.json` + `data/artists.json`; apply the owner's data corrections.
2. Make a standalone page: doctype/head, title + description, Open Graph tags + 1200×630 preview image, favicon.
3. Analytics with PostHog (US cloud, `api_host: https://us.i.posthog.com`). Events:
   `game_started`, `guess_made`, `game_completed` (won, guesses, mode, filter, difficulty, clues),
   `share_clicked`, `filter_changed`, `mode_changed`, `report_error_clicked`. Keep the key in one config spot.
4. Share text ends with the site URL + `?utm_source=share&utm_medium=social` (referral attribution).
5. Privacy policy page; "Report a data error" link (Google Form).
6. Git repo → Cloudflare Pages on the project domain.
7. Later: weekly GitHub Action pulling YouTube view counts (videos.list, 50 IDs per call; never search.list),
   cover-color column via iTunes Search API artwork + dominant-color buckets.
