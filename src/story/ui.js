// Story overlays (DOM, pixel style like the Mewmew reference): dialogue with a big bust portrait, letter paper,
// close-up scenes, the letter / item HUD, cinematic bars, fades and the end card. Every call returns a Promise.
import { sfx } from '../audio.js';

const A = 'assets/story/';
const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; (parent || root()).appendChild(e); return e; };
let _root = null;
const root = () => _root || (_root = document.getElementById('story'));
const wait = (ms) => new Promise(r => setTimeout(r, ms));

export const SPEAKERS = {
  Hương: { col: '#ee9a86', pic: (m) => `portrait_em_${m || 'neutral'}.png` },
  'Paper Crane': { col: '#f1c93b', pic: () => 'portrait_crane.png' },
  Hiếu: { col: '#c98a6e', pic: () => 'portrait_anh_smile.png' },
};

// "advance" input: click / tap anywhere on the overlay, or Enter / Space / E; cancel() removes the listeners
function listen(target) {
  let res; const p = new Promise(r => { res = r; });
  const k = (e) => { if (['Enter', ' ', 'e', 'E'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); done(); } };
  const c = (e) => { e.stopPropagation(); done(); };
  const cancel = () => { window.removeEventListener('keydown', k, true); target.removeEventListener('pointerdown', c); };
  const done = () => { cancel(); res(); };
  window.addEventListener('keydown', k, true); target.addEventListener('pointerdown', c);
  p.cancel = cancel; return p;
}
const advance = (target) => listen(target);

// ---- dialogue: portrait over a diagonal colour shape, name tab, typewriter text, optional choices
export async function say(who, mood, text, choices) {
  const sp = SPEAKERS[who], layer = el('div', 'dlg');
  const pic = el('img', 'dlg-pic', layer); pic.src = A + sp.pic(mood);
  const name = el('div', 'dlg-name', layer, who); name.style.background = sp.col;
  const box = el('div', 'dlg-box', layer), txt = el('span', '', box), next = el('span', 'dlg-next', box, '&#9656;');
  requestAnimationFrame(() => layer.classList.add('in'));
  next.style.visibility = 'hidden';
  let skip = false; const s = listen(layer); s.then(() => { skip = true; });
  for (let i = 1; i <= text.length && !skip; i++) { txt.textContent = text.slice(0, i); if (i % 3 === 0) sfx.blip(); await wait(22); }
  txt.textContent = text; s.cancel();                       // the first input only finishes the typing
  let pick = 0;
  if (choices) {
    const row = el('div', 'dlg-btns', layer);
    pick = await new Promise(res => { choices.forEach((c, i) => { const b = el('button', 'pbtn' + (i ? ' alt' : ''), row, c); b.onpointerdown = (e) => { e.stopPropagation(); sfx.click(); res(i); }; }); });
  } else { next.style.visibility = 'visible'; await advance(layer); }
  layer.classList.remove('in'); await wait(140); layer.remove(); return pick;
}
export async function talk(lines) { for (const l of lines) await say(...l); }

// ---- a letter (piece or full letter) on torn paper
export async function paper(lines, opts = {}) {
  sfx.page(); const layer = el('div', 'paper-layer' + (opts.full ? ' full' : '')), card = el('div', 'paper', layer);
  if (opts.title) el('div', 'paper-title', card, opts.title);
  for (const l of lines) el('p', l.startsWith('>') ? 'clue' : '', card, l.replace(/^>/, ''));
  el('div', 'paper-hint', card, opts.hint || 'tap to continue');
  requestAnimationFrame(() => layer.classList.add('in'));
  await wait(350); await advance(layer); layer.classList.remove('in'); await wait(200); layer.remove();
}

// ---- show an image big (the polaroid)
export async function showImage(src, caption) {
  const layer = el('div', 'paper-layer'), card = el('div', 'photo', layer), img = el('img', '', card); img.src = A + src;
  if (caption) el('div', 'photo-cap', card, caption);
  requestAnimationFrame(() => layer.classList.add('in')); await wait(300); await advance(layer); layer.remove();
}

// ---- close-up scene: art at 160 x 100 px, scaled by an integer; items / hotspots in art coordinates
export class Close {
  constructor(bg) {
    this.layer = el('div', 'close'); const vw = innerWidth, vh = innerHeight;
    this.k = Math.max(2, Math.floor(Math.min(vw * 0.92 / 160, vh * 0.78 / 100)));
    this.stage = el('div', 'close-stage', this.layer); this.stage.style.width = 160 * this.k + 'px'; this.stage.style.height = 100 * this.k + 'px';
    this.bg = this.img(bg, 0, 0); this.items = {};
    this.back = el('button', 'pbtn close-back', this.layer, '&#9664; Back');
    this.isClosed = false; this.closed = new Promise(res => { this.back.onpointerdown = (e) => { e.stopPropagation(); sfx.click(); this.close(); }; this._res = res; });
    this.layer.addEventListener('pointerdown', e => e.stopPropagation());
    requestAnimationFrame(() => this.layer.classList.add('in')); sfx.click();
  }
  img(src, x, y, cls) { const i = el('img', 'cu-img' + (cls ? ' ' + cls : ''), this.stage); i.src = A + src; i.style.left = x * this.k + 'px'; i.style.top = y * this.k + 'px'; i.onload = () => { i.style.width = i.naturalWidth * this.k + 'px'; }; return i; }
  setBg(src) { this.bg.src = A + src; }
  item(id, src, x, y, onPick) { const i = this.img(src, x, y, 'cu-item'); i.onpointerdown = (e) => { e.stopPropagation(); onPick && onPick(i); }; this.items[id] = i; return i; }
  drop(id) { const i = this.items[id]; if (i) { i.classList.add('picked'); setTimeout(() => i.remove(), 250); delete this.items[id]; } }
  zone(x, y, w, h, cb) { const z = el('div', 'cu-zone', this.stage); Object.assign(z.style, { left: x * this.k + 'px', top: y * this.k + 'px', width: w * this.k + 'px', height: h * this.k + 'px' }); z.onpointerdown = (e) => { e.stopPropagation(); cb(z); }; return z; }
  canvas() { const c = el('canvas', 'cu-canvas', this.stage); c.width = 160 * this.k; c.height = 100 * this.k; return c; }
  async close() { if (this.isClosed) return; this.isClosed = true; this.layer.classList.remove('in'); await wait(180); this.layer.remove(); this._res(); }
}

// ---- HUD: letter pieces found + items
let hud = null;
export function setHud(pieces, items, onOpen, show = true) {
  if (!hud) { hud = el('button', 'hud'); hud.title = 'Clues'; }
  hud.innerHTML = `<img src="${A}it_piece.png"><span class="hud-l">Letter <b>${pieces}</b> / 5</span>` + items.map(i => `<img src="${A}it_${i}.png" title="${i}">`).join('');
  hud.onpointerdown = (e) => { e.stopPropagation(); sfx.click(); onOpen && onOpen(); };
  hud.style.display = show ? '' : 'none';
}

// ---- replay button (top right, next to the sound button)
export function replayButton(onPress, busy) {
  const b = el('button', 'replay-btn', null, '&#8634;'); b.title = 'Replay from the beginning';
  setInterval(() => b.classList.toggle('busy', !!busy()), 250);
  b.onpointerdown = (e) => { e.stopPropagation(); sfx.click(); onPress(); };
}

// ---- cinematic bars, fades, centred captions, end card
export function bars(on) { let b = document.querySelector('.bars'); if (!b) { b = el('div', 'bars'); el('div', '', b); el('div', '', b); } b.classList.toggle('on', on); return wait(400); }
export async function caption(text, ms = 1800) { const c = el('div', 'caption', null, text); requestAnimationFrame(() => c.classList.add('in')); await wait(ms); c.classList.remove('in'); await wait(400); c.remove(); }
export async function endCard(onReplay) {
  const c = el('div', 'endcard'); el('div', 'end-title', c, 'Happy 20/10'); el('div', 'end-sub', c, 'Happy birthday, Hương &#9829;');
  const b = el('button', 'pbtn', c, 'Play again'); b.onpointerdown = (e) => { e.stopPropagation(); onReplay(); };
  el('div', 'end-credit', c, 'a small game made by Hiếu &middot; 20.10');
  requestAnimationFrame(() => c.classList.add('in'));
}
