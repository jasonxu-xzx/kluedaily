// Renders the daily "Today's KueDrop!" social posts from the schedule (tools/social.html + headless Edge/Chrome).
//
//   npm run social                      today's case (KST), "All" filter
//   npm run social -- --tomorrow        tomorrow's case (to schedule posts the night before)
//   npm run social -- --date 2026-11-24 a specific KST date      (or --case 5)
//   npm run social -- --filter girl     the Girl groups case       (all | girl | boy)
//
//   npm run social -- --copy x          also put a caption on the clipboard   (meta | x | threads)
//
// Output (git-ignored): brand/daily/kuedrop-<date>-case<N>[-<filter>]-{instagram,threads,x}.png
//   + -caption-{meta,x,threads}.txt (also printed)   instagram / threads: 1080x1350 (4:5)    x: 1600x900 (16:9)
// Only the clue categories and difficulty are shown, never the answer.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createEngine, gameDay, caseOfDay, dayOfCase, dateOfDay, DAY, DIFF_NAMES, FILTERS } from "../site/assets/engine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const filter = opt("--filter", "all");
if (!FILTERS.includes(filter)) { console.error(`--filter must be one of ${FILTERS.join(", ")}`); process.exit(1); }

let day = gameDay();
if (args.includes("--tomorrow")) day += 1;
if (opt("--date")) day = Math.floor(Date.parse(opt("--date") + "T00:00:00Z") / DAY);
if (opt("--case")) day = dayOfCase(Number(opt("--case")));
const caseNo = caseOfDay(day);
if (!(caseNo >= 1)) { console.error(`That date is before Case #1 (${dateOfDay(dayOfCase(1))}).`); process.exit(1); }

const read = f => JSON.parse(fs.readFileSync(path.join(root, "site", "data", f), "utf8"));
const E = createEngine(read("artists.json"), read("songs.json"));
const entry = (read("schedule.json")[filter] || [])[caseNo - 1];
if (!entry || entry.case !== caseNo) { console.error(`Case #${caseNo} isn't in the schedule yet. Run: npm run schedule`); process.exit(1); }

const date = dateOfDay(day);
const label = new Date(day * DAY).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const clues = entry.clues.map(id => { const c = E.COL_BY_ID.get(id); return { id, name: c.name, rule: c.rule }; });
const data = { case: caseNo, date: label, difficulty: DIFF_NAMES[entry.band], filter: { all: "", girl: "Girl groups", boy: "Boy groups" }[filter], clues };
const d = Buffer.from(JSON.stringify(data), "utf8").toString("base64url");

const browser = [
  `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium",
].find(p => p && fs.existsSync(p));
if (!browser) { console.error("Edge or Chrome not found"); process.exit(1); }

const outDir = path.join(root, "brand", "daily");
fs.mkdirSync(outDir, { recursive: true });
const base = `kuedrop-${date}-case${caseNo}${filter === "all" ? "" : "-" + filter}`;
const page = pathToFileURL(path.join(root, "tools", "social.html")).href;
const profile = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "kuedrop-social-"));
const shot = (format, size, out) => {
  const r = spawnSync(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--force-device-scale-factor=1",
    `--user-data-dir=${profile}`, "--virtual-time-budget=6000", `--window-size=${size}`, `--screenshot=${out}`, `${page}?format=${format}&d=${d}`],
    { encoding: "utf8" });
  if (!fs.existsSync(out)) { console.error(r.stderr || r.stdout); process.exit(1); }
};
const ig = path.join(outDir, `${base}-instagram.png`), th = path.join(outDir, `${base}-threads.png`), x = path.join(outDir, `${base}-x.png`);
shot("portrait", "1080,1350", ig);
fs.copyFileSync(ig, th);   // Threads uses the same 4:5 post
shot("landscape", "1600,900", x);
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* Edge may still hold it briefly */ }

// ---------- Captions, one per platform ----------
// Links carry UTM tags so PostHog can credit each platform's daily post (Instagram captions can't hold a clickable
// link, so its traffic comes through the bio link: set that to kuedrop.com/?utm_source=instagram&utm_medium=social&utm_campaign=bio).
const link = src => `https://kuedrop.com/?utm_source=${src}&utm_medium=social&utm_campaign=daily`;
const head = `Today's KueDrop! 🎤 Case #${caseNo} · ${label} · ${DIFF_NAMES[entry.band]}${data.filter ? " · " + data.filter : ""}`;
const nums = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];
const captions = {
  // Meta Business Suite: Instagram + Facebook (Facebook turns the bare domain into a link; Instagram can't link in captions)
  meta: `${head}

Today's clues:
${clues.map((c, i) => `${nums[i]} ${c.name}`).join("\n")}
➕ Artist, always on

Can you guess the K-pop song in 8 tries? 🎧
Play free at kuedrop.com (link in bio). New case every midnight KST.

#KueDrop #kpop #kpopgame #kpopquiz #guessthesong #dailypuzzle`,
  // X: 280 characters max (checked below)
  x: `Today's KueDrop! 🎤 Case #${caseNo} · ${DIFF_NAMES[entry.band]}${data.filter ? " · " + data.filter : ""}
Clues: ${clues.map(c => c.name).join(" · ")} (+ Artist)
Can you guess the K-pop song in 8 tries? 👉 ${link("x")}
#KueDrop #kpop`,
  // Threads: 500 characters max; only the first hashtag becomes a topic tag
  threads: `${head}
Today's clues: ${clues.map(c => c.name).join(", ")} (+ Artist)
Can you guess the K-pop song in 8 tries? 👉 ${link("threads")}
#kpop`,
};

// X counts every link as 23 characters, emoji and CJK as 2, everything else as 1.
const xLength = s => [...s.replace(/https?:\/\/\S+/g, "x".repeat(23))]
  .reduce((n, ch) => n + (/\p{Extended_Pictographic}|[ᄀ-ᇿ　-鿿가-힯＀-￯]/u.test(ch) ? 2 : /️|⃣/.test(ch) ? 0 : 1), 0);
const limits = { x: [280, xLength(captions.x)], threads: [500, [...captions.threads].length], meta: [2200, [...captions.meta].length] };
for (const [k, [max, n]] of Object.entries(limits)) if (n > max) { console.error(`The ${k} caption is ${n} characters (max ${max}).`); process.exit(1); }

const capFile = k => path.join(outDir, `${base}-caption-${k}.txt`);
for (const [k, text] of Object.entries(captions)) fs.writeFileSync(capFile(k), text + "\n");

console.log(`Case #${caseNo} (${date} KST, ${filter}): ${clues.map(c => c.name).join(", ")} · ${DIFF_NAMES[entry.band]}`);
for (const f of [ig, th, x]) console.log("  " + path.relative(root, f));
for (const [k, text] of Object.entries(captions)) {
  console.log(`\n----- ${k === "meta" ? "Meta Business Suite (Instagram + Facebook)" : k === "x" ? "X" : "Threads"} · ${limits[k][1]}/${limits[k][0]} chars · ${path.relative(root, capFile(k))}`);
  console.log(text);
}

// --copy meta|x|threads: put that caption on the clipboard (Windows / macOS)
const copy = opt("--copy");
if (copy) {
  if (!captions[copy]) { console.error(`--copy must be one of ${Object.keys(captions).join(", ")}`); process.exit(1); }
  const r = process.platform === "win32"
    ? spawnSync("powershell", ["-NoProfile", "-Command", `Get-Content -Raw -Encoding UTF8 '${capFile(copy)}' | Set-Clipboard`])
    : spawnSync("pbcopy", { input: captions[copy] });
  console.log(r.status === 0 ? `\nCopied the ${copy} caption to the clipboard.` : `\nCouldn't copy to the clipboard; open ${path.relative(root, capFile(copy))} instead.`);
}
