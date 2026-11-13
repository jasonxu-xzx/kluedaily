// Shared game logic: used by the browser (assets/game.js) and by tools/schedule.mjs.
// No DOM access in this file.

export const MAX_GUESSES = 8;
export const ROTATING = 4;
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
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SEASONS = ["Winter", "Spring", "Summer", "Fall"];
const LANG = { EN: "English", KR: "Korean", MIX: "Mixed" };
const GENRE_NEAR = { "Dance-pop": ["EDM", "Latin", "Rock/Band"], "EDM": ["Dance-pop"], "Latin": ["Dance-pop"],
  "Rock/Band": ["Dance-pop"], "Hip-hop": ["R&B"], "R&B": ["Hip-hop"] };
const CLASH = [["month", "season"]];   // never show both on one day

export const norm = s => s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "");
const alnum = t => t.replace(/[^A-Za-z0-9]/g, "");

export function createEngine(ARTISTS, rawSongs) {
  // ---------- Songs ----------
  const seen = new Set();
  const SONGS = rawSongs.map((r, i) => {
    if (!r.id) throw new Error(`Song "${r.title}" has no id`);
    if (seen.has(r.id)) throw new Error(`Duplicate song id "${r.id}"`);
    seen.add(r.id);
    const a = ARTISTS[r.artist];
    if (!a) throw new Error(`Song "${r.title}" has unknown artist "${r.artist}"`);
    const s = { id: i, slug: r.id, title: r.title, artist: r.artist, year: r.year, month: r.month,
      company: r.label, family: r.labelFamily, sec: r.seconds, tier: r.viewTier, genre: r.genre, lang: r.titleLang, aliases: r.aliases || [] };
    s.keys = [s.title, ...s.aliases].map(norm);
    s.artistKeys = [a.name, ...(a.aliases || [])].map(norm);
    s.letters = alnum(s.title).length;
    s.words = s.title.trim().split(/\s+/).length;
    s.first = alnum(s.title)[0].toUpperCase();
    s.last = alnum(s.title).slice(-1).toUpperCase();
    s.season = Math.floor((s.month % 12) / 3);   // Dec–Feb 0, Mar–May 1, Jun–Aug 2, Sep–Nov 3
    s.stage = s.year - a.debut;
    return s;
  });
  const BY_SLUG = new Map(SONGS.map(s => [s.slug, s]));

  // ---------- Clue columns ----------
  const num = (gv, av, near) => gv === av ? { st: "hit" } : { st: Math.abs(gv - av) <= near ? "near" : "off", ar: av > gv ? "↑" : "↓" };
  const letter = (g, a) => g === a ? { st: "hit" } : { st: Math.abs(g.charCodeAt(0) - a.charCodeAt(0)) <= 2 ? "near" : "off", ar: a > g ? "→" : "←" };
  const related = (a, b) => { if (a === b) return false; const A = ARTISTS[a], B = ARTISTS[b]; return A.parent === b || B.parent === a || (!!A.parent && A.parent === B.parent); };

  const ARTIST_COL = { id: "artist", icon: "🎤", name: "Artist", rule: "Close = related act (solo member, sister unit)",
    show: s => ARTISTS[s.artist].name, cmp: (g, a) => ({ st: g.artist === a.artist ? "hit" : related(g.artist, a.artist) ? "near" : "off" }) };
  const COLS = [
    { id: "year", icon: "📅", name: "Release year", rule: "Close = within 1 year", show: s => s.year, cmp: (g, a) => num(g.year, a.year, 1) },
    { id: "month", icon: "🗓️", name: "Release month", rule: "Close = 1 month apart", show: s => MONTHS[s.month - 1],
      cmp: (g, a) => { if (g.month === a.month) return { st: "hit" }; const d = Math.abs(g.month - a.month); return { st: d === 1 || d === 11 ? "near" : "off", ar: a.month > g.month ? "↑" : "↓" }; } },
    { id: "season", icon: "🍂", name: "Release season", rule: "Close = neighboring season", show: s => SEASONS[s.season],
      cmp: (g, a) => g.season === a.season ? { st: "hit" } : { st: (g.season - a.season + 4) % 4 === 2 ? "off" : "near" } },
    { id: "views", icon: "👁️", name: "MV views", rule: "Tiers · close = next tier", show: s => TIERS[s.tier],
      cmp: (g, a) => g.tier === a.tier ? { st: "hit" } : (g.tier === 0 || a.tier === 0) ? { st: "off" } : { st: Math.abs(g.tier - a.tier) === 1 ? "near" : "off", ar: a.tier > g.tier ? "↑" : "↓" } },
    { id: "length", icon: "⏱️", name: "Song length", rule: "Close = within 10 seconds", show: s => `${Math.floor(s.sec / 60)}:${String(s.sec % 60).padStart(2, "0")}`, cmp: (g, a) => num(g.sec, a.sec, 10) },
    { id: "genre", icon: "🎛️", name: "Genre", rule: "Close = neighboring genre", show: s => s.genre,
      cmp: (g, a) => ({ st: g.genre === a.genre ? "hit" : (GENRE_NEAR[g.genre] || []).includes(a.genre) ? "near" : "off" }) },
    { id: "label", icon: "🏢", name: "Label", rule: "At release · close = same parent family", show: s => s.company,
      cmp: (g, a) => ({ st: g.company === a.company ? "hit" : (g.family && g.family === a.family) ? "near" : "off" }) },
    { id: "letters", icon: "🔢", name: "Title letters", rule: "Letters + digits, no spaces · close = ±1", show: s => s.letters, cmp: (g, a) => num(g.letters, a.letters, 1) },
    { id: "words", icon: "📝", name: "Title words", rule: "Close = ±1 word", show: s => s.words, cmp: (g, a) => num(g.words, a.words, 1) },
    { id: "first", icon: "🔤", name: "First letter", rule: "Close = within 2 letters", show: s => s.first, cmp: (g, a) => letter(g.first, a.first) },
    { id: "last", icon: "🔚", name: "Last letter", rule: "Close = within 2 letters", show: s => s.last, cmp: (g, a) => letter(g.last, a.last) },
    { id: "lang", icon: "🌐", name: "Title language", rule: "Original title · close = one side mixed", show: s => LANG[s.lang],
      cmp: (g, a) => ({ st: g.lang === a.lang ? "hit" : (g.lang === "MIX" || a.lang === "MIX") ? "near" : "off" }) },
    { id: "stage", icon: "🪜", name: "Career stage", rule: "Years since debut · close = ±1", show: s => s.stage === 0 ? "Debut yr" : `Yr ${s.stage}`, cmp: (g, a) => num(g.stage, a.stage, 1) },
  ];
  const COL_BY_ID = new Map(COLS.map(c => [c.id, c]));

  // ---------- Song pools (F girl, M boy, X co-ed = both) ----------
  const POOLS = {
    all: SONGS,
    girl: SONGS.filter(x => ARTISTS[x.artist].gender !== "M"),
    boy: SONGS.filter(x => ARTISTS[x.artist].gender !== "F"),
  };

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
  function lineupsFor(filter) {
    if (lineupCache[filter]) return lineupCache[filter];
    const pool = POOLS[filter], out = [], m = COLS.length;
    const combo = (start, picked) => {
      if (picked.length === ROTATING) {
        const ids = picked.map(i => COLS[i].id);
        if (CLASH.some(([x, y]) => ids.includes(x) && ids.includes(y))) return;
        out.push({ cols: picked.map(i => COLS[i]), score: lineupScore(pool, picked.map(i => i + 1)) });
        return;
      }
      for (let i = start; i < m; i++) combo(i + 1, [...picked, i]);
    };
    combo(0, []);
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
    const pool = POOLS[filter], k = day - LAUNCH_DAY, r = mulberry32(hashStr(`${filter}:${k}`));
    const band = bandOfDay(day);
    return { answer: pool[Math.floor(r() * pool.length)], lineup: pickLineup(filter, band, mulberry32(SEEDS[filter] + k)), band, scheduled: false };
  }
  function entryToPuzzle(entry) {
    const answer = BY_SLUG.get(entry.song), cols = (entry.clues || []).map(id => COL_BY_ID.get(id));
    if (!answer || cols.length !== ROTATING || cols.some(c => !c) || !(entry.band >= 0 && entry.band <= 6)) return null;
    return { answer, lineup: { cols }, band: entry.band, scheduled: true };
  }
  function dailyPuzzle(schedule, filter, day) {
    const c = caseOfDay(day), entry = schedule && schedule[filter] && schedule[filter][c - 1];
    const puz = entry && entry.case === c ? entryToPuzzle(entry) : null;
    return puz || fallbackPuzzle(filter, day);
  }

  return { ARTISTS, SONGS, BY_SLUG, ARTIST_COL, COLS, COL_BY_ID, POOLS, lineupsFor, bandRange, pickLineup, dailyPuzzle, entryToPuzzle };
}
