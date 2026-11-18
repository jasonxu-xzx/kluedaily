// Original instrumental for the solve video, synthesized from scratch (no samples, no third-party audio), so it's free
// of any copyright or license question. Upbeat 120 BPM dance-pop loop in F major (F – C – Dm – Bb):
// kick on every beat, clap on 2 and 4, off-beat hi-hats, 8th-note bass, off-beat chord stabs with sidechain pumping, soft pad.
// Synced to the video: filtered intro under the hook, the beat drops at `dropAt`, a "pop" on each guess (`hits`),
// a bright chime on the solve (`solveAt`), and a held chord fading out over the end card (`outroAt`).
//
//   import { renderMusic } from "./make-music.mjs";  renderMusic("out.wav", { seconds: 15, dropAt: 2.1, hits: [...], solveAt, outroAt });
//   node tools/make-music.mjs [out.wav]   -> a 15-second preview with default timings
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export function renderMusic(file, { seconds = 15, bpm = 120, dropAt = 2, hits = [], solveAt = null, outroAt = seconds - 2.6 } = {}) {
  const SR = 44100, N = Math.ceil(seconds * SR);
  const music = [new Float32Array(N), new Float32Array(N)];   // chords + pad + bass (gets the sidechain pump)
  const drums = [new Float32Array(N), new Float32Array(N)];   // drums + sound effects
  const beat = 60 / bpm, bar = beat * 4;
  const mtof = m => 440 * 2 ** ((m - 69) / 12);
  let seed = 12345; const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
  const put = (bus, t, len, fn, panL = 1, panR = 1) => {          // fn(timeSinceStart) -> sample
    const i0 = Math.round(t * SR), n = Math.round(len * SR);
    for (let k = 0; k < n; k++) { const i = i0 + k; if (i < 0 || i >= N) continue; const v = fn(k / SR); bus[0][i] += v * panL; bus[1][i] += v * panR; }
  };
  const saw = (f, t, harm) => { let v = 0; for (let h = 1; h <= harm; h++) v += Math.sin(2 * Math.PI * f * h * t) / h; return v; };

  // F, C, Dm, Bb: [bass note, chord voicing]
  const PROG = [[41, [65, 69, 72]], [36, [64, 67, 72]], [38, [62, 65, 69]], [34, [62, 65, 70]]];
  const chordAt = t => PROG[((Math.floor((t - dropAt) / bar) % 4) + 4) % 4];

  // ---- instruments ----
  const kick = t => put(drums, t, 0.4, x => { const ph = 2 * Math.PI * (50 * x + (100 * 0.045) * (1 - Math.exp(-x / 0.045))); return 0.75 * Math.sin(ph) * Math.exp(-x / 0.22); });
  // clap: band-limited noise (low-pass, then high-pass) with two quick re-hits, like layered hands
  const clap = t => put(drums, t, 0.25, (() => { let lp = 0, prev = 0; return x => { lp += (noise() - lp) * 0.35; const bp = lp - prev; prev = lp;
    const env = Math.exp(-x / 0.07) + (x > 0.011 && x < 0.02 ? 0.6 : 0) + (x > 0.022 && x < 0.03 ? 0.4 : 0); return 0.55 * bp * env; }; })());
  const hat = (t, open = false) => put(drums, t, open ? 0.18 : 0.06, (() => { let prev = 0; return x => { const n = noise(), v = n - prev; prev = n; return 0.09 * v * Math.exp(-x / (open ? 0.06 : 0.018)); }; })(), 0.75, 1);
  const bass = (t, m, len) => put(music, t, len, x => { const f = mtof(m); return 0.32 * (Math.sin(2 * Math.PI * f * x) + 0.25 * Math.sin(2 * Math.PI * f * 2 * x) + 0.12 * Math.sin(2 * Math.PI * f * 3 * x)) * Math.min(1, x / 0.004) * Math.exp(-x / 0.16); });
  const stab = (t, notes, harm, amp = 0.11) => notes.forEach((m, j) => put(music, t, 0.32, x => amp * saw(mtof(m) * (1 + (j - 1) * 0.0015), x, harm) * Math.min(1, x / 0.004) * Math.exp(-x / 0.11), j === 0 ? 1 : 0.8, j === 2 ? 1 : 0.85));
  const pad = (t, notes, len, amp = 0.045) => notes.forEach(m => put(music, t, len, x => { const f = mtof(m - 12);
    const env = Math.min(1, x / 0.35) * Math.min(1, (len - x) / 0.3); return amp * env * (Math.sin(2 * Math.PI * f * x) + 0.35 * Math.sin(2 * Math.PI * f * 2.003 * x) + 0.2 * Math.sin(2 * Math.PI * f * 3 * x)); }));
  const pop = t => put(drums, t, 0.14, x => { const f = 700 + 900 * (1 - Math.exp(-x / 0.03)); return 0.28 * Math.sin(2 * Math.PI * f * x) * Math.exp(-x / 0.045); });
  const bell = (t, m, amp = 0.2) => put(drums, t, 0.9, x => { const f = mtof(m); return amp * (Math.sin(2 * Math.PI * f * x) + 0.3 * Math.sin(2 * Math.PI * f * 3.01 * x) + 0.12 * Math.sin(2 * Math.PI * f * 5.02 * x)) * Math.min(1, x / 0.003) * Math.exp(-x / 0.35); });

  // ---- intro (under the hook): pad + filtered stabs opening up, hats joining, a noise riser into the drop ----
  pad(0, PROG[0][1], dropAt + 0.2, 0.05);
  for (let t = beat / 2, k = 0; t < dropAt - 0.01; t += beat / 2, k++) {
    stab(t, PROG[0][1], 2 + Math.floor(6 * t / dropAt), 0.07 + 0.05 * t / dropAt);
    if (t > dropAt / 2) hat(t);
  }
  put(drums, Math.max(0, dropAt - 0.9), 0.9, (() => { let lp = 0; return x => { lp += (noise() - lp) * (0.02 + 0.5 * x); return 0.12 * lp * (x / 0.9); }; })());

  // ---- groove (drop -> outro) ----
  const kicks = [];
  for (let t = dropAt, b = 0; t < outroAt - 0.01; t += beat, b++) {
    kick(t); kicks.push(t);
    if (b % 2 === 1) clap(t);
    hat(t + beat / 2, b % 4 === 3);
    const [root, chord] = chordAt(t + 0.001);
    bass(t, root, beat / 2 * 0.9); bass(t + beat / 2, root + 12, beat / 2 * 0.9);
    stab(t + beat / 2, chord, 7);
    if (b % 4 === 0) pad(t, chord, bar + 0.1);
  }
  // ---- outro (end card): a final hit and a held F chord ----
  kick(outroAt); kicks.push(outroAt); stab(outroAt, PROG[0][1], 8, 0.12); bass(outroAt, 41, 0.8);
  pad(outroAt, [...PROG[0][1], 77], seconds - outroAt + 0.2, 0.06);

  // ---- sound effects synced to the game ----
  hits.forEach(t => pop(t));
  if (solveAt != null) [77, 81, 84, 89].forEach((m, i) => bell(solveAt + i * 0.075, m, 0.17));

  // ---- mix: sidechain pump on the music bus, soft clip, fades, normalize ----
  const out = [new Float32Array(N), new Float32Array(N)];
  let ki = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    while (ki + 1 < kicks.length && kicks[ki + 1] <= t) ki++;
    const since = kicks.length && kicks[ki] <= t ? t - kicks[ki] : 9;
    const duck = 1 - 0.55 * Math.exp(-since / 0.11);
    const fade = Math.min(1, t / 0.05) * Math.min(1, (seconds - t) / 1.2);
    for (const c of [0, 1]) out[c][i] = Math.tanh(1.1 * (music[c][i] * duck + drums[c][i])) * fade;
  }
  let peak = 0; for (const c of [0, 1]) for (const v of out[c]) peak = Math.max(peak, Math.abs(v));
  const gain = 0.8 / (peak || 1);   // headroom so the AAC encode doesn't clip

  // ---- 16-bit stereo WAV ----
  const buf = Buffer.alloc(44 + N * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) for (const c of [0, 1]) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(out[c][i] * gain * 32767))), 44 + i * 4 + c * 2);
  fs.writeFileSync(file, buf);
  return file;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || "kuedrop-music-preview.wav";
  renderMusic(out, { seconds: 15, dropAt: 2.1, hits: [3.4, 5.2, 7.0], solveAt: 8.9, outroAt: 12.2 });
  console.log("wrote " + out);
}
