import { Nav, inPoly, inRect } from '../nav.js';
import { S, isOn, setOn } from '../state.js';
import { sfx } from '../audio.js';
import { Editor } from '../editor.js';
import { outlineTexture, frameRegion, bubbleTexture, dotTexture, notWood } from '../fx.js';
import { Story } from '../story/story.js';

const DEBUG = /[?&]debug/.test(location.search);
// screen -> floor axes of the 2:1 projection: u grows towards the viewer's right (+X), v towards the back (+Y)
const isoU = (x, y) => (x / 2 + y) / 2, isoV = (x, y) => (x / 2 - y) / 2;
const SCALE = 3;                                          // hero art px = 3 screen px: 49 art px = 147 px = 1.55 m (95 px per metre)
// Mewmew-style movement: the hero steps cell by cell on a 20 cm floor grid, 4 directions, one cell per 150 ms
const CELL = 0.2, OFF = 0.5, STEP_MS = 150;
const DIRS = { right: [1, 0], left: [-1, 0], up: [0, 1], down: [0, -1] };   // +X runs down-right on screen, +Y up-right

export class RoomScene extends Phaser.Scene {
  constructor() { super('Room'); }
  create() {
    this.L = this.cache.json.get('layout'); this.A = this.cache.json.get('anim');
    if (Object.keys(this.A).some(k => !this.textures.exists('anim_' + k))) { this.time.delayedCall(300, () => this.scene.restart()); return; }   // assets still loading
    this.nav = new Nav(this.L);
    this.add.image(-320, -320, 'garden').setOrigin(0).setDepth(-1);   // sunny garden behind the house, with a margin for wide screens
    this.add.image(0, 0, 'roomBase').setOrigin(0).setDepth(0);
    this.makeAmbient();
    this.walls = this.L.fadeWalls.map(w => ({ id: w.id, group: w.group, over: w.over, img: this.add.image(w.x, w.y, w.key).setOrigin(0).setDepth(2) })); this.wallA = 1; this.frontA = 1; this.blind = false; this.behindFront = false;
    this.pieces = this.L.pieces.map(p => { const img = this.add.image(p.x, p.y, 'piece_' + p.id).setOrigin(0).setDepth(2), us = p.foot.map(([x, y]) => isoU(x, y)), vs = p.foot.map(([x, y]) => isoV(x, y));
      return { id: p.id, bb: [p.x, p.y, p.x + img.width, p.y + img.height], u1: Math.max(...us), v0: Math.min(...vs), a: 1, img }; });
    this.makeOccluders(); this.makeHero(); this.makeObjects();
    this.label = this.add.text(0, 0, '', { fontFamily: 'Pixelify Sans, monospace', fontSize: '22px', color: '#fdfae6', backgroundColor: '#371506', padding: { x: 6, y: 2 } }).setOrigin(0.5, 1).setDepth(9500).setVisible(false);
    this.queue = []; this.dots = []; this.pending = null; this.stepping = false; this.stillT = 1; this.lastLabel = '';
    this.makeFeedback();
    this.cursors = this.input.keyboard.addKeys({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D', e: 'E', space: 'SPACE' });
    this.input.on('pointerdown', (p) => this.onTap(p)); this.input.on('pointermove', (p) => this.onHover(p)); this.input.on('gameout', () => this.hoverG.clear());
    this.scale.on('resize', () => this.fit()); this.fit();
    this.modal = false;
    if (DEBUG) this.editor = new Editor(this); else if (!/[?&]sandbox/.test(location.search)) this.story = new Story(this);   // ?sandbox = free roaming without the story
  }
  fit() {
    const cam = this.cameras.main, vw = this.scale.width, vh = this.scale.height, W = this.L.world[0], H = this.L.world[1];
    const fit = Math.min(vw / W, vh / H); this.follow = vw < 720 || vh < 520;
    cam.setZoom(this.follow ? Math.max(fit, vw / 760) : fit);
    if (this.follow) { cam.setBounds(0, 0, W, H); cam.startFollow(this.hero, true, 0.12, 0.12); } else { cam.stopFollow(); cam.setBounds(-1e5, -1e5, 2e5, 2e5); cam.centerOn(W / 2, H / 2); }
  }
  // ---- ambient motion: dappled sun on the floor and porch, swaying bush, dust motes in the light
  makeAmbient() {
    const mk = (key, rate, seq, depth) => { const m = this.A[key]; this.anims.create({ key: 'amb-' + key, frames: seq.map(f => ({ key: 'anim_' + key, frame: f })), frameRate: rate, repeat: -1 }); return this.add.sprite(m.x, m.y, 'anim_' + key, 0).setOrigin(0).setDepth(depth).play('amb-' + key); };
    this.sun = mk('sun', 2.2, [0, 1, 2, 3, 2, 1], 1); this.bush = mk('bush', 5, [0, 1, 2, 3, 4, 5, 6, 7], 1);
    this.tweens.add({ targets: this.sun, alpha: { from: 0.78, to: 1 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const g = this.make.graphics({ x: 0, y: 0, add: false }); g.fillStyle(0xfdfae6, 1).fillRect(0, 0, 4, 4); g.generateTexture('mote', 4, 4); g.destroy();
    for (let i = 0; i < 16; i++) {        // dust motes drifting up through the light
      const m = this.add.image(0, 0, 'mote').setDepth(7000).setAlpha(0), go = () => { m.setPosition(640 + Math.random() * 300, 580 + Math.random() * 200).setAlpha(0); this.tweens.add({ targets: m, x: m.x + (Math.random() * 30 - 15), y: m.y - 30 - Math.random() * 40, alpha: { from: 0, to: 0.8 }, duration: 3000 + Math.random() * 3000, yoyo: true, hold: 500, onComplete: go }); };
      this.time.delayedCall(Math.random() * 6000, go);
    }
  }
  makeOccluders() {
    const src = this.textures.get('roomBase').getSourceImage();
    for (const o of this.L.occluders || []) {
      const xs = o.poly.map(p => p[0]), ys = o.poly.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
      g.beginPath(); o.poly.forEach(([x, y], i) => i ? g.lineTo(x - x0, y - y0) : g.moveTo(x - x0, y - y0)); g.closePath(); g.clip(); g.drawImage(src, -x0, -y0);
      this.textures.addCanvas('occ-' + o.id, cv); this.add.image(x0, y0, 'occ-' + o.id).setOrigin(0).setDepth(o.baseY - 0.5);
    }
  }
  // hero = chibi sprite sheets (tools/tao_nhan_vat_chibi.py): 36 x 56 art px frames, rows up / left / down / right,
  // walk = 4 frames (one cycle per 4 grid steps), idle = 4 frames (breathing + blink)
  makeHero() {
    if (!this.anims.exists('walk-down')) ['up', 'left', 'down', 'right'].forEach((d, row) => {
      this.anims.create({ key: 'walk-' + d, frames: this.anims.generateFrameNumbers('hero_walk', { start: row * 4, end: row * 4 + 3 }), frameRate: 6.7, repeat: -1 });
      this.anims.create({ key: 'idle-' + d, frames: this.anims.generateFrameNumbers('hero_idle', { frames: [0, 1, 2, 1, 0, 0, 1, 2, 1, 3].map(f => row * 4 + f) }), frameRate: 4, repeat: -1 });
    });
    const st = this.L.start || [760, 600]; this.cell = this.nearestCell(...this.cellAt(...st), 4) || this.cellAt(...st); const [sx, sy] = this.cellXY(...this.cell);
    this.shadow = this.add.ellipse(sx, sy, 72, 22, 0x371506, 0.35).setDepth(1);
    this.facing = 'down'; this.hero = this.add.sprite(sx, sy, 'hero_idle', 8).setOrigin(0.5, 52 / 56).setScale(SCALE).setDepth(sy);
  }
  // ---- interactive objects: doors (swing), fan (spinning blades), desk lamp (glow)
  makeObjects() {
    this.obj = {}; const glow = this.make.graphics({ x: 0, y: 0, add: false });
    for (let r = 128; r > 0; r -= 4) glow.fillStyle(0xffc866, 0.012 + (1 - r / 128) * 0.012).fillCircle(128, 128, r);
    glow.generateTexture('glow', 256, 256); glow.destroy();
    for (const o of this.L.objects) {
      if (o.type === 'door' || o.type === 'window') setOn(o.id, false);   // every door and window starts closed
      const st = { def: o, on: isOn(o.id), busy: false }; if (o.block) this.nav.addBlock(o.id, o.block); if (o.gate) this.nav.addGate(o.id, o.gate, st.on);
      if (o.anim) {
        const m = this.A[o.anim], key = 'anim_' + o.anim, n = m.frames, fwd = [...Array(n).keys()];
        if (o.type === 'door') { this.anims.create({ key: o.id + '-open', frames: fwd.map(f => ({ key, frame: f })), frameRate: 14 }); this.anims.create({ key: o.id + '-close', frames: fwd.slice().reverse().map(f => ({ key, frame: f })), frameRate: 14 }); }
        if (o.type === 'tap') this.anims.create({ key: 'tap-run', frames: fwd.map(f => ({ key, frame: f })), frameRate: 10, repeat: -1 });
        if (o.type === 'fan') this.anims.create({ key: 'fan-spin', frames: fwd.map(f => ({ key, frame: f })), frameRate: 18, repeat: -1 });
        st.sprite = this.add.sprite(m.x, m.y, key, o.type === 'door' && st.on ? n - 1 : 0).setOrigin(0).setDepth(o.depth || (o.baseY ? o.baseY - 0.4 : 3)).setVisible(o.type === 'door' ? st.on : st.on);
        if (o.type === 'fan' && st.on) st.sprite.play('fan-spin');
      }
      if (o.type === 'window') {
        const mk = (k, d) => { const m = this.A[k]; return this.add.sprite(m.x, m.y, 'anim_' + k, 0).setOrigin(0).setDepth(d); };
        st.panes = [mk('win_l', 3.1), mk('win_r', 3.1)].map(p => p.setVisible(st.on)); st.curt = [mk('curt_l', 3), mk('curt_r', 3)];
        const fwd = [...Array(this.A.win_l.frames).keys()];
        for (const k of ['win_l', 'win_r']) { this.anims.create({ key: k + '-open', frames: fwd.map(f => ({ key: 'anim_' + k, frame: f })), frameRate: 12 }); this.anims.create({ key: k + '-close', frames: fwd.slice().reverse().map(f => ({ key: 'anim_' + k, frame: f })), frameRate: 12 }); }
        for (const k of ['curt_l', 'curt_r']) this.anims.create({ key: k + '-sway', frames: [...Array(this.A[k].frames).keys()].map(f => ({ key: 'anim_' + k, frame: f })), frameRate: 5, repeat: -1 });
        if (st.on) { st.panes.forEach((p, i) => p.setFrame(this.A.win_l.frames - 1)); st.curt.forEach((c, i) => c.play(['curt_l', 'curt_r'][i] + '-sway')); }
      }
      if (o.type === 'tap') { st.sprite.setVisible(true).setAlpha(0); if (st.on) st.sprite.play('tap-run'); }
      if (o.type === 'lamp') { const [gx, gy, gr] = o.glow; st.sprite = this.add.image(gx, gy, 'glow').setScale(gr / 64).setBlendMode(Phaser.BlendModes.ADD).setDepth(8000).setAlpha(st.on ? 0.9 : 0); }
      this.obj[o.id] = st;
    }
  }
  toggle(id) {
    if (this.story && this.story.onUse(id)) return;
    const st = this.obj[id], o = st.def; if (st.busy || o.type === 'story') return;
    if (st.on && o.gate && !this.stepOutOfGate(id)) { this.say('Someone is standing in the doorway.'); return; }
    st.on = !st.on; setOn(id, st.on); if (o.gate) this.nav.setGate(id, st.on);
    if (o.type === 'door') { st.busy = true; st.sprite.setVisible(true); sfx.door(st.on); st.sprite.play(o.id + (st.on ? '-open' : '-close')); st.sprite.once('animationcomplete', () => { st.busy = false; if (!st.on) st.sprite.setVisible(false); }); }
    if (o.type === 'fan') { sfx.click(); if (st.on) { st.sprite.setVisible(true).play('fan-spin'); sfx.fan(true); } else { st.sprite.stop().setVisible(false); sfx.fan(false); } }
    if (o.type === 'window') { st.busy = true; sfx.door(st.on); st.panes.forEach((p, i) => { p.setVisible(true).play(['win_l', 'win_r'][i] + (st.on ? '-open' : '-close')); }); st.panes[0].once('animationcomplete', () => { st.busy = false; if (!st.on) st.panes.forEach(p => p.setVisible(false)); });
      st.curt.forEach((c, i) => { if (st.on) c.play(['curt_l', 'curt_r'][i] + '-sway'); else c.stop().setFrame(0); }); }
    if (o.type === 'tap') { sfx.water(); if (st.on) st.sprite.play('tap-run'); else st.sprite.stop(); }
    if (o.type === 'lamp') { sfx.click(); this.tweens.add({ targets: st.sprite, alpha: st.on ? 0.9 : 0, duration: 260 }); }
    if (this.story) this.story.onToggled(id, st.on);
  }
  // closing a door while the hero stands in its doorway: step the hero out to the nearest spot that stays walkable once it is shut
  stepOutOfGate(id) {
    const h = this.hero; if (!this.nav.inGate(id, h.x, h.y)) return true;
    this.nav.setGate(id, false); if (this.cellOk(...this.cell) && !this.stepping) return true;
    const c = this.nearestCell(...this.cell, 4); if (!c) { this.nav.setGate(id, true); return false; }
    this.queue = []; this.showDots(); this.tweens.killTweensOf(h); this.stepping = false; this.cell = c;
    const [x, y] = this.cellXY(...c); this.tweens.add({ targets: h, x, y, duration: 160 }); return true;
  }
  say(t) { this.popLabel(t); this.label.setPosition(this.hero.x, this.hero.y - 158); this.time.delayedCall(1600, () => { if (this.lastLabel === t) this.popLabel(''); }); }
  hotspotAt(x, y) { return this.L.objects.find(o => o.active !== false && (o.when !== 'blind' || this.blind) && inRect(x, y, o.rect)); }
  label_of(o) { return this.obj[o.id].on ? o.labels[1] : o.labels[0]; }
  // hero position in metres on the floor plane (inverse of the layout projection) -> which walls must fade
  metres() { return this.toMetres(this.hero.x, this.hero.y); }
  toMetres(px, py) { const { O, EX } = this.L.proj, a = (px - O[0]) / EX[0], b = (py - O[1]) / EX[1]; return [(a + b) / 2, (a - b) / 2]; }
  // ---- floor grid: cell (i, j) is centred on ((i + OFF) * CELL, (j + OFF) * CELL) metres
  proj(x, y) { const { O, EX, EY } = this.L.proj; return [O[0] + x * EX[0] + y * EY[0], O[1] + x * EX[1] + y * EY[1]]; }
  cellXY(i, j) { return this.proj((i + OFF) * CELL, (j + OFF) * CELL); }
  cellAt(px, py) { const [x, y] = this.toMetres(px, py); return [Math.round(x / CELL - OFF), Math.round(y / CELL - OFF)]; }
  cellOk(i, j) { const [x, y] = this.cellXY(i, j); return this.nav.walkable(x, y); }
  cellPoly(i, j, k = 0.42) { const x = (i + OFF) * CELL, y = (j + OFF) * CELL, d = CELL * k; return [[x - d, y - d], [x + d, y - d], [x + d, y + d], [x - d, y + d]].map(([a, b]) => new Phaser.Math.Vector2(...this.proj(a, b))); }
  nearestCell(i, j, r = 3) { let best = null, bd = 1e9; for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (a * a + b * b < bd && this.cellOk(i + a, j + b)) { bd = a * a + b * b; best = [i + a, j + b]; } return best; }
  route(from, to) {   // breadth-first search over the 4-neighbour cells; returns the cells after `from`
    const key = (c) => c[0] + ',' + c[1], prev = new Map([[key(from), null]]), q = [from];
    while (q.length && prev.size < 5000) {
      const c = q.shift();
      if (c[0] === to[0] && c[1] === to[1]) { const out = []; for (let cur = c; prev.get(key(cur)); cur = prev.get(key(cur))) out.unshift(cur); return out; }
      for (const [a, b] of Object.values(DIRS)) { const n = [c[0] + a, c[1] + b], k = key(n); if (!prev.has(k) && this.cellOk(...n)) { prev.set(k, c); q.push(n); } }
    }
    return null;
  }
  // furniture is drawn over the hero when the hero stands behind it (no fading)
  updatePieces(dt) {
    const hx = this.hero.x, hy = this.hero.y, body = [hx - 36, hy - 150, hx + 36, hy];
    for (const p of this.pieces) {
      // the piece hides the hero unless the hero stands in front of its footprint (further +X or further -Y)
      const overlap = body[0] < p.bb[2] && body[2] > p.bb[0] && body[1] < p.bb[3] && body[3] > p.bb[1], front = isoU(hx, hy) >= p.u1 || isoV(hx, hy) <= p.v0, behind = overlap && !front;
      p.a = 1; p.img.setAlpha(1).setDepth(behind ? this.hero.y + 0.5 : 2); p.behind = behind;
    }
    const fan = this.pieces.find(p => p.id === 'fan'), fs = this.obj.fan && this.obj.fan.sprite; if (fan && fs) fs.setDepth(fan.behind ? this.hero.y + 0.6 : 3).setAlpha(this.obj.fan.on ? fan.a : 0);
  }
  updateWalls(dt) {
    const [x, y] = this.metres(), inWC = x < 1.12 && y > 3.2, inPass = x >= 1.0 && x < 2.45 && y > 3.1, approach = (x > 0.85 && x < 2.45 && y > 3.0) || (x < 1.2 && y > 2.95);
    this.blind = inWC || inPass; const rear = (this.blind || approach) ? 0.2 : 1; this.wallA += (rear - this.wallA) * Math.min(1, dt * 7);
    // front wall: each segment fades only while the hero stands behind it (inside the strip along the wall) and overlaps it
    const hx = this.hero.x, behindFront = this.L.frontZone.some(p => inPoly(hx, this.hero.y, p)); this.behindFront = behindFront; this.wallState = this.wallState || {};
    for (const w of this.walls) {
      let a, d;
      if (w.group === 'front') { const bb = w.img.getBounds(), hit = behindFront && hx + 36 > bb.x && hx - 36 < bb.right; w.fa = w.fa ?? 1; w.fa += ((hit ? 0.25 : 1) - w.fa) * Math.min(1, dt * 7); a = w.fa; d = hit || (behindFront && w.fa < 0.95) ? 8500 : 2; }
      else { a = this.wallA; d = (this.blind ? 8500 : 2) + (w.over ? 0.2 : 0); }   // 'over' pieces (beam + post) stay above the WC door sprite
      w.img.setAlpha(a).setDepth(d); this.wallState[w.id] = { a, d };
    }
    for (const st of Object.values(this.obj)) if (st.def.follow) { const ws = this.wallState[st.def.follow] || { a: 1, d: 2 }, base = st.def.depth || 2;
      if (st.sprite) st.sprite.setAlpha(Math.min(st.on || st.busy ? 1 : 0, ws.a)).setDepth((ws.d > 100 ? ws.d : base) + 0.1);
      for (const s2 of [...(st.panes || []), ...(st.curt || [])]) s2.setAlpha(ws.a).setDepth((ws.d > 100 ? ws.d : base) + 0.1); }
  }
  rebuildNav() { this.nav = new Nav(this.L); for (const o of this.L.objects) if (o.block) this.nav.addBlock(o.id, o.block); for (const o of this.L.objects) if (o.gate) this.nav.addGate(o.id, o.gate, this.obj[o.id] && this.obj[o.id].on); }
  onTap(p) {
    if ((this.editor && this.editor.editing) || this.modal) return;
    const wx = p.worldX, wy = p.worldY;
    if (this.story && this.story.craneHit(wx, wy)) { this.story.hint(); return; }
    const o = this.hotspotAt(wx, wy);
    if (!o) this.walkTo(wx, wy); else if (this.isNear(o)) this.toggle(o.id); else this.goTo(o);
  }
  // an object can only be used from its standing cells: the walkable grid cells at its standing points (layout objects[].ats)
  standCells(o) { return o.ats.map(a => this.nearestCell(...this.cellAt(...a), 2)).filter(Boolean); }
  isNear(o) { return o.active !== false && (o.when !== 'blind' || this.blind) && this.standCells(o).some(c => c[0] === this.cell[0] && c[1] === this.cell[1]); }
  goTo(o) {   // walk to the closest standing cell of the object, then use it
    let best = null; for (const c of this.standCells(o)) { const r = this.route(this.cell, c); if (r && (!best || r.length < best.length)) best = r; }
    if (!best) { this.say("Can't get any closer."); return; }
    this.queue = best; this.pending = o; this.showDots();
  }
  walkTo(x, y) {
    let to = this.cellAt(x, y); if (!this.cellOk(...to)) to = this.nearestCell(...to, 2);
    const r = to && this.route(this.cell, to); this.pending = null; if (!r) { this.say("Can't walk there."); return; }
    this.queue = r; this.showDots();
  }
  stepTo(c) {
    if (!this.cellOk(...c)) { this.queue = []; this.showDots(); return; }   // a door closed on the way
    const [i, j] = this.cell; this.faceDir(c[0] - i, c[1] - j); this.cell = c; this.stepping = true;
    if (this.dots.length) this.dots.shift().destroy();
    this.stepN = (this.stepN || 0) + 1; if (this.stepN % 2) sfx.step();
    const [x, y] = this.cellXY(...c); this.tweens.add({ targets: this.hero, x, y, duration: STEP_MS, ease: 'Linear', onComplete: () => { this.stepping = false; } });
  }
  // ---- feedback in the style of the reference: hover tile, path dots, outline + "…" bubble on the nearby object, popping labels
  makeFeedback() {
    bubbleTexture(this); dotTexture(this);
    this.anims.create({ key: 'bubble', frames: [0, 1, 2, 3].map(f => ({ key: 'bubble', frame: f })), frameRate: 4, repeat: -1 });
    this.hoverG = this.add.graphics().setDepth(1.5);
    this.bubble = this.add.sprite(0, 0, 'bubble', 0).setOrigin(0.5, 1).setDepth(9000).setVisible(false).play('bubble');
    const piece = (id) => this.L.pieces.find(p => p.id === id);
    this.hl = {};
    for (const o of this.L.objects) {
      const m = o.anim && this.A[o.anim], keys = [];
      if (o.type === 'door') for (const f of [0, m.frames - 1]) keys.push(outlineTexture(this, `hl-${o.id}-${f}`, [frameRegion(this, 'anim_' + o.anim, f, m.x, m.y)]));
      if (o.type === 'window') for (const f of [0, this.A.win_l.frames - 1]) keys.push(outlineTexture(this, `hl-${o.id}-${f}`, ['win_l', 'win_r'].map(k => frameRegion(this, 'anim_' + k, f, this.A[k].x, this.A[k].y))));
      if (o.type === 'fan') { const p = piece('fan'); keys.push(outlineTexture(this, 'hl-fan', [{ ...frameRegion(this, 'piece_fan', '__BASE', p.x, p.y), keep: notWood }])); }
      if (o.type === 'lamp') { const p = piece('desk'), [x0, y0, x1, y1] = o.rect; keys.push(outlineTexture(this, 'hl-lamp', [{ ...frameRegion(this, 'piece_desk', '__BASE', p.x, p.y, [x0 - p.x, y0 - p.y, x1 - x0, y1 - y0]), keep: notWood, close: 5 }])); }
      if (keys.length) this.hl[o.id] = keys.map(k => { const c = this.textures.get(k).customData; return this.add.image(c.x, c.y, k).setOrigin(0).setDepth(3.05).setVisible(false); });
    }
  }
  onHover(p) {
    const g = this.hoverG.clear(); if (this.editor && this.editor.editing) return;
    const o = this.hotspotAt(p.worldX, p.worldY); this.game.canvas.style.cursor = o ? 'pointer' : 'default'; if (o) return;
    const c = this.cellAt(p.worldX, p.worldY); if (!this.cellOk(...c)) return;
    const poly = this.cellPoly(...c); g.fillStyle(0x371506, 0.4).fillPoints(poly, true).lineStyle(2, 0xfdfae6, 0.5).strokePoints(poly, true);
  }
  showDots() {
    this.dots.forEach(d => d.destroy());
    this.dots = this.queue.map((c, n) => { const [x, y] = this.cellXY(...c), last = n === this.queue.length - 1, d = this.add.image(x, y, 'pathdot').setDepth(1.6).setScale(0);
      this.tweens.add({ targets: d, scale: last ? 1.5 : 0.8, duration: 160, delay: Math.min(n * 12, 300), ease: 'Back.easeOut' }); return d; });
  }
  updateFeedback(near) {
    if (this.editor && this.editor.editing) near = null;
    for (const [id, imgs] of Object.entries(this.hl)) {
      const st = this.obj[id], show = near && near.id === id, pc = id === 'fan' ? this.pieces.find(p => p.id === 'fan') : id === 'lamp' ? this.pieces.find(p => p.id === 'desk') : null;
      const ws = st.def.follow && this.wallState && this.wallState[st.def.follow], d = pc && pc.behind ? pc.img.depth + 0.01 : ws && ws.d > 100 ? ws.d + 0.2 : 3.05;
      imgs.forEach((im, k) => im.setVisible(show && imgs.length > 1 ? (k === 1) === !!st.on : show).setDepth(d));
    }
    if (near !== this.nearShown) {
      this.nearShown = near; this.tweens.killTweensOf(this.bubble);
      if (near) { const im = this.hl[near.id] ? this.hl[near.id][0] : null, x = im ? im.x + im.width / 2 : (near.rect[0] + near.rect[2]) / 2, y = (im ? im.y : near.rect[1]) - 6;
        this.bubble.setPosition(x, y).setVisible(true).setScale(0); this.tweens.add({ targets: this.bubble, scale: 1, duration: 220, ease: 'Back.easeOut' }); }
      else this.bubble.setVisible(false);
    }
  }
  popLabel(text) {
    if (text === this.lastLabel) return; this.lastLabel = text; this.tweens.killTweensOf(this.label);
    if (!text) { this.label.setVisible(false); return; }
    this.label.setText(text).setVisible(true).setScale(0); this.tweens.add({ targets: this.label, scale: 1, duration: 200, ease: 'Back.easeOut' });
  }
  nearObject() { return this.L.objects.find(o => this.isNear(o)) || null; }
  update(t, dt) {
    dt = Math.min(dt, 50) / 1000; const k = this.cursors;
    const held = k.up.isDown || k.w.isDown ? 'up' : k.down.isDown || k.s.isDown ? 'down' : k.left.isDown || k.a.isDown ? 'left' : k.right.isDown || k.d.isDown ? 'right' : null;
    if (!this.stepping && !this.modal) {
      if (held) { this.pending = null; if (this.queue.length) { this.queue = []; this.showDots(); } const [a, b] = DIRS[held], n = [this.cell[0] + a, this.cell[1] + b]; if (this.cellOk(...n)) this.stepTo(n); else this.faceDir(a, b); }
      else if (this.queue.length) this.stepTo(this.queue.shift());
      else if (this.pending) { const o = this.pending; this.pending = null; if (this.isNear(o)) this.toggle(o.id); }   // arrived next to the tapped object
    }
    const moving = this.stepping || this.queue.length > 0; this.playWalk(moving, dt);
    if (!this.modal && (Phaser.Input.Keyboard.JustDown(k.e) || Phaser.Input.Keyboard.JustDown(k.space))) { const o = this.nearObject(); if (o) this.toggle(o.id); }
    this.updateWalls(dt); this.updatePieces(dt); this.hero.setDepth(this.hero.y); this.shadow.setPosition(this.hero.x, this.hero.y - 2).setDepth(this.hero.y - 0.6);
    const near = this.modal ? null : this.nearObject(); this.updateFeedback(near);   // no prompts during story scenes
    if (this.label.visible && !near && this.lastLabel.startsWith('E · ')) this.popLabel('');
    if (near && !moving) this.popLabel('E · ' + this.label_of(near)); else if (moving && this.lastLabel.startsWith('E · ')) this.popLabel('');
    if (this.label.visible) this.label.setPosition(this.hero.x, this.hero.y - 158);
    if (this.story) this.story.update(dt);
  }
  // the 4 grid directions turn the LPC views by 45 degrees: +X (down-right) right, -X (up-left) left, +Y (up-right) up, -Y (down-left) down
  faceDir(a, b) { this.facing = a > 0 ? 'right' : a < 0 ? 'left' : b > 0 ? 'up' : 'down'; }
  playWalk(on, dt) {
    const cur = this.hero.anims.currentAnim?.key, playing = this.hero.anims.isPlaying;
    if (on) { this.stillT = 0; const key = 'walk-' + this.facing; if (cur !== key || !playing) this.hero.play(key, true); return; }
    this.stillT += dt;
    const ROW = { up: 0, left: 1, down: 2, right: 3 }[this.facing];
    if (this.stillT < 0.25) { if (playing && !(cur || '').startsWith('idle')) { this.hero.anims.stop(); this.hero.setTexture('hero_idle', ROW * 4); } }
    else if (cur !== 'idle-' + this.facing || !playing) this.hero.play('idle-' + this.facing);
  }
  drawDebug() {
    const g = this.add.graphics().setDepth(1e5); g.lineStyle(2, 0x00ff78, 1); for (const f of this.L.floors) g.strokePoints(f.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
    g.lineStyle(2, 0xff0000, 1); for (const o of this.L.obstacles) { if (o.rect) g.strokeRect(o.rect[0], o.rect[1], o.rect[2] - o.rect[0], o.rect[3] - o.rect[1]); if (o.ellipse) g.strokeEllipse(o.ellipse[0], o.ellipse[1], o.ellipse[2] * 2, o.ellipse[3] * 2); if (o.poly) g.strokePoints(o.poly.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true); }
    g.lineStyle(2, 0x0078ff, 1); for (const h of this.L.objects) { g.strokeRect(h.rect[0], h.rect[1], h.rect[2] - h.rect[0], h.rect[3] - h.rect[1]); for (const a of h.ats) g.fillStyle(0xffff00, 1).fillCircle(a[0], a[1], 5); for (const gp of h.gate || []) { g.lineStyle(2, 0x00ffff, 1); g.strokePoints(gp.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true); } }
  }
}
