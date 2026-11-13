// Builds site/data/schedule.json: the answer, clue lineup and difficulty for every daily case, per filter.
//
//   node tools/schedule.mjs              keep every case through tomorrow (KST), regenerate the rest, extend to 120 days ahead
//   node tools/schedule.mjs --days 60    how far ahead to schedule (from today)
//   node tools/schedule.mjs --lock-through 30   also keep cases up to #30 exactly as they are
//   node tools/schedule.mjs --check      validate only; exit 1 if broken or fewer than --min-days (14) days are left
//
// Run it after every change to songs.json / artists.json, then deploy schedule.json together with the data.
// Past cases, today and tomorrow never change, so a deploy can't swap the answer under someone mid-game.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine, FILTERS, ROTATING, gameDay, caseOfDay, dayOfCase, dateOfDay, bandOfDay, mulberry32, hashStr, DIFF_NAMES } from "../site/assets/engine.js";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const DAYS = Number(opt("--days", 120));
const MIN_DAYS = Number(opt("--min-days", 14));
const CHECK = args.includes("--check");

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "site", "data");
const readJson = f => JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8"));
const E = createEngine(readJson("artists.json"), readJson("songs.json"));
const schedFile = path.join(dataDir, "schedule.json");
const old = fs.existsSync(schedFile) ? readJson("schedule.json") : {};

const today = gameDay(), todayCase = caseOfDay(today);   // before launch: launch day, Case #1
const lockThrough = Math.max(todayCase + 1, Number(opt("--lock-through", 0)));
const endCase = Math.max(todayCase, 1) + DAYS;

// ---------- Validate what's there ----------
const errors = [], warnings = [];
for (const f of FILTERS) {
  (old[f] || []).forEach((e, i) => {
    const where = `${f} case #${e.case} (${e.date})`;
    if (e.case !== i + 1) { errors.push(`${f}: entry ${i} has case ${e.case}, expected ${i + 1}`); return; }
    if (e.date !== dateOfDay(dayOfCase(e.case))) { errors.push(`${where}: date doesn't match LAUNCH_DAY in engine.js (launch date changed? delete schedule.json before launch, never after)`); return; }
    const p = E.entryToPuzzle(e);
    const bad = !p ? `invalid entry (song "${e.song}" missing, or bad clues/band)` : !E.POOLS[f].includes(p.answer) ? `song "${e.song}" is not in the ${f} pool` : null;
    if (!bad) return;
    // Past days can't be played any more, so only today and later matter.
    (e.case >= todayCase ? errors : warnings).push(`${where}: ${bad}`);
  });
}
const lastCase = Math.min(...FILTERS.map(f => (old[f] || []).length));
const daysLeft = lastCase - todayCase;

if (CHECK) {
  warnings.forEach(w => console.warn("warn:", w));
  errors.forEach(e => console.error("ERROR:", e));
  console.log(`Today is case #${todayCase} (${dateOfDay(today)} KST). Scheduled through case #${lastCase}: ${daysLeft} days left.`);
  if (daysLeft < MIN_DAYS) console.error(`ERROR: fewer than ${MIN_DAYS} days scheduled. Run: node tools/schedule.mjs`);
  process.exit(errors.length || daysLeft < MIN_DAYS ? 1 : 0);
}
const lockedErrors = errors.filter(e => { const m = e.match(/case #(\d+)/); return m && +m[1] <= lockThrough; });
if (lockedErrors.length) {
  lockedErrors.forEach(e => console.error("ERROR:", e));
  console.error(`These cases are locked (today or tomorrow, or --lock-through). A song they use was removed or renamed.\n` +
    `Song ids must never change once scheduled. Put the song back, or fix its id, then run again.`);
  process.exit(1);
}

// ---------- Generate ----------
// Songs come round in a fair cycle: each day picks from the quarter of the pool that has waited longest
// (never-used songs, including newly added ones, wait the longest), avoiding the last two days' artists
// and today's answers in the other filters. Lineups come from the weekday's difficulty band, avoiding
// any lineup the filter used in the last 14 days.
const out = {}, state = {};
for (const f of FILTERS) { out[f] = []; state[f] = { lastUsed: new Map(), lineups: [] }; }
const lineupKey = ids => [...ids].sort().join(",");
let kept = 0, made = 0;
const runStart = lockThrough + 1;

for (let c = 1; c <= endCase; c++) {
  const day = dayOfCase(c), band = bandOfDay(day), todays = new Set();
  for (const f of FILTERS) {
    const st = state[f], prev = (old[f] || [])[c - 1];
    let entry;
    if (prev && c <= lockThrough) { entry = prev; kept++; }
    else {
      const rng = mulberry32(hashStr(`${f}:${c}`));
      const pool = E.POOLS[f];
      // A song never scheduled (at launch, or newly added) counts as last used one full pool-length before
      // this run started, so new songs join the rotation soon without all landing back to back.
      const lastUsed = s => st.lastUsed.has(s.slug) ? st.lastUsed.get(s.slug) : runStart - pool.length;
      const queue = [...pool].sort((a, b) => lastUsed(a) - lastUsed(b) || hashStr(f + a.slug) - hashStr(f + b.slug));
      const window = queue.slice(0, Math.max(1, Math.ceil(pool.length / 3)));
      const recentArtists = new Set(out[f].slice(-2).map(e => E.BY_SLUG.get(e.song)?.artist));
      const tries = [s => !todays.has(s.slug) && !recentArtists.has(s.artist), s => !todays.has(s.slug), () => true];
      let cands = [];
      for (const t of tries) { cands = window.filter(t); if (cands.length) break; }
      // Weighted draw: the longer a song has waited, the likelier it is (squared), so none straggles.
      const w = cands.map(s => (c - lastUsed(s)) ** 2), total = w.reduce((x, y) => x + y, 0);
      let r = rng() * total, k = 0;
      while (k < cands.length - 1 && (r -= w[k]) >= 0) k++;
      const song = cands[k];

      const L = E.lineupsFor(f), [lo, hi] = E.bandRange(f, band);
      const recent = new Set(st.lineups.slice(-14));
      let opts = []; for (let i = lo; i < hi; i++) if (!recent.has(lineupKey(L[i].cols.map(x => x.id)))) opts.push(i);
      if (!opts.length) for (let i = lo; i < hi; i++) opts.push(i);
      const lineup = L[opts[Math.floor(rng() * opts.length)]];
      entry = { case: c, date: dateOfDay(day), song: song.slug, clues: lineup.cols.map(x => x.id), band };
      made++;
    }
    out[f].push(entry);
    todays.add(entry.song);
    st.lastUsed.set(entry.song, c);
    st.lineups.push(lineupKey(entry.clues));
  }
}

// ---------- Write ----------
const lines = ["{",
  `  "_note": "Generated by tools/schedule.mjs. Don't hand-edit; past cases, today and tomorrow are kept as they are on every run.",`,
  `  "generated": ${JSON.stringify(new Date().toISOString())},`,
  FILTERS.map(f => `  "${f}": [\n` + out[f].map(e => "    " + JSON.stringify(e)).join(",\n") + "\n  ]").join(",\n"),
  "}", ""];
fs.writeFileSync(schedFile, lines.join("\n"));

// ---------- Report ----------
warnings.forEach(w => console.warn("warn:", w));
console.log(`Today is case #${todayCase} (${dateOfDay(today)} KST). Kept cases 1–${Math.min(lockThrough, lastCase)} unchanged; ${made} entries generated through case #${endCase} (${dateOfDay(dayOfCase(endCase))}).`);
for (const f of FILTERS) {
  const pool = E.POOLS[f], upcoming = out[f].filter(e => e.case >= todayCase);
  const firstAt = new Map(); upcoming.forEach(e => { if (!firstAt.has(e.song)) firstAt.set(e.song, e.case); });
  const last = new Map(); let minGap = Infinity, maxGap = 0;
  out[f].forEach(e => { if (last.has(e.song)) { const g = e.case - last.get(e.song); minGap = Math.min(minGap, g); maxGap = Math.max(maxGap, g); } last.set(e.song, e.case); });
  const missing = pool.filter(s => !firstAt.has(s.slug)).map(s => s.slug);
  const cycle = Math.max(...firstAt.values()) - Math.max(todayCase, 1) + 1;
  console.log(`  ${f.padEnd(4)} ${String(pool.length).padStart(3)} songs · all appear within ${cycle} days${missing.length ? ` (never: ${missing.join(", ")})` : ""} · repeat gap ${minGap === Infinity ? "n/a" : `${minGap}–${maxGap} days`}`);
}
const t = out.all.find(e => e.case === Math.max(todayCase, 1));
if (t) console.log(`  today (all): ${E.BY_SLUG.get(t.song).title} · ${t.clues.join(", ")} · ${DIFF_NAMES[t.band]}`);
