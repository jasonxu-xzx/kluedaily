// Data checks for site/data/songs.json + artists.json, run by tools/schedule.mjs (and so by `npm run schedule`
// and `npm run check`). Errors block: the game would show a wrong clue or crash. Warnings are likely typos to look at.
import { GENRES, TITLE_LANGS } from "../site/assets/engine.js";

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const isInt = v => Number.isInteger(v);
const key = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
// Label comparison ignores company words, so "SM" / "SM Ent." / "SM Entertainment" are seen as the same name.
const coreKey = s => String(s).toLowerCase().replace(/\b(entertainment|ent|music|inc|co|corp|company|records|label)\b\.?/g, "").replace(/[^a-z0-9]/g, "");
// Different spellings that are deliberate (label AT RELEASE: the company renamed itself).
const KNOWN_DISTINCT = [["Big Hit Ent.", "BIGHIT MUSIC"]];
const slug = s => String(s).toLowerCase().normalize("NFKD").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Small edit distance, used to spot label/artist typos ("Starhsip" vs "Starship").
function close(a, b) {
  if (a === b) return false;
  if (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a))) return true;   // "sm" vs "sment" is too short to judge
  if (Math.abs(a.length - b.length) > 2 || Math.min(a.length, b.length) < 5) return false;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] <= 2;
}

export function validateData(artists, songs, { thisYear = new Date().getUTCFullYear() } = {}) {
  const errors = [], warnings = [];
  const E = (m) => errors.push(m), W = (m) => warnings.push(m);

  // ---------- Artists ----------
  for (const [k, a] of Object.entries(artists)) {
    const at = `artist "${k}"`;
    if (!ID_RE.test(k)) E(`${at}: key must be lowercase letters/digits/hyphens`);
    if (!a.name || typeof a.name !== "string") E(`${at}: missing name`);
    if (!["F", "M", "X"].includes(a.gender)) E(`${at}: gender must be F, M or X (got ${JSON.stringify(a.gender)})`);
    if (!isInt(a.debut) || a.debut < 1990 || a.debut > thisYear + 1) E(`${at}: debut must be a year (got ${JSON.stringify(a.debut)})`);
    // parent: an artist key (solo member -> group), or a shared family key that isn't an artist itself
    // (NCT 127 + NCT DREAM both use "nct"). A non-artist parent used by only one artist is probably a typo.
    if (a.parent !== undefined && !artists[a.parent] && Object.values(artists).filter(x => x.parent === a.parent).length < 2)
      E(`${at}: parent "${a.parent}" is not an artist and no other artist shares it (typo?)`);
    if (a.parent === k) E(`${at}: can't be its own parent`);
    if (a.aliases !== undefined && (!Array.isArray(a.aliases) || a.aliases.some(x => typeof x !== "string"))) E(`${at}: aliases must be a list of strings`);
  }
  const names = Object.entries(artists).map(([k, a]) => [k, key(a.name || "")]);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    if (names[i][1] === names[j][1]) E(`artists "${names[i][0]}" and "${names[j][0]}" have the same name`);
    else if (close(names[i][1], names[j][1])) W(`artist names look alike: "${artists[names[i][0]].name}" / "${artists[names[j][0]].name}" (typo?)`);
  }

  // ---------- Songs ----------
  const ids = new Set(), titles = new Map(), labels = new Map(), families = new Map();
  songs.forEach((s, i) => {
    const at = `song ${i + 1} "${s.title || s.id}"`;
    if (!s.id || !ID_RE.test(s.id)) E(`${at}: id must be lowercase letters/digits/hyphens (got ${JSON.stringify(s.id)})`);
    else if (ids.has(s.id)) E(`${at}: duplicate id "${s.id}" (for same-title songs use "${slug(s.title)}-<artist key>")`);
    ids.add(s.id);
    if (!s.title || typeof s.title !== "string" || !/[A-Za-z0-9]/.test(s.title)) E(`${at}: title needs at least one Latin letter or digit (first/last letter clues)`);
    const a = artists[s.artist];
    if (!a) E(`${at}: unknown artist "${s.artist}" (add it to artists.json)`);
    if (!isInt(s.year) || s.year < 1990 || s.year > thisYear + 1) E(`${at}: year must be a release year (got ${JSON.stringify(s.year)})`);
    else if (a && isInt(a.debut) && s.year < a.debut) E(`${at}: released ${s.year}, before ${a.name}'s debut (${a.debut}); check year or debut`);
    if (!isInt(s.month) || s.month < 1 || s.month > 12) E(`${at}: month must be 1-12 (got ${JSON.stringify(s.month)})`);
    if (!isInt(s.seconds) || s.seconds < 60 || s.seconds > 600) E(`${at}: seconds must be the length in seconds, 60-600 (got ${JSON.stringify(s.seconds)})`);
    if (!isInt(s.viewTier) || s.viewTier < 0 || s.viewTier > 6) E(`${at}: viewTier must be 0-6 (got ${JSON.stringify(s.viewTier)})`);
    if (!GENRES.includes(s.genre)) E(`${at}: genre must be one of ${GENRES.join(", ")} (got ${JSON.stringify(s.genre)})`);
    if (!TITLE_LANGS.includes(s.titleLang)) E(`${at}: titleLang must be ${TITLE_LANGS.join(", ")} (got ${JSON.stringify(s.titleLang)})`);
    if (!s.label || typeof s.label !== "string") E(`${at}: missing label`);
    if (s.labelFamily !== null && typeof s.labelFamily !== "string") E(`${at}: labelFamily must be a name or null`);
    if (!Array.isArray(s.aliases) || s.aliases.some(x => typeof x !== "string")) E(`${at}: aliases must be a list of strings`);
    if (s.guessOnly !== undefined && typeof s.guessOnly !== "boolean") E(`${at}: guessOnly must be true or false`);
    const t = key(s.title || "");
    if (titles.has(t)) W(`same title as ${titles.get(t)}: ${at}. OK if they're different songs; players tell them apart by artist`);
    else titles.set(t, at);
    if (s.label) { const k = coreKey(s.label); if (!labels.has(k)) labels.set(k, new Set()); labels.get(k).add(s.label); }
    if (s.labelFamily) { const k = coreKey(s.labelFamily); if (!families.has(k)) families.set(k, new Set()); families.get(k).add(s.labelFamily); }
  });
  // The label clue compares exact text, so "SM" and "SM Ent." would never match: catch spelling variants.
  const known = v => KNOWN_DISTINCT.some(pair => v.length === pair.length && pair.every(p => v.includes(p)));
  for (const [what, map] of [["label", labels], ["labelFamily", families]]) {
    for (const v of map.values()) if (v.size > 1 && !known([...v])) E(`${what} written ${v.size} ways: ${[...v].map(x => `"${x}"`).join(", ")}; pick one spelling (or add to KNOWN_DISTINCT in tools/validate.mjs if the company renamed)`);
    const ks = [...map.keys()];
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++)
      if (close(ks[i], ks[j])) W(`${what} names look alike: "${[...map.get(ks[i])][0]}" / "${[...map.get(ks[j])][0]}" (same company? if so, use one spelling)`);
  }
  return { errors, warnings };
}

// Answer-pool sizes per filter, for the report (small pools repeat answers sooner).
export function poolReport(E) {
  return Object.keys(E.POOLS).map(f => `${f}: ${E.ANSWERS[f].length} answers / ${E.POOLS[f].length} guessable`).join(" · ");
}
