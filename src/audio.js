// Tiny WebAudio synth: no audio files needed.
let ctx = null, muted = false, musicTimer = 0;
const start = () => { if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; };
function tone(f, dur = 0.12, type = 'square', vol = 0.05, when = 0, slide = 0) {
  if (muted || !start()) return; const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.linearRampToValueAtTime(f + slide, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur = 0.2, vol = 0.04, when = 0, hp = 800) {
  if (muted || !start()) return; const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.buffer = b; s.connect(f).connect(g).connect(ctx.destination); s.start(ctx.currentTime + when);
}
export const sfx = {
  step() { tone(110 + Math.random() * 30, 0.05, 'triangle', 0.03); },
  pick() { tone(660, 0.08, 'square', 0.04); tone(990, 0.12, 'square', 0.04, 0.08); },
  tick() { tone(1400, 0.03, 'square', 0.03); },
  wind() { for (let i = 0; i < 6; i++) tone(500 + i * 40, 0.04, 'square', 0.03, i * 0.05); },
  water() { noise(0.9, 0.05, 0, 1500); },
  cloth() { noise(0.35, 0.05, 0, 300); },
  chime() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.05, i * 0.12)); },
  wrong() { tone(160, 0.2, 'sawtooth', 0.04); },
  click() { tone(880, 0.04, 'square', 0.03); },
  bird() { for (let i = 0; i < 4; i++) tone(2200 + (i % 2) * 500, 0.07, 'sine', 0.03, i * 0.1, 400); },
  door(open) { noise(0.45, 0.04, 0, 250); tone(open ? 180 : 140, 0.35, 'sawtooth', 0.025, 0, open ? 90 : -60); },
  fan(on) { if (on) { noise(1.2, 0.02, 0, 600); } else { tone(240, 0.3, 'triangle', 0.02, 0, -120); } },
  open() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'triangle', 0.05, i * 0.1)); },
  blip() { tone(520 + Math.random() * 60, 0.03, 'square', 0.015); },
  page() { noise(0.25, 0.04, 0, 1800); },
  knock() { [0, 0.28, 0.56].forEach(t => { noise(0.08, 0.12, t, 120); tone(90, 0.1, 'sine', 0.12, t); }); },
  unlock() { tone(1200, 0.04, 'square', 0.04); tone(700, 0.08, 'square', 0.04, 0.06); },
  magic() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, 'sine', 0.035, i * 0.07)); },
  whoosh() { noise(0.6, 0.05, 0, 600); },
};
export function setMuted(m) { muted = m; if (m) stopMusic(); else startMusic(); }
export const isMuted = () => muted;
const NOTES = [262, 330, 392, 330, 294, 349, 440, 349, 262, 330, 392, 523, 392, 330, 294, 247];
export function startMusic() { if (muted || musicTimer || !start()) return; let i = 0; musicTimer = setInterval(() => { tone(NOTES[i % NOTES.length] / 2, 0.9, 'triangle', 0.018); i++; }, 900); }
export function stopMusic() { clearInterval(musicTimer); musicTimer = 0; }
export const unlock = start;
