// Walkable-area test + grid A* path finding on the 1448x1086 world.
export function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > y) !== (p[j][1] > y) && x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; }
export const inRect = (x, y, r) => x >= r[0] && y >= r[1] && x <= r[2] && y <= r[3];
export class Nav {
  constructor(layout, cell = 8, foot = [10, 5]) {
    this.L = layout; this.foot = foot; this.gates = {}; this.openGates = new Set(); this.blocks = {}; this.closedBlocks = new Set(); this.cell = cell; this.W = layout.world[0]; this.H = layout.world[1]; this.cols = Math.ceil(this.W / cell); this.rows = Math.ceil(this.H / cell);
    this.ok = new Uint8Array(this.cols * this.rows); this.rebuild();
  }
  rebuild() { const cell = this.cell; for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this.ok[r * this.cols + c] = this.walkable(c * cell + cell / 2, r * cell + cell / 2) ? 1 : 0; }
  addGate(id, polys, open) { this.gates[id] = polys; this.setGate(id, open); }
  setGate(id, open) { if (open) { this.openGates.add(id); this.closedBlocks.delete(id); } else { this.openGates.delete(id); if (this.blocks[id]) this.closedBlocks.add(id); } this.rebuild(); }
  addBlock(id, polys) { this.blocks[id] = polys; }   // walls of a door: solid while it is closed
  inGate(id, x, y) { return (this.gates[id] || []).some(p => inPoly(x, y, p)); }
  walkable(x, y) { const rx = this.foot[0], ry = this.foot[1]; return this.point(x, y) && this.point(x - rx, y) && this.point(x + rx, y) && this.point(x, y - ry) && this.point(x, y + ry); }
  point(x, y) {
    if (!((this.L.floors || [this.L.floor]).some(f => inPoly(x, y, f)) || [...this.openGates].some(id => this.gates[id].some(p => inPoly(x, y, p))))) return false;
    for (const id of this.closedBlocks) if (this.blocks[id].some(p => inPoly(x, y, p))) return false;
    for (const o of this.L.obstacles) {
      if (o.rect && inRect(x, y, o.rect)) return false;
      if (o.poly && inPoly(x, y, o.poly)) return false;
      if (o.ellipse) { const [cx, cy, rx, ry] = o.ellipse; if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) return false; }
    }
    return true;
  }
  nearest(x, y) {
    if (this.walkable(x, y)) return [x, y];
    let best = null, bd = 1e9;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.ok[r * this.cols + c]) { const px = c * this.cell + this.cell / 2, py = r * this.cell + this.cell / 2, d = (px - x) ** 2 + (py - y) ** 2; if (d < bd) { bd = d; best = [px, py]; } }
    return best || [x, y];
  }
  clear(x0, y0, x1, y1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4); for (let i = 1; i <= n; i++) if (!this.walkable(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false; return true; }
  path(sx, sy, tx, ty) {
    [tx, ty] = this.nearest(tx, ty); if (this.clear(sx, sy, tx, ty)) return [[tx, ty]];
    const cell = this.cell, C = this.cols, key = (c, r) => r * C + c, sc = Math.floor(sx / cell), sr = Math.floor(sy / cell); let tc = Math.floor(tx / cell), tr = Math.floor(ty / cell);
    const okc = (c, r) => c >= 0 && r >= 0 && c < C && r < this.rows && this.ok[key(c, r)];
    const fix = (c, r) => { if (okc(c, r)) return [c, r]; let best = null, bd = 1e9; for (let dc = -3; dc <= 3; dc++) for (let dr = -3; dr <= 3; dr++) if (okc(c + dc, r + dr) && dc * dc + dr * dr < bd) { bd = dc * dc + dr * dr; best = [c + dc, r + dr]; } return best || [c, r]; };
    [tc, tr] = fix(tc, tr); const [fc, fr] = fix(sc, sr);
    const open = [[0, fc, fr]], g = new Map([[key(fc, fr), 0]]), came = new Map(), done = new Set();
    while (open.length) {
      open.sort((a, b) => a[0] - b[0]); const [, c, r] = open.shift(), k = key(c, r); if (done.has(k)) continue; done.add(k);
      if (c === tc && r === tr) break;
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
        if (!dc && !dr) continue; const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= C || nr >= this.rows || !this.ok[key(nc, nr)]) continue;
        if (dc && dr && (!this.ok[key(c + dc, r)] || !this.ok[key(c, r + dr)])) continue;
        const ng = g.get(k) + (dc && dr ? 1.414 : 1), nk = key(nc, nr);
        if (!g.has(nk) || ng < g.get(nk)) { g.set(nk, ng); came.set(nk, k); open.push([ng + Math.hypot(nc - tc, nr - tr), nc, nr]); }
      }
    }
    let k = key(tc, tr); if (!came.has(k) && k !== key(fc, fr)) return [];
    const pts = []; while (k !== undefined && k !== key(fc, fr)) { pts.unshift([(k % C) * cell + cell / 2, Math.floor(k / C) * cell + cell / 2]); k = came.get(k); }
    pts.push([tx, ty]);
    const out = []; let ax = sx, ay = sy, i = 0;                      // string pulling
    while (i < pts.length) { let j = pts.length - 1; while (j > i && !this.clear(ax, ay, pts[j][0], pts[j][1])) j--; out.push(pts[j]); [ax, ay] = pts[j]; i = j + 1; }
    return out;
  }
}
