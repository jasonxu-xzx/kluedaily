// Records the 15-second "solve" video (1080x1920, 9:16, H.264, silent) for Reels / TikTok / Shorts.
//
//   npm run video            -> brand/video/kuedrop-solve.mp4   (+ frames in a temp folder, deleted after)
//
// How: serves site/ locally, opens it in headless Edge at phone size (Playwright), swaps today's daily case for a
// demo case (DEMO below: an answer that isn't a daily answer in the scheduled window, so nothing is spoiled),
// types the guesses, and records the screen with Chrome's screencast (crisp frames, not a compressed webm).
// A hook sticker covers the empty board for the first seconds; tools/video-endcard.html is appended as the end card.
// Analytics are switched off for the recording (analytics.js is replaced by an empty script), so no fake games reach PostHog.
// Needs: npm i (playwright), ffmpeg (winget install Gyan.FFmpeg). No audio: add a licensed sound in the app when posting.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { LAUNCH_DAY, DAY, KST } from "../site/assets/engine.js";

const DEMO = { song: "black-mamba", clues: ["wins", "views", "letters", "length"], band: 3, guesses: ["Magnetic", "Ditto", "Spicy", "Black Mamba"] };
const HOOK = { pill: "Wordle, but for K-pop", line: "Can you guess the song in 8 tries?" };
const PORT = 8799, FPS = 30, END_SECONDS = 3, XFADE = 0.4;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "brand", "video");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kuedrop-video-"));
// ffmpeg: $FFMPEG, then winget's install folder (its PATH entry only shows up in new terminals), then PATH
const wingetPkgs = path.join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Packages");
const wingetFfmpeg = fs.existsSync(wingetPkgs) ? fs.readdirSync(wingetPkgs).filter(d => /^Gyan\.FFmpeg/.test(d))
  .flatMap(d => fs.readdirSync(path.join(wingetPkgs, d)).map(v => path.join(wingetPkgs, d, v, "bin", "ffmpeg.exe"))) : [];
const ffmpeg = [process.env.FFMPEG, ...wingetFfmpeg].find(p => p && fs.existsSync(p)) || "ffmpeg";
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- serve site/ and open the game ----------
const server = spawn(process.execPath, [path.join(root, "tools", "serve.mjs"), String(PORT)], { stdio: "ignore" });
await sleep(800);
const browser = await chromium.launch({ channel: "msedge" });
const ctx = await browser.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.route("**/assets/analytics.js", r => r.fulfill({ contentType: "text/javascript", body: "" }));
await page.route("**/data/schedule.json", async r => {
  const res = await r.fetch(), s = await res.json();
  const day = Math.max(Math.floor((Date.now() + KST) / DAY), LAUNCH_DAY), i = day - LAUNCH_DAY;
  s.all[i] = { ...s.all[i], song: DEMO.song, clues: DEMO.clues, band: DEMO.band };
  await r.fulfill({ response: res, json: s });
});
await page.goto(`http://localhost:${PORT}/`);
await page.evaluate(() => document.fonts.ready);
// Video layout: hide the mode/filter toggles so clues, the guess box and the newest guess fit on one phone screen.
await page.addStyleTag({ content: `
  .controls, footer.foot { display: none !important; }
  #hook { position: fixed; left: 0; right: 0; top: 470px; display: flex; flex-direction: column; align-items: center; gap: 22px; z-index: 50;
    transition: opacity .25s, transform .25s; }
  #hook .pill { font-family: "Bagel Fat One", sans-serif; font-size: 34px; color: #fff; background: #1F46C8; border: 3px solid #fff; border-radius: 999px;
    padding: 10px 26px 14px; box-shadow: 5px 5px 0 #FF8AC8, 0 0 0 3px #1F46C8; transform: rotate(-3deg); animation: pop .45s cubic-bezier(.2,1.6,.4,1) both; }
  #caseline { visibility: hidden; }
  #hook .line { font-family: "Bagel Fat One", sans-serif; font-size: 21px; color: #1F46C8; background: #fff; border: 3px solid #1F46C8; border-radius: 18px;
    padding: 8px 18px; box-shadow: 4px 4px 0 #1F46C8; animation: pop .45s .25s cubic-bezier(.2,1.6,.4,1) both; }
  #hook.gone { opacity: 0; transform: translateY(20px); }
  @keyframes pop { from { transform: scale(.4) rotate(-3deg); opacity: 0; } to { transform: scale(1) rotate(-3deg); opacity: 1; } }
  .board > :not(:first-child) { opacity: .9; }` });
// The demo answer isn't the real case of the day, so no case numbers on screen ("KueDrop #1" -> "KueDrop").
await page.evaluate(() => {
  const strip = () => { const end = document.getElementById("end"); if (!end) return;
    const w = document.createTreeWalker(end, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) if (/KueDrop #\d+/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/KueDrop #\d+/g, "KueDrop"); };
  new MutationObserver(strip).observe(document.body, { childList: true, subtree: true, characterData: true });
});
await page.evaluate(h => { document.querySelector(".empty")?.style.setProperty("visibility", "hidden");
  document.body.insertAdjacentHTML("beforeend", `<div id="hook"><span class="pill">${h.pill}</span><span class="line">${h.line}</span></div>`); }, HOOK);

// ---------- record ----------
const frames = [];
const cdp = await ctx.newCDPSession(page);
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const f = path.join(tmp, `f${String(frames.length).padStart(5, "0")}.jpg`);
  fs.writeFileSync(f, Buffer.from(data, "base64"));
  frames.push({ f, t: metadata.timestamp });
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
const t0 = Date.now() / 1000;
await sleep(2100);                                                      // hook
await page.evaluate(() => document.getElementById("hook").classList.add("gone"));
await sleep(250);
for (const [i, g] of DEMO.guesses.entries()) {
  await page.click("input");
  await page.keyboard.type(g, { delay: 45 });
  await sleep(300);                                                     // let the suggestion list show
  await page.keyboard.press("Enter");
  await sleep(i === DEMO.guesses.length - 1 ? 1900 : 1500);             // flip animation + a beat to read
}
// keep the last frame on screen until now (the screencast only sends frames when something changes)
await page.evaluate(() => document.body.style.setProperty("outline", "0 solid transparent")); await sleep(80);
const tEnd = Date.now() / 1000;
await cdp.send("Page.stopScreencast");

// ---------- end card ----------
const end = path.join(tmp, "endcard.png");
const card = await ctx.newPage();
await card.setViewportSize({ width: 1080, height: 1920 });
await card.goto(pathToFileURL(path.join(root, "tools", "video-endcard.html")).href);
await card.evaluate(() => document.fonts.ready); await sleep(300);
await card.screenshot({ path: end });
await browser.close(); server.kill();

// ---------- frames -> mp4 ----------
if (!frames.length) throw new Error("No frames recorded");
const list = frames.map((fr, i) => `file '${fr.f.replace(/\\/g, "/")}'\nduration ${Math.max(0.001, (i + 1 < frames.length ? frames[i + 1].t : tEnd - t0 + frames[0].t) - fr.t).toFixed(3)}`);
list.push(`file '${frames.at(-1).f.replace(/\\/g, "/")}'`);
fs.writeFileSync(path.join(tmp, "frames.txt"), list.join("\n"));
const playLen = tEnd - t0;
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, "kuedrop-solve.mp4");
const args = ["-y", "-f", "concat", "-safe", "0", "-i", path.join(tmp, "frames.txt"), "-loop", "1", "-t", String(END_SECONDS + XFADE), "-i", end,
  "-filter_complex", `[0:v]scale=1080:1920:flags=lanczos,fps=${FPS},setsar=1,format=yuv420p[a];[1:v]scale=1080:1920,fps=${FPS},setsar=1,format=yuv420p[b];` +
    `[a][b]xfade=transition=fade:duration=${XFADE}:offset=${(playLen - XFADE).toFixed(2)},format=yuv420p[v]`,
  "-map", "[v]", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", "-an", out];
const r = spawnSync(ffmpeg, args, { encoding: "utf8" });
if (r.error) { console.error(`Couldn't run ffmpeg (${r.error.message}). Install it: winget install Gyan.FFmpeg`); process.exit(1); }
if (r.status !== 0) { console.error(r.stderr.slice(-2000)); process.exit(1); }
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${path.relative(root, out)}  (${(playLen + END_SECONDS).toFixed(1)} s, ${frames.length} screen frames)`);
