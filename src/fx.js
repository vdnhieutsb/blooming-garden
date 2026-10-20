// Small generated textures for the "Mewmew"-style feedback: object outlines, the "…" bubble, path dots.
const CREAM = [0xfd, 0xfa, 0xe6], INK = [0x37, 0x15, 0x06];

// Outline ring around the opaque pixels of a source region: 1 art px (2 world px) cream, then 1 art px ink outside it.
// parts = [{img, x, y, w, h, dx, dy, keep?}] (regions of texture source images placed at world dx, dy; keep(r, g, b) filters pixels);
// returns the key; customData = world position of the texture's top-left corner.
export function outlineTexture(scene, key, parts) {
  if (scene.textures.exists(key)) return key;
  const xs = parts.map(p => p.dx), ys = parts.map(p => p.dy), x0 = Math.min(...xs), y0 = Math.min(...ys);
  const W = Math.max(...parts.map(p => p.dx + p.w)) - x0 + 8, H = Math.max(...parts.map(p => p.dy + p.h)) - y0 + 8;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  for (const p of parts) {
    const ox = p.dx - x0 + 4, oy = p.dy - y0 + 4; g.drawImage(p.img, p.x, p.y, p.w, p.h, ox, oy, p.w, p.h);
    if (p.keep) { const im = g.getImageData(ox, oy, p.w, p.h), d = im.data; for (let i = 0; i < d.length; i += 4) if (!p.keep(d[i], d[i + 1], d[i + 2])) d[i + 3] = 0; g.putImageData(im, ox, oy); }
  }
  const src = g.getImageData(0, 0, W, H).data, solid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) solid[i] = src[i * 4 + 3] > 100 ? 1 : 0;
  if (parts.some(p => p.keep)) tidy(solid, W, H, Math.max(...parts.map(p => p.close || 2)));
  const dist = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const u = x + dx, v = y + dy; if (u >= 0 && v >= 0 && u < W && v < H && solid[v * W + u]) return true; } return false; };
  const out = g.createImageData(W, H), d = out.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (solid[y * W + x]) continue; const c = dist(x, y, 2) ? CREAM : dist(x, y, 4) ? INK : null; if (!c) continue;
    const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  g.putImageData(out, 0, 0); scene.textures.addCanvas(key, cv);
  scene.textures.get(key).customData = { x: x0 - 4, y: y0 - 4 }; return key;
}

// colour-filtered silhouettes are ragged: close gaps up to r px, drop specks under 60 px and fill inner holes
function tidy(m, W, H, r) {
  const grow = (src, v) => { const o = src.slice(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (src[y * W + x] === v) continue;
    for (let dy = -r; dy <= r && o[y * W + x] !== v; dy++) for (let dx = -r; dx <= r; dx++) { const u = x + dx, w = y + dy; if (u >= 0 && w >= 0 && u < W && w < H && src[w * W + u] === v) { o[y * W + x] = v; break; } } } return o; };
  const closed = grow(grow(m, 1), 0); m.set(closed);
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (m[i] && !seen[i]) {
    const comp = [i]; seen[i] = 1; for (let k = 0; k < comp.length; k++) { const j = comp[k], x = j % W, y = (j - x) / W;
      for (const n of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) if (n >= 0 && m[n] && !seen[n]) { seen[n] = 1; comp.push(n); } }
    if (comp.length < 60) for (const j of comp) m[j] = 0;
  }
  const out = new Uint8Array(W * H), q = [];                                  // transparent pixels reachable from the border
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) q.push(y * W + x); for (let y = 0; y < H; y++) for (const x of [0, W - 1]) q.push(y * W + x);
  while (q.length) { const j = q.pop(); if (out[j] || m[j]) continue; out[j] = 1; const x = j % W; if (x > 0) q.push(j - 1); if (x < W - 1) q.push(j + 1); if (j >= W) q.push(j - W); if (j < W * (H - 1)) q.push(j + W); }
  for (let i = 0; i < W * H; i++) if (!out[i]) m[i] = 1;
}

// wood / floor colours of the room palette: everything else in a furniture piece belongs to the object itself
const WOOD = new Set(['f26305', 'ff7a1a', 'a63803', 'cc4702', '832c04', '5f1e03', '371506', '6b2410', 'b5430f', '814622', 'ffd27a', 'ffb04a', 'f1a35e', 'de863e', 'bc6727', 'f9c581', 'fce0b3']);
export const notWood = (r, g, b) => !WOOD.has(((r << 16) | (g << 8) | b).toString(16).padStart(6, '0'));

// region of a loaded texture frame, placed at world (dx, dy)
export function frameRegion(scene, key, frame, dx, dy, crop) {
  const f = scene.textures.getFrame(key, frame), img = f.source.image;
  if (!crop) return { img, x: f.cutX, y: f.cutY, w: f.cutWidth, h: f.cutHeight, dx, dy };
  const [cx, cy, cw, ch] = crop; return { img, x: f.cutX + cx, y: f.cutY + cy, w: cw, h: ch, dx: dx + cx, dy: dy + cy };
}

// pixel bubble with "…" filling in one dot at a time (4 frames), drawn at 2 world px per art px
export function bubbleTexture(scene) {
  if (scene.textures.exists('bubble')) return;
  const A = 3, w = 16, h = 13, cv = document.createElement('canvas'); cv.width = w * A * 4; cv.height = h * A; const g = cv.getContext('2d');
  const px = (f, x, y, c) => { g.fillStyle = c; g.fillRect((f * w + x) * A, y * A, A, A); };
  const rect = (f, x, y, ww, hh, c) => { for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) px(f, x + i, y + j, c); };
  for (let f = 0; f < 4; f++) {
    rect(f, 1, 0, 14, 1, '#371506'); rect(f, 1, 9, 14, 1, '#371506'); rect(f, 0, 1, 1, 8, '#371506'); rect(f, 15, 1, 1, 8, '#371506');
    rect(f, 1, 1, 14, 8, '#fdfae6'); rect(f, 1, 8, 14, 1, '#c5ceb8');
    rect(f, 6, 10, 4, 1, '#fdfae6'); px(f, 5, 10, '#371506'); px(f, 10, 10, '#371506'); rect(f, 7, 11, 2, 1, '#fdfae6'); px(f, 6, 11, '#371506'); px(f, 9, 11, '#371506'); rect(f, 7, 12, 2, 1, '#371506');
    for (let k = 0; k < Math.min(f, 3); k++) rect(f, 3 + k * 4, 4, 2, 2, '#371506');
  }
  scene.textures.addSpriteSheet('bubble', cv, { frameWidth: w * A, frameHeight: h * A });
}

// round path dot (cream with an ink rim), 5x5 art px
export function dotTexture(scene) {
  if (scene.textures.exists('pathdot')) return;
  const A = 2, M = ['.###.', '#ooo#', '#ooo#', '#ooo#', '.###.'], cv = document.createElement('canvas'); cv.width = cv.height = 5 * A; const g = cv.getContext('2d');
  M.forEach((row, y) => [...row].forEach((c, x) => { if (c === '.') return; g.fillStyle = c === '#' ? '#371506' : '#fdfae6'; g.fillRect(x * A, y * A, A, A); }));
  scene.textures.addCanvas('pathdot', cv);
}
