// Shared game logic: used by the browser (assets/game.js) and by tools/schedule.mjs.
// No DOM access in this file.

export const MAX_GUESSES = 8;
export const FAN_PICK = 2, STAT_PICK = 2;   // daily lineup: Artist + 2 fan clues + 2 stat clues
export const ROTATING = FAN_PICK + STAT_PICK;
export const FILTERS = ["all", "girl", "boy"];
export const DIFF_NAMES = ["Easy", "Easy", "Medium", "Medium", "Tricky", "Hard", "Hard"];

// ---------- Calendar (midnight KST) ----------
export const DAY = 86400000, KST = 9 * 3600000;
export const LAUNCH_DAY = Date.UTC(2026, 10, 20) / DAY;           // Case #1 = 2026-11-20 KST
export const kstDay = (ms = Date.now()) => Math.floor((ms + KST) / DAY);
// The game's current day. Before launch it stays on launch day, so Case #1 is playable early
// and the first refresh happens at midnight KST going into Nov 21 (Case #2).
export const gameDay = (ms = Date.now()) => Math.max(kstDay(ms), LAUNCH_DAY);
export const caseOfDay = d => d - LAUNCH_DAY + 1;
export const dayOfCase = c => c + LAUNCH_DAY - 1;
export const dateOfDay = d => new Date(d * DAY).toISOString().slice(0, 10);
export const bandOfDay = d => (new Date(d * DAY).getUTCDay() + 6) % 7;   // KST weekday: Mon 0 … Sun 6
export const caseNo = () => caseOfDay(gameDay());

export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function hashStr(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const TIERS = ["No MV", "<10M", "10–50M", "50–100M", "100–300M", "300M–1B", "1B+"];
const WIN_TIERS = ["0", "1–4", "5–9", "10+"];
const winTier = n => n === 0 ? 0 : n < 5 ? 1 : n < 10 ? 2 : 3;
const GAP_TIERS = ["Debut", "<3 months", "3–6 months", "6–12 months", "1 year+"];
const gapTier = s => s.comeback === 1 ? 0 : s.gapMonths < 3 ? 1 : s.gapMonths < 6 ? 2 : s.gapMonths < 12 ? 3 : 4;
// Cover colors: 7 hues on a wheel (neighbors are "close"), plus Black and White, which are only ever exact.
export const COVER_WHEEL = ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Pink"];
export const COVERS = [...COVER_WHEEL, "Black", "White"];
export const COVER_HEX = { Red: "#E8343A", Orange: "#FF8A2A", Yellow: "#FFD23F", Green: "#2DB36A", Blue: "#2F6BFF",
  Purple: "#8E4FD8", Pink: "#FF7EC0", Black: "#1B1B1F", White: "#FFFFFF" };
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
// Still stored in songs.json (and validated), but no longer clue columns.
export const GENRES = ["Dance-pop", "EDM", "Hip-hop", "R&B", "Rock/Band", "Latin"];
export const TITLE_LANGS = ["EN", "KR", "MIX"];

export const norm = s => s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "");
const alnum = t => t.replace(/[^A-Za-z0-9]/g, "");

// opts.lineups: precomputed ranked clue sets ({ all: ["year,month,genre,lang", ...], girl, boy }, easiest first, written
// to site/data/lineups.json by tools/schedule.mjs). With it, the browser never runs the slow difficulty scoring.
export function createEngine(ARTISTS, rawSongs, opts = {}) {
  // ---------- Songs ----------
  const seen = new Set();
  const SONGS = rawSongs.map((r, i) => {
    if (!r.id) throw new Error(`Song "${r.title}" has no id`);
    if (seen.has(r.id)) throw new Error(`Duplicate song id "${r.id}"`);
    seen.add(r.id);
    const a = ARTISTS[r.artist];
    if (!a) throw new Error(`Song "${r.title}" has unknown artist "${r.artist}"`);
    const s = { id: i, slug: r.id, title: r.title, artist: r.artist, year: r.year, month: r.month,
      company: r.label, family: r.labelFamily, sec: r.seconds, tier: r.viewTier, aliases: r.aliases || [],
      members: r.members, wins: r.wins, cover: r.cover, comeback: r.comeback, gapMonths: r.gapMonths,
      guessOnly: !!r.guessOnly };   // guessOnly: can be guessed, never chosen as an answer
    s.keys = [s.title, ...s.aliases].map(norm);
    s.artistKeys = [a.name, ...(a.aliases || [])].map(norm);
    s.letters = alnum(s.title).length;
    s.first = alnum(s.title)[0].toUpperCase();
    s.winTier = winTier(s.wins);
    s.gapTier = gapTier(s);
    return s;
  });
  const BY_SLUG = new Map(SONGS.map(s => [s.slug, s]));

  // ---------- Clue columns ----------
  const num = (gv, av, near) => gv === av ? { st: "hit" } : { st: Math.abs(gv - av) <= near ? "near" : "off", ar: av > gv ? "↑" : "↓" };
  const letter = (g, a) => g === a ? { st: "hit" } : { st: Math.abs(g.charCodeAt(0) - a.charCodeAt(0)) <= 2 ? "near" : "off", ar: a > g ? "→" : "←" };
  const related = (a, b) => { if (a === b) return false; const A = ARTISTS[a], B = ARTISTS[b]; return A.parent === b || B.parent === a || (!!A.parent && A.parent === B.parent); };

  const ARTIST_COL = { id: "artist", icon: "🎤", name: "Artist", rule: "Close = related act (solo member, sister unit)",
    show: s => ARTISTS[s.artist].name, cmp: (g, a) => ({ st: g.artist === a.artist ? "hit" : related(g.artist, a.artist) ? "near" : "off" }) };
  // A tier scale where tier 0 ("No MV", "Debut") stands apart: it is never close to anything.
  const tiered = (gv, av, apart0) => gv === av ? { st: "hit" } : (apart0 && (gv === 0 || av === 0)) ? { st: "off" }
    : { st: Math.abs(gv - av) === 1 ? "near" : "off", ar: av > gv ? "↑" : "↓" };
  const wheel = c => COVER_WHEEL.indexOf(c);
  // kind "fan": what a fan would know about the release · kind "stat": facts about the song itself
  const COLS = [
    { id: "members", kind: "fan", icon: "👥", name: "Members", rule: "At release · close = ±1", show: s => s.members, cmp: (g, a) => num(g.members, a.members, 1) },
    { id: "wins", kind: "fan", icon: "🏆", name: "Music show wins", rule: "First places · 0 / 1–4 / 5–9 / 10+ · close = next tier",
      show: s => WIN_TIERS[s.winTier], cmp: (g, a) => tiered(g.winTier, a.winTier, false) },
    { id: "cover", kind: "fan", icon: "🎨", name: "Cover color", rule: "Main color of the release cover · close = neighboring color", show: s => s.cover,
      cmp: (g, a) => { if (g.cover === a.cover) return { st: "hit" }; const i = wheel(g.cover), j = wheel(a.cover);
        return { st: i >= 0 && j >= 0 && [1, COVER_WHEEL.length - 1].includes((i - j + COVER_WHEEL.length) % COVER_WHEEL.length) ? "near" : "off" }; } },
    { id: "views", kind: "fan", icon: "👁️", name: "MV views", rule: "Tiers · close = next tier", show: s => TIERS[s.tier], cmp: (g, a) => tiered(g.tier, a.tier, true) },
    { id: "label", kind: "fan", icon: "🏢", name: "Label", rule: "At release · close = same parent company", show: s => s.company,
      cmp: (g, a) => ({ st: g.company === a.company ? "hit" : (g.family && g.family === a.family) ? "near" : "off" }) },
    { id: "comeback", kind: "fan", icon: "🔁", name: "Comeback no.", rule: "Nth comeback, debut = 1st (an album and its pre-release singles count once) · close = ±1", show: s => ordinal(s.comeback), cmp: (g, a) => num(g.comeback, a.comeback, 1) },
    { id: "gap", kind: "fan", icon: "⏳", name: "Comeback gap", rule: "Time since the previous release · close = next tier", show: s => GAP_TIERS[s.gapTier], cmp: (g, a) => tiered(g.gapTier, a.gapTier, true) },
    { id: "year", kind: "stat", icon: "📅", name: "Release year", rule: "Close = within 1 year", show: s => s.year, cmp: (g, a) => num(g.year, a.year, 1) },
    { id: "first", kind: "stat", icon: "🔤", name: "First letter", rule: "Close = within 2 letters", show: s => s.first, cmp: (g, a) => letter(g.first, a.first) },
    { id: "letters", kind: "stat", icon: "🔢", name: "Title letters", rule: "Letters + digits, no spaces · close = ±1", show: s => s.letters, cmp: (g, a) => num(g.letters, a.letters, 1) },
    { id: "length", kind: "stat", icon: "⏱️", name: "Song length", rule: "Close = within 10 seconds", show: s => `${Math.floor(s.sec / 60)}:${String(s.sec % 60).padStart(2, "0")}`, cmp: (g, a) => num(g.sec, a.sec, 10) },
  ];
  const COL_BY_ID = new Map(COLS.map(c => [c.id, c]));
  const validLineup = cols => cols.length === ROTATING && cols.every(Boolean)
    && cols.filter(c => c.kind === "fan").length === FAN_PICK && cols.filter(c => c.kind === "stat").length === STAT_PICK;

  // ---------- Song pools (F girl, M boy, X co-ed = both) ----------
  const POOLS = {
    all: SONGS,
    girl: SONGS.filter(x => ARTISTS[x.artist].gender !== "M"),
    boy: SONGS.filter(x => ARTISTS[x.artist].gender !== "F"),
  };
  // Answer pools: songs that can be a daily or practice answer (everything not marked guessOnly).
  // Guessing and difficulty scoring still use the full POOLS: players don't know which songs are answer-only.
  const ANSWERS = Object.fromEntries(Object.entries(POOLS).map(([f, p]) => [f, p.filter(s => !s.guessOnly)]));

  // ---------- Difficulty: how fast does a lineup narrow the pool? ----------
  // Score = average number of songs giving the same feedback as the answer after one guess.
  // Lower = guesses split the pool faster = easier. Computed lazily (only practice mode / fallback / the schedule tool need it).
  const ALL_COLS = [ARTIST_COL, ...COLS];
  const AR_CODE = { undefined: 0, "↑": 1, "↓": 2, "←": 3, "→": 4 }, ST_CODE = { hit: 0, near: 1, off: 2 };
  let FB = null;
  const feedback = () => FB || (FB = ALL_COLS.map(c => SONGS.map(g => SONGS.map(a => { const r = c.cmp(g, a); return ST_CODE[r.st] * 5 + AR_CODE[r.ar]; }))));
  function lineupScore(pool, colIdx) {
    const F = feedback(), idx = [0, ...colIdx], n = pool.length;
    let total = 0;
    for (const g of pool) {
      const groups = new Map();
      for (const a of pool) {
        let key = 0;
        for (const c of idx) key = key * 15 + F[c][g.id][a.id];
        groups.set(key, (groups.get(key) || 0) + 1);
      }
      for (const c of groups.values()) total += c * c;
    }
    return total / (n * n);
  }
  const lineupCache = {};
  function precomputed(filter) {
    const list = opts.lineups && opts.lineups[filter];
    if (!Array.isArray(list) || !list.length) return null;
    const out = list.map(str => ({ cols: String(str).split(",").map(id => COL_BY_ID.get(id)) }));
    if (out.some(l => !validLineup(l.cols))) { console.warn("lineups.json doesn't match the clue columns; scoring in the browser instead"); return null; }
    return out;
  }
  // Every lineup = FAN_PICK of the fan columns + STAT_PICK of the stat columns (column indices into COLS).
  const choose = (items, k, start = 0, picked = [], out = []) => {
    if (picked.length === k) { out.push(picked); return out; }
    for (let i = start; i < items.length; i++) choose(items, k, i + 1, [...picked, items[i]], out);
    return out;
  };
  function lineupsFor(filter) {
    if (lineupCache[filter]) return lineupCache[filter];
    const pre = precomputed(filter);
    if (pre) return (lineupCache[filter] = pre);
    const pool = POOLS[filter], out = [], idx = kind => COLS.map((c, i) => c.kind === kind ? i : -1).filter(i => i >= 0);
    for (const fan of choose(idx("fan"), FAN_PICK)) for (const stat of choose(idx("stat"), STAT_PICK)) {
      const picked = [...fan, ...stat];
      out.push({ cols: picked.map(i => COLS[i]), score: lineupScore(pool, picked.map(i => i + 1)) });
    }
    out.sort((a, b) => a.score - b.score);
    // Drop the hardest 15% entirely; Sunday is hard, not impossible.
    return (lineupCache[filter] = out.slice(0, Math.ceil(out.length * 0.85)));
  }
  function bandRange(filter, band) {
    const L = lineupsFor(filter);
    return [Math.floor(L.length * band / 7), Math.floor(L.length * (band + 1) / 7)];
  }
  function pickLineup(filter, band, r) {
    const L = lineupsFor(filter), [lo, hi] = bandRange(filter, band);
    return L[lo + Math.floor(r() * (hi - lo))];
  }

  // ---------- Daily puzzle ----------
  // The schedule (data/schedule.json, built by tools/schedule.mjs) is the source of truth.
  // The fallback only runs if a day is missing from it, so the game never breaks.
  const SEEDS = { all: 2027, girl: 3031, boy: 4049 };
  function fallbackPuzzle(filter, day) {
    const pool = ANSWERS[filter].length ? ANSWERS[filter] : POOLS[filter], k = day - LAUNCH_DAY, r = mulberry32(hashStr(`${filter}:${k}`));
    const band = bandOfDay(day);
    return { answer: pool[Math.floor(r() * pool.length)], lineup: pickLineup(filter, band, mulberry32(SEEDS[filter] + k)), band, scheduled: false };
  }
  function entryToPuzzle(entry) {
    const answer = BY_SLUG.get(entry.song), cols = (entry.clues || []).map(id => COL_BY_ID.get(id));
    if (!answer || !validLineup(cols) || !(entry.band >= 0 && entry.band <= 6)) return null;
    return { answer, lineup: { cols }, band: entry.band, scheduled: true };
  }
  function dailyPuzzle(schedule, filter, day) {
    const c = caseOfDay(day), entry = schedule && schedule[filter] && schedule[filter][c - 1];
    const puz = entry && entry.case === c ? entryToPuzzle(entry) : null;
    return puz || fallbackPuzzle(filter, day);
  }

  const lineupIds = filter => lineupsFor(filter).map(l => l.cols.map(c => c.id).join(","));   // for writing lineups.json
  return { ARTISTS, SONGS, BY_SLUG, ARTIST_COL, COLS, COL_BY_ID, POOLS, ANSWERS, lineupsFor, lineupIds, bandRange, pickLineup, dailyPuzzle, entryToPuzzle };
}
