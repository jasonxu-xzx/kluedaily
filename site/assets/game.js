import { createEngine, MAX_GUESSES as MAX, DIFF_NAMES, DAY, KST, gameDay, caseNo } from "./engine.js";

const CFG = window.CD_CONFIG || {};
const track = (e, p) => { try { window.cdTrack && window.cdTrack(e, p); } catch {} };
const $ = id => document.getElementById(id);

// ---------- Data ----------
const get = u => fetch(u, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
let E, SCHEDULE = null;
try {
  const [artists, songs, schedule] = await Promise.all([
    get("data/artists.json"), get("data/songs.json"),
    get("data/schedule.json").catch(err => { console.warn("No schedule, using fallback picks:", err); return null; }),
  ]);
  E = createEngine(artists, songs);
  SCHEDULE = schedule;
} catch (err) {
  $("loading").textContent = "Couldn't load today's case. Check your connection and refresh.";
  console.error(err);
  throw err;
}
$("loading").remove();
$("game").hidden = false;

const { ARTISTS, BY_SLUG, ARTIST_COL, POOLS } = E;

function dailyPuzzleFor(filter) {
  const puz = E.dailyPuzzle(SCHEDULE, filter, gameDay());
  if (!puz.scheduled) console.warn(`Case #${caseNo()} (${filter}) is not in schedule.json; run tools/schedule.mjs`);
  return puz;
}
function practicePuzzle(filter, prevId) {
  const pool = POOLS[filter];
  let a; do { a = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && a.id === prevId);
  const band = Math.floor(Math.random() * 7);
  return { answer: a, lineup: E.pickLineup(filter, band, Math.random), band };
}

const store = {
  get(k, d) { try { const v = localStorage.getItem("klue:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("klue:" + k, JSON.stringify(v)); } catch {} },
};

// ---------- State ----------
const EMOJI = { hit: "🟦", near: "🟧", off: "⬜" };   // matches the board: Sky Blue exact, Coral close
let mode = "daily", filter = "all", puz, guesses = [], over = false;
const FILTER_LABEL = { all: "", girl: " · Girl groups", boy: " · Boy groups" };
const input = $("guess"), sugg = $("sugg"), board = $("board"), endEl = $("end"), msg = $("msg");
const esc = v => String(v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const cols = () => [ARTIST_COL, ...puz.lineup.cols];
const gameProps = () => ({ mode, filter, difficulty: DIFF_NAMES[puz.band], clues: puz.lineup.cols.map(c => c.id),
  ...(mode === "daily" ? { case_number: caseNo(), scheduled: puz.scheduled } : {}) });

function startDaily() {
  mode = "daily"; puz = dailyPuzzleFor(filter);
  let saved = store.get(`day-${filter}-${gameDay()}`, null);
  if (saved && saved.answer !== puz.answer.slug) saved = null;   // the day's answer changed (schedule edit): don't replay old guesses against it
  guesses = saved ? saved.guesses.map(slug => BY_SLUG.get(slug)).filter(Boolean) : []; over = saved ? saved.over : false;
  render(false);
}
function startPractice() { mode = "practice"; puz = practicePuzzle(filter, puz && puz.answer.id); guesses = []; over = false; render(false); }

function renderLineup() {
  $("clues").innerHTML = cols().map((c, i) => `<div class="clue${i === 0 ? " fixed" : ""}"><span class="ic" aria-hidden="true">${c.icon}</span><span class="nm">${esc(c.name)}</span><span class="rule">${i === 0 ? "Always on · " : ""}${esc(c.rule)}</span></div>`).join("");
  $("lineupTitle").textContent = mode === "daily" ? "Today's clues" : "This round's clues";
  $("diff").innerHTML = `Difficulty <b>${DIFF_NAMES[puz.band]}</b>`;
}
function cardHTML(g, i) {
  const won = g.id === puz.answer.id;
  const cells = cols().map((c, j) => { const r = c.cmp(g, puz.answer);
    return `<div class="cell ${r.st}" style="animation-delay:${j * 80}ms"><span class="k">${c.icon} ${esc(c.name)}</span><span class="v">${esc(c.show(g))}</span>${r.ar ? `<span class="ar">${r.ar}</span>` : ""}</div>`; }).join("");
  return `<article class="card${won ? " won" : ""}"><div class="card-head"><div class="song">${esc(g.title)} <span>— ${esc(ARTISTS[g.artist].name)}</span></div><div class="n">${i + 1}/${MAX}</div></div><div class="cells">${cells}</div></article>`;
}
function render(animateLast) {
  $("caseline").textContent = (mode === "daily" ? `Case #${caseNo()} · resets midnight KST` : "Practice · random song + clues") + FILTER_LABEL[filter];
  document.querySelectorAll("[data-f]").forEach(b => b.setAttribute("aria-pressed", b.dataset.f === filter));
  $("modeDaily").setAttribute("aria-pressed", mode === "daily");
  $("modePractice").setAttribute("aria-pressed", mode === "practice");
  $("count").textContent = `${guesses.length} / ${MAX}`;
  renderLineup();
  board.innerHTML = guesses.length ? guesses.map(cardHTML).reverse().join("") : `<div class="empty">Read today's clues, then make an opening guess. The best first guess changes with the lineup.</div>`;
  if (animateLast && board.firstElementChild) board.firstElementChild.classList.add("reveal");
  input.disabled = over; input.value = ""; closeSugg(); msg.textContent = "";
  input.placeholder = over ? "Case closed" : "Type a song or artist — 영어 / 한글 OK";
  renderEnd();
}

const shareUrl = () => (CFG.siteUrl || (location.origin + location.pathname).replace(/index\.html$/, "")).replace(/\/?$/, "/") + "?utm_source=share&utm_medium=social";
function shareText(won) {
  const head = `${mode === "daily" ? `Klue #${caseNo()}` : "Klue (practice)"}${FILTER_LABEL[filter]} — ${won ? guesses.length : "X"}/${MAX}`;
  const icons = cols().map(c => c.icon).join("") + `  ${DIFF_NAMES[puz.band]}`;
  const rows = guesses.map(g => cols().map(c => EMOJI[c.cmp(g, puz.answer).st]).join(""));
  return [head, icons, ...rows, "", shareUrl()].join("\n");
}
function renderEnd() {
  if (!over) { endEl.hidden = true; return; }
  const won = guesses.some(g => g.id === puz.answer.id), a = puz.answer, share = shareText(won);
  let stats = "";
  if (mode === "daily") {
    const st = store.get("stats-" + filter, null) || blank();
    stats = `<div class="stats"><div><b>${st.played}</b><span>Played</span></div><div><b>${st.played ? Math.round(st.wins / st.played * 100) : 0}</b><span>Win %</span></div><div><b>${st.streak}</b><span>Streak</span></div><div><b>${st.best}</b><span>Best</span></div></div><div class="next" id="next"></div>`;
  }
  const canNative = typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches;
  endEl.innerHTML = `
    <h2>${won ? (guesses.length === 1 ? "Solved on the first guess." : `Solved in ${guesses.length}.`) : "Case unsolved."}</h2>
    <div>The answer was <b>${esc(a.title)}</b> by ${esc(ARTISTS[a.artist].name)}. ${puz.lineup.cols.map(c => `${esc(c.name)}: ${esc(c.show(a))}`).join(" · ")}</div>
    <pre class="share" id="shareText">${esc(share)}</pre>
    <div class="row-btns">${canNative ? `<button class="btn" id="nativeBtn">Share</button>` : ""}<button class="btn${canNative ? " ghost" : ""}" id="copyBtn">Copy result</button><button class="btn ghost" id="againBtn">${mode === "practice" ? "New practice round" : "Play practice"}</button></div>
    ${stats}`;
  endEl.hidden = false;
  $("copyBtn").onclick = () => { track("share_clicked", { ...gameProps(), won, method: "copy" }); copy(share); };
  if (canNative) $("nativeBtn").onclick = () => { track("share_clicked", { ...gameProps(), won, method: "native" }); navigator.share({ text: share }).catch(() => {}); };
  $("againBtn").onclick = () => { track("mode_changed", { from: mode, to: "practice", filter, source: "end_panel" }); startPractice(); };
  tick();
}
function copy(text) {
  const b = $("copyBtn");
  const fallback = () => { const r = document.createRange(); r.selectNodeContents($("shareText")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "Selected, press copy"; };
  try { navigator.clipboard.writeText(text).then(() => { b.textContent = "Copied"; setTimeout(() => { if ($("copyBtn")) $("copyBtn").textContent = "Copy result"; }, 1500); }, fallback); } catch { fallback(); }
}
function tick() {
  const el = $("next"); if (!el) return;
  const ms = (gameDay() + 1) * DAY - KST - Date.now();
  const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
  el.textContent = `Next case in ${d ? `${d}d ` : ""}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;   // before launch this runs to Nov 21
}
let lastDay = gameDay();
setInterval(() => { tick(); if (gameDay() !== lastDay) { lastDay = gameDay(); if (mode === "daily") startDaily(); } }, 1000);

function blank() { return { played: 0, wins: 0, streak: 0, best: 0, lastDay: null, lastWinDay: null }; }
function recordDaily(won) {
  const st = store.get("stats-" + filter, null) || blank(), d = gameDay();
  if (st.lastDay === d) return;
  st.played++; st.lastDay = d;
  if (won) { st.wins++; st.streak = st.lastWinDay === d - 1 ? st.streak + 1 : 1; st.lastWinDay = d; st.best = Math.max(st.best, st.streak); } else st.streak = 0;
  store.set("stats-" + filter, st);
}

function submit(song) {
  if (over || !song) return;
  if (guesses.some(g => g.id === song.id)) { msg.textContent = "You already guessed that song."; return; }
  guesses.push(song);
  const won = song.id === puz.answer.id;
  over = won || guesses.length >= MAX;
  if (guesses.length === 1) track("game_started", gameProps());
  track("guess_made", { ...gameProps(), guess_number: guesses.length, correct: won });
  if (mode === "daily") { store.set(`day-${filter}-${gameDay()}`, { answer: puz.answer.slug, guesses: guesses.map(g => g.slug), over }); if (over) recordDaily(won); }
  if (over) track("game_completed", { ...gameProps(), won, guesses: guesses.length });
  render(true);
  if (!over) input.focus();
}

// ---------- Autocomplete ----------
let matches = [], sel = -1;
const norm = s => s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "");
function search(q) {
  const n = norm(q); if (!n) return [];
  const used = new Set(guesses.map(g => g.id)), scored = [];
  for (const s of POOLS[filter]) {
    if (used.has(s.id)) continue;
    let sc = -1;
    if (s.keys.some(k => k.startsWith(n))) sc = 3; else if (s.keys.some(k => k.includes(n))) sc = 2;
    else if (s.artistKeys.some(k => k.startsWith(n))) sc = 1; else if (n.length >= 3 && s.artistKeys.some(k => k.includes(n))) sc = .5;
    if (sc >= 0) scored.push([sc, s]);
  }
  return scored.sort((a, b) => b[0] - a[0] || a[1].title.localeCompare(b[1].title)).slice(0, 8).map(x => x[1]);
}
function showSugg() {
  matches = search(input.value); sel = matches.length ? 0 : -1;
  if (!input.value.trim()) return closeSugg();
  sugg.innerHTML = matches.length ? matches.map((s, i) => `<li role="option" id="opt${i}" data-i="${i}" aria-selected="${i === sel}"><span class="t">${esc(s.title)}</span><span class="a">${esc(ARTISTS[s.artist].name)}</span></li>`).join("")
    : `<li class="none" aria-disabled="true">No song in this pool matches.</li>`;
  sugg.hidden = false; input.setAttribute("aria-expanded", "true");
  if (sel >= 0) input.setAttribute("aria-activedescendant", "opt" + sel);
}
function closeSugg() { sugg.hidden = true; matches = []; sel = -1; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); }
function moveSel(d) {
  if (!matches.length) return;
  sel = (sel + d + matches.length) % matches.length;
  [...sugg.children].forEach((li, i) => li.setAttribute("aria-selected", i === sel));
  input.setAttribute("aria-activedescendant", "opt" + sel);
  sugg.children[sel]?.scrollIntoView({ block: "nearest" });
}
input.addEventListener("input", showSugg);
input.addEventListener("keydown", e => {
  if (e.isComposing) return;
  if (e.key === "ArrowDown") { e.preventDefault(); moveSel(1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); moveSel(-1); }
  else if (e.key === "Enter") { e.preventDefault(); if (sel >= 0) submit(matches[sel]); else if (input.value.trim()) msg.textContent = "Pick a song from the list."; }
  else if (e.key === "Escape") closeSugg();
});
sugg.addEventListener("mousedown", e => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); submit(matches[+li.dataset.i]); } });
input.addEventListener("blur", () => setTimeout(closeSugg, 120));

$("modeDaily").onclick = () => { if (mode !== "daily") { track("mode_changed", { from: mode, to: "daily", filter, source: "toggle" }); startDaily(); } };
$("modePractice").onclick = () => { if (mode !== "practice") { track("mode_changed", { from: mode, to: "practice", filter, source: "toggle" }); startPractice(); } };
document.querySelectorAll("[data-f]").forEach(b => b.onclick = () => {
  if (b.dataset.f === filter) return;
  track("filter_changed", { from: filter, to: b.dataset.f, mode });
  filter = b.dataset.f; store.set("filter", filter);
  mode === "daily" ? startDaily() : startPractice();
});

// "Report a data error" (hidden until a form URL is set in config.js)
const rep = $("reportLink");
if (CFG.reportErrorUrl) {
  rep.href = CFG.reportErrorUrl; rep.hidden = false;
  rep.onclick = () => track("report_error_clicked", puz ? { ...gameProps(), over } : {});
}

filter = ["all", "girl", "boy"].includes(store.get("filter", "all")) ? store.get("filter", "all") : "all";
startDaily();
