// ?debug=1 layout editor: drag points of walkable floors, colliders, door gates, front-wall fade zones and standing points;
// click an edge to add a point, right-click (or Alt+click) a point to delete it; Save writes assets/layout.json via server.py.
import { inPoly } from './nav.js';

const ED_CSS = `#editor{position:fixed;left:8px;top:8px;z-index:50;max-width:min(96vw,760px);background:rgba(27,13,7,.94);border:2px solid #f26305;padding:8px 10px;color:#fdfae6;font:13px/1.4 ui-monospace,Menlo,monospace;pointer-events:auto}#editor .ed-row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin-bottom:6px}#editor button{font:inherit;background:#371506;color:#fdfae6;border:1px solid #f26305;padding:3px 8px;cursor:pointer}#editor button.ed-save{background:#f26305;color:#1b0d07;font-weight:bold}#editor label{cursor:pointer;white-space:nowrap}#editor .ed-help{color:#f9c581;margin-bottom:4px}#ed-status{color:#c5ceb8;min-height:1.4em}#editor.folded>:not(:first-child){display:none}#editor.folded .ed-row{margin:0}`;   // inline so a stale cached style.css can never hide the panel

const LAYERS = {
  floors: { name: 'Vùng đi', color: 0x00ff78 },
  obstacles: { name: 'Vật cản', color: 0xff3030 },
  gates: { name: 'Cổng cửa', color: 0x00e5ff },
  front: { name: 'Vùng mờ tường trước', color: 0xff40ff },
  ats: { name: 'Chỗ đứng dùng vật', color: 0xffff00 },
};

export class Editor {
  constructor(room) {
    this.room = room; this.L = room.L; this.editing = true; this.sel = null; this.drag = null; this.undo = []; this.dirty = false;
    this.show = Object.fromEntries(Object.keys(LAYERS).map(k => [k, true]));
    for (const o of this.L.obstacles) if (o.rect) { const [x0, y0, x1, y1] = o.rect; o.poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]; delete o.rect; }
    this.g = room.add.graphics().setDepth(1e5);
    room.input.mouse && room.input.mouse.disableContextMenu();
    room.input.on('pointerdown', (p) => this.down(p)); room.input.on('pointermove', (p) => this.move(p)); room.input.on('pointerup', () => this.up());
    room.input.keyboard.on('keydown', (e) => this.key(e));
    this.panel(); this.draw();
  }
  // ---- shapes the editor knows about
  shapes() {
    const s = [], L = this.L;
    L.floors.forEach((p, i) => s.push({ layer: 'floors', kind: 'poly', pts: p, name: 'Vùng đi #' + (i + 1), list: L.floors }));
    L.obstacles.forEach(o => { if (o.poly) s.push({ layer: 'obstacles', kind: 'poly', pts: o.poly, name: 'Vật cản: ' + o.id, owner: o, list: L.obstacles }); if (o.ellipse) s.push({ layer: 'obstacles', kind: 'ellipse', e: o.ellipse, name: 'Vật cản: ' + o.id, owner: o, list: L.obstacles }); });
    L.objects.forEach(o => (o.gate || []).forEach((p, i) => s.push({ layer: 'gates', kind: 'poly', pts: p, name: 'Cổng ' + o.id + ' #' + (i + 1), list: o.gate })));
    (L.frontZone || []).forEach((p, i) => s.push({ layer: 'front', kind: 'poly', pts: p, name: 'Vùng mờ #' + (i + 1), list: L.frontZone }));
    L.objects.forEach(o => (o.ats || []).forEach((a, i) => s.push({ layer: 'ats', kind: 'point', pt: a, name: 'Chỗ đứng ' + o.id + ' #' + (i + 1), list: o.ats })));
    return s.filter(x => this.show[x.layer]);
  }
  tol() { return 10 / this.room.cameras.main.zoom; }
  snapshot() { this.undo.push(JSON.stringify(this.L)); if (this.undo.length > 60) this.undo.shift(); }
  restore(json) { const d = JSON.parse(json); for (const k of Object.keys(this.L)) delete this.L[k]; Object.assign(this.L, d); this.changed(); }
  changed() { this.dirty = true; this.room.rebuildNav(); this.draw(); this.status(); }
  // ---- mouse
  down(p) {
    if (!this.editing) return;
    const x = p.worldX, y = p.worldY, t = this.tol(), del = p.rightButtonDown() || (p.event && p.event.altKey);
    for (const s of this.shapes()) {                       // 1. a point / handle
      if (s.kind === 'poly') for (let i = 0; i < s.pts.length; i++) if (Math.hypot(s.pts[i][0] - x, s.pts[i][1] - y) < t) {
        if (del) { if (s.pts.length > 3) { this.snapshot(); s.pts.splice(i, 1); this.changed(); } return; }
        this.snapshot(); this.sel = s; this.drag = { pt: s.pts[i] }; this.draw(); this.status(); return;
      }
      if (s.kind === 'ellipse') { const [cx, cy, rx, ry] = s.e, h = [[cx, cy, 'c'], [cx + rx, cy, 'rx'], [cx, cy + ry, 'ry']];
        for (const [hx, hy, w] of h) if (Math.hypot(hx - x, hy - y) < t) { this.snapshot(); this.sel = s; this.drag = { ell: s.e, w }; this.draw(); this.status(); return; } }
      if (s.kind === 'point' && Math.hypot(s.pt[0] - x, s.pt[1] - y) < t) { if (del) { if (s.list.length > 1) { this.snapshot(); s.list.splice(s.list.indexOf(s.pt), 1); this.changed(); } return; } this.snapshot(); this.sel = s; this.drag = { pt: s.pt }; this.draw(); this.status(); return; }
    }
    if (del) return;
    for (const s of this.shapes()) if (s.kind === 'poly') for (let i = 0; i < s.pts.length; i++) {   // 2. an edge -> new point
      const a = s.pts[i], b = s.pts[(i + 1) % s.pts.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
      if (Math.hypot(a[0] + u * dx - x, a[1] + u * dy - y) < t * 0.8) { this.snapshot(); const np = [Math.round(x), Math.round(y)]; s.pts.splice(i + 1, 0, np); this.sel = s; this.drag = { pt: np }; this.changed(); return; }
    }
    this.sel = this.shapes().find(s => (s.kind === 'poly' && inPoly(x, y, s.pts)) || (s.kind === 'ellipse' && ((x - s.e[0]) / s.e[2]) ** 2 + ((y - s.e[1]) / s.e[3]) ** 2 <= 1)) || null;   // 3. select
    this.draw(); this.status();
  }
  move(p) {
    this.cursor = [Math.round(p.worldX), Math.round(p.worldY)];
    if (this.drag) { const [x, y] = this.cursor; if (this.drag.pt) { this.drag.pt[0] = x; this.drag.pt[1] = y; } else { const e = this.drag.ell; if (this.drag.w === 'c') { e[0] = x; e[1] = y; } if (this.drag.w === 'rx') e[2] = Math.max(4, Math.abs(x - e[0])); if (this.drag.w === 'ry') e[3] = Math.max(4, Math.abs(y - e[1])); } this.draw(); }
    this.status();
  }
  up() { if (this.drag) { this.drag = null; this.changed(); } }
  key(e) {
    if (!this.editing) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (this.undo.length) this.restore(this.undo.pop()); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel && this.sel.list && this.sel.kind !== 'point') { e.preventDefault(); this.deleteSel(); }
  }
  deleteSel() { const s = this.sel; if (!s) return; this.snapshot(); const i = s.owner ? s.list.indexOf(s.owner) : s.list.indexOf(s.pts); if (i >= 0) s.list.splice(i, 1); this.sel = null; this.changed(); }
  add(layer) {
    const c = this.room.cameras.main.midPoint, x = Math.round(c.x), y = Math.round(c.y), sq = [[x - 40, y - 20], [x + 40, y - 20], [x + 40, y + 20], [x - 40, y + 20]]; this.snapshot();
    if (layer === 'floors') this.L.floors.push(sq);
    if (layer === 'obstacles') { let n = 1; while (this.L.obstacles.some(o => o.id === 'vat-' + n)) n++; this.L.obstacles.push({ id: 'vat-' + n, poly: sq }); }
    if (layer === 'front') (this.L.frontZone = this.L.frontZone || []).push(sq);
    this.show[layer] = true; this.changed();
  }
  // ---- drawing
  draw() {
    const g = this.g.clear(), z = this.room.cameras.main.zoom, hs = 4 / z, lw = 2 / z;
    for (const s of this.shapes()) {
      const col = LAYERS[s.layer].color, on = this.sel === s;
      if (s.kind === 'poly') { g.fillStyle(col, on ? 0.28 : 0.13).fillPoints(s.pts.map(([x, y]) => ({ x, y })), true); g.lineStyle(on ? lw * 2 : lw, on ? 0xffffff : col, 1).strokePoints(s.pts.map(([x, y]) => ({ x, y })), true); for (const [x, y] of s.pts) g.fillStyle(on ? 0xffffff : col, 1).fillRect(x - hs, y - hs, hs * 2, hs * 2); }
      if (s.kind === 'ellipse') { const [cx, cy, rx, ry] = s.e; g.fillStyle(col, on ? 0.28 : 0.13).fillEllipse(cx, cy, rx * 2, ry * 2); g.lineStyle(on ? lw * 2 : lw, on ? 0xffffff : col, 1).strokeEllipse(cx, cy, rx * 2, ry * 2); for (const [x, y] of [[cx, cy], [cx + rx, cy], [cx, cy + ry]]) g.fillStyle(on ? 0xffffff : col, 1).fillRect(x - hs, y - hs, hs * 2, hs * 2); }
      if (s.kind === 'point') { g.fillStyle(col, 1).fillCircle(s.pt[0], s.pt[1], 6 / z); g.lineStyle(lw, 0x371506, 1).strokeCircle(s.pt[0], s.pt[1], 6 / z); }
    }
    if (this.show.obstacles) for (const o of this.L.objects) { g.lineStyle(lw, 0x3080ff, 0.8).strokeRect(o.rect[0], o.rect[1], o.rect[2] - o.rect[0], o.rect[3] - o.rect[1]); }
  }
  // ---- DOM panel
  panel() {
    if (!document.getElementById('ed-css')) { const st = document.createElement('style'); st.id = 'ed-css'; st.textContent = ED_CSS; document.head.appendChild(st); }
    const d = document.createElement('div'); d.id = 'editor';
    d.innerHTML = `<div class="ed-row"><b>Chỉnh bố cục</b> <button data-a="fold">Thu gọn</button> <button data-a="mode">Đang chỉnh · bấm để đi thử</button></div>
      <div class="ed-row">${Object.entries(LAYERS).map(([k, v]) => `<label><input type="checkbox" data-l="${k}" checked><span style="color:#${v.color.toString(16).padStart(6, '0')}">■</span> ${v.name}</label>`).join('')}</div>
      <div class="ed-row"><button data-a="add-floors">+ Vùng đi</button><button data-a="add-obstacles">+ Vật cản</button><button data-a="add-front">+ Vùng mờ</button><button data-a="del">Xoá hình đang chọn</button><button data-a="undo">Hoàn tác</button><button data-a="save" class="ed-save">Lưu vào layout.json</button></div>
      <div class="ed-help">Kéo điểm để sửa · bấm lên cạnh để thêm điểm · chuột phải (hoặc Alt+bấm) lên điểm để xoá · bấm trong hình để chọn · Cmd/Ctrl+Z hoàn tác</div>
      <div id="ed-status"></div>`;
    d.addEventListener('pointerdown', (e) => e.stopPropagation());
    d.querySelectorAll('input[data-l]').forEach(cb => cb.onchange = () => { this.show[cb.dataset.l] = cb.checked; if (this.sel && !this.show[this.sel.layer]) this.sel = null; this.draw(); });
    d.querySelectorAll('button').forEach(b => b.onclick = () => this.action(b.dataset.a, b));
    document.body.appendChild(d); this.panelEl = d; this.statusEl = d.querySelector('#ed-status'); this.status();
    window.addEventListener('beforeunload', (e) => { if (this.dirty) { e.preventDefault(); e.returnValue = ''; } });
  }
  action(a, b) {
    if (a === 'mode') { this.editing = !this.editing; this.sel = null; this.drag = null; b.textContent = this.editing ? 'Đang chỉnh · bấm để đi thử' : 'Đang đi thử · bấm để chỉnh'; this.draw(); }
    if (a === 'fold') { const f = this.panelEl.classList.toggle('folded'); b.textContent = f ? 'Mở bảng' : 'Thu gọn'; }
    if (a.startsWith('add-')) this.add(a.slice(4));
    if (a === 'del') this.deleteSel();
    if (a === 'undo' && this.undo.length) this.restore(this.undo.pop());
    if (a === 'save') this.save();
    this.status();
  }
  async save() {
    this.statusEl.textContent = 'Đang lưu…';
    try { const r = await fetch('/api/layout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this.L) }); const j = await r.json(); if (!j.ok) throw new Error(j.error || r.status); this.dirty = false; this.msg = 'Đã lưu vào assets/layout.json (bản cũ: layout.prev.json)'; }
    catch (e) { this.msg = 'Không lưu được: ' + e.message + ' — hãy chạy game bằng "python3 server.py" thay cho http.server'; }
    this.status();
  }
  status() {
    if (!this.statusEl) return; const c = this.cursor ? `x ${this.cursor[0]}, y ${this.cursor[1]}` : '';
    this.statusEl.textContent = [c, this.sel ? 'Đang chọn: ' + this.sel.name : '', this.dirty ? '● chưa lưu' : '', this.msg || ''].filter(Boolean).join('  ·  ');
  }
}
