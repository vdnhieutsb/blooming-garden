// Game-2 "A Letter at Midnight": a paper crane brings a letter from Hiếu, the fan blows it into five pieces, Hương finds them
// (mailbox -> blue box -> WC mirror -> suitcase "2010" -> under the bed), dawn breaks, the crane leads her into the garden
// where Hiếu waits with a giant bouquet. Quest objects get a white outline; the crane gives hints only when tapped.
import { say, talk, paper, showImage, Close, setHud, bars, caption, endCard, replayButton } from './ui.js';
import { outlineTexture, frameRegion } from '../fx.js';
import { sfx } from '../audio.js';
import { inRect } from '../nav.js';

const KEY = 'truoc-khi-troi-sang-story-v1';
const STEPS = ['door', 'mailbox', 'bluebox', 'mirror', 'suitcase', 'bed', 'garden', 'end'];
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// story objects in the room (world px): click rect, standing points
const OBJECTS = [
  { id: 'mailbox', step: 'mailbox', rect: [522, 912, 574, 994], ats: [[548, 1020], [504, 994], [592, 994]], label: 'Mailbox' },
  { id: 'bluebox', step: 'bluebox', rect: [986, 460, 1030, 502], ats: [[925, 515], [880, 556]], label: 'Blue box' },
  { id: 'suitcase', step: 'suitcase', rect: [1100, 452, 1212, 556], ats: [[1084, 470], [1060, 520]], label: 'Suitcase' },
  { id: 'bed', step: 'bed', rect: [350, 462, 624, 604], ats: [[640, 600], [600, 640], [520, 650]], label: 'Under the bed' },
  { id: 'bouquet', step: 'garden', rect: [1206, 760, 1294, 958], ats: [[1250, 985], [1186, 960], [1300, 985]], label: 'The bouquet' },
];
const MAILBOX = [548, 990], BOUQUET = [1250, 952], ANH_FROM = [1400, 905];
const TRAIL = [[505, 868], [492, 925], [520, 975], [610, 1010], [760, 1015], [900, 1000], [1040, 985], [1160, 965]];
const PIECES = {
  1: ['Hương,', 'the sea sleeps in a round blue box.', '>The heart opens it.'],
  2: ['Where you meet your own smile every morning,', '>warm water will tell you a secret.'],
  3: ['Our first trip is locked.', '>The code is the day you were born.'],
  4: ['The last piece sleeps in the dark,', '>under the place where you dream.', 'Take the light.'],
  5: ['Now come outside.', '— H.'],
};
const LETTER = ['Dear Hương,', 'Happy birthday — and happy 20/10. One day is never enough for you, so tonight you got two.',
  'Thank you for turning ordinary days into warm ones.',
  'I wish you a year full of sunlight, good coffee and reasons to laugh — and wherever we are, I want to be standing next to you.',
  'I love you.', '— Hiếu'];
const NOT_YET = {                                          // looking at a quest object before its turn
  mailbox: 'An old mailbox. Why would anyone post a letter at midnight?',
  bluebox: 'A round blue box... locked with a tiny heart-shaped keyhole.',
  suitcase: 'Our travel suitcase. It has a 4-digit lock, and I do not know the code.',
  bed: 'It is far too dark under the bed to see anything.',
};
const DONE = { mailbox: 'Empty now.', bluebox: 'Just tissue paper left inside.', suitcase: 'Only clothes in here now.', bed: 'Nothing else under there. Just dust and my slippers.' };
// B. the crane's hints come in three levels: 1 = the riddle in other words, 2 = the area (the crane circles over it),
// 3 = the exact object (the crane pecks it, and from then on it keeps a white outline)
const HINTS = {
  mailbox: ['One of the pieces flew out of the front door... I saw it!', 'It went down the steps, towards the stepping stones.', 'There! The mailbox by the stones.'],
  bluebox: ['"The colour of the sea"... and round, I think.', 'Somewhere on the shelves above the desk.', 'This round blue box! The heart key should fit.'],
  mirror: ['Where do you meet your own smile every morning?', 'The bathroom... but mirrors only speak when they are warm.', 'Try the hot tap at the sink!'],
  suitcase: ['Your first trip... and the day you were born.', 'The suitcase in the clothes nook. Its code is your birthday.', 'Your birthday is 20/10... Two, zero, one, zero!'],
  bed: ['Where do you dream every night?', 'Under your bed. It is dark, so use the flashlight.', 'Move the light slowly under the bed.'],
  garden: ['Follow the glowing petals!', 'Out of the door and along the stones.', 'To the pink tree in the garden!'],
};
const AREA = { mailbox: [520, 950], bluebox: [1000, 430], mirror: [800, 320], suitcase: [1150, 470], bed: [500, 520], garden: [1150, 880] };
const EXACT = { mailbox: [548, 930], bluebox: [1008, 470], mirror: [780, 360], suitcase: [1150, 470], bed: [600, 560], garden: [1250, 800] };
// A. what Hương is looking for right now (shown in the clue journal)
const GOALS = {
  mailbox: 'One piece flew out of the front door...', bluebox: 'Find the box with the colour of the sea.',
  mirror: 'Where I meet my own smile every morning... warm water.', suitcase: 'Open the suitcase of our first trip: the code is my birthday.',
  bed: 'Look in the dark, under the place where I dream.', garden: 'Follow the petals into the garden.',
};
// D. Hương thinks aloud near things that are easy to mistake for the answer (once each): [x, y, radius, thought]
const DECOYS = {
  mailbox: [[600, 700, 110, 'The piece flew out through the front door...'], [330, 660, 110, 'It went past the window... outside?']],
  bluebox: [[1110, 500, 90, 'Blue shirts... but they are not round.'], [600, 600, 120, 'A sea-coloured blanket... but it is not a box.'], [880, 556, 80, 'Something blue up on the shelf...?']],
  mirror: [[330, 660, 110, 'My reflection in the window... but the glass is cold.'], [880, 556, 90, 'The lamp is warm... but the clue said warm water.'], [850, 525, 70, 'The bathroom is right here.']],
  suitcase: [[650, 470, 100, 'The day I was born... my birthday. Twenty... ten.'], [520, 800, 100, 'Our first trip started at this door. Where did we keep the suitcase?']],
  bed: [[1084, 480, 90, 'The flashlight works. Now, where do I dream?'], [600, 640, 110, 'My bed... it is so dark underneath.']],
};
// F. a glint sometimes flashes where the piece is hiding
const GLINT = { mailbox: [548, 935], bluebox: [1008, 468], mirror: [770, 330], suitcase: [1150, 498], bed: [470, 600] };

export class Story {
  constructor(room) {
    this.r = room; this.load();
    if (/[?&]story=reset/.test(location.search)) this.s = { step: 0, items: [], pieces: 0, flags: {} };
    this.build(); this.restore(); this.run();
    replayButton(() => this.replay());
  }
  // 4. start over at any time (also from the end card)
  async replay(ask = true) {
    if (ask) { if (this.r.modal) return; this.r.modal = true; const yes = await say('Paper Crane', null, 'Start the story again from the very beginning?', ['Yes, replay', 'Not now']) === 0; this.r.modal = false; if (!yes) return; }
    this.s = { step: 0, items: [], pieces: 0, flags: {} }; this.save(); location.reload();
  }
  load() { try { this.s = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { this.s = null; } if (!this.s) this.s = { step: 0, items: [], pieces: 0, flags: {} }; }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch (e) { /* private mode */ } }
  get step() { return STEPS[this.s.step]; }
  has(i) { return this.s.items.includes(i); }
  give(i) { if (!this.has(i)) this.s.items.push(i); this.save(); this.hud(); }
  take(i) { this.s.items = this.s.items.filter(x => x !== i); this.save(); this.hud(); }
  hud() { setHud(this.s.pieces, this.s.items.filter(i => i !== 'photo'), () => this.journal(), this.s.step >= 1); }   // hidden until the letter has scattered
  async journal() {                                        // A. read every piece found so far + the current goal
    if (this.r.modal) return; this.r.modal = true; const lines = [];
    for (let n = 1; n <= this.s.pieces; n++) lines.push(...PIECES[n].filter(l => !l.startsWith('—')));
    if (!lines.length) lines.push('The wind blew five pieces of Hiếu\'s letter around the house.');
    if (GOALS[this.step]) lines.push('>Now: ' + GOALS[this.step]);
    await paper(lines, { title: `Clues · ${this.s.pieces} / 5`, hint: 'tap to close' }); this.r.modal = false;
  }
  advance() { this.s.step++; this.save(); this.refresh(); }

  // ---- scene objects ---------------------------------------------------------------------------------------------------
  build() {
    const r = this.r, sc = r;
    // night = a low-res darkness mask redrawn every frame with soft holes of light (hero, desk lamp, moonlit window), upscaled x6
    this.dark = 0.5; this.nm = sc.textures.exists('nightmask') ? sc.textures.get('nightmask') : sc.textures.createCanvas('nightmask', 375, 315);
    this.night = sc.add.image(-500, -500, 'nightmask').setOrigin(0).setScale(6).setDepth(8900);
    this.warm = sc.add.rectangle(-500, -500, 2500, 2200, 0xffb070, 0).setOrigin(0).setDepth(8901);
    this.mailbox = sc.add.image(MAILBOX[0], MAILBOX[1], 'st_mailbox').setOrigin(0.5, 31 / 32).setScale(2).setDepth(MAILBOX[1]);
    r.nav.blocks.mailbox = [[[536, 978], [560, 978], [566, 992], [530, 992]]]; r.nav.closedBlocks.add('mailbox'); r.nav.rebuild();
    this.bouquet = sc.add.image(BOUQUET[0], BOUQUET[1], 'st_bouquet').setOrigin(0.5, 97 / 98).setScale(2).setDepth(BOUQUET[1]).setVisible(false);
    this.anh = sc.add.sprite(ANH_FROM[0], ANH_FROM[1], 'anh_idle', 8).setOrigin(0.5, 52 / 56).setScale(3).setDepth(ANH_FROM[1]).setVisible(false);
    if (!sc.anims.exists('crane-idle')) {
      sc.anims.create({ key: 'crane-idle', frames: sc.anims.generateFrameNumbers('st_crane', { frames: [0, 1] }), frameRate: 2.5, repeat: -1 });
      sc.anims.create({ key: 'crane-fly', frames: sc.anims.generateFrameNumbers('st_crane', { frames: [4, 5, 6, 7] }), frameRate: 12, repeat: -1 });
      sc.anims.create({ key: 'crane-peck', frames: sc.anims.generateFrameNumbers('st_crane', { frames: [8, 9, 8, 9] }), frameRate: 6 });
      ['up', 'left', 'down', 'right'].forEach((d, row) => {
        sc.anims.create({ key: 'anh-walk-' + d, frames: sc.anims.generateFrameNumbers('anh_walk', { start: row * 4, end: row * 4 + 3 }), frameRate: 6.7, repeat: -1 });
        sc.anims.create({ key: 'anh-idle-' + d, frames: sc.anims.generateFrameNumbers('anh_idle', { frames: [0, 1, 2, 1, 0, 0, 1, 2, 1, 3].map(f => row * 4 + f) }), frameRate: 4, repeat: -1 });
      });
    }
    this.crane = sc.add.sprite(505, 905, 'st_crane', 0).setOrigin(0.5, 0.85).setScale(2).setVisible(false).play('crane-idle');
    this.craneMode = 'hidden';
    // story objects join the room's objects (tap / E / standing points / proximity label), active only on their step
    for (const o of OBJECTS) { const def = { ...o, type: 'story', labels: [o.label, o.label], active: false }; r.L.objects.unshift(def); r.obj[o.id] = { def, on: false }; }   // first: they win where they overlap (blue box vs desk lamp)
    if (!sc.textures.exists('st_glint')) {                   // 4-point star, cream with a yellow heart
      const gg = sc.make.graphics({ add: false }); gg.fillStyle(0xfdfae6, 1).fillRect(3, 0, 1, 7).fillRect(0, 3, 7, 1).fillRect(2, 2, 3, 3); gg.fillStyle(0xf1c93b, 1).fillRect(3, 3, 1, 1); gg.generateTexture('st_glint', 7, 7); gg.destroy();
    }
    this.makeOutlines();
  }
  makeOutlines() {
    const r = this.r, room = 'room';
    const x2 = (src, key) => { if (r.textures.exists(key)) return; const im = r.textures.get(src).getSourceImage(), cv = document.createElement('canvas'); cv.width = im.width * 2; cv.height = im.height * 2; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0, cv.width, cv.height); r.textures.addCanvas(key, cv); };
    x2('st_mailbox', 'st_mailbox_x2'); x2('st_bouquet', 'st_bouquet_x2');
    const blue = (R, G, B) => B > 150 && B > R + 60 && B > G + 30, white = (R, G, B) => R > 190 && G > 190 && B > 180;
    const mk = (key, parts) => { const k = outlineTexture(r, key, parts), c = r.textures.get(k).customData; return r.add.image(c.x, c.y, k).setOrigin(0).setDepth(9100).setVisible(false); };
    const crop = (rect) => [rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1]];
    const pb = r.L.pieces.find(p => p.id === 'bed');
    this.qo = {
      mailbox: [mk('q-mailbox', [frameRegion(r, 'st_mailbox_x2', '__BASE', MAILBOX[0] - 20, MAILBOX[1] - 62)])],
      bluebox: [mk('q-bluebox', [{ ...frameRegion(r, room, '__BASE', 0, 0, crop([986, 460, 1030, 502])), keep: blue }])],
      suitcase: [mk('q-suitcase', [this.polyPart(room, [[1103, 516], [1111, 497], [1134, 486], [1160, 480], [1189, 482], [1207, 499], [1206, 516], [1190, 529], [1160, 544], [1139, 549], [1117, 539]])])],
      tap: [mk('q-tap', [{ ...frameRegion(r, 'roomBase', '__BASE', 0, 0, crop([700, 300, 830, 395])), keep: white }])],
      bed: [mk('q-bed', [frameRegion(r, 'piece_bed', '__BASE', pb.x, pb.y)])],
      bouquet: [mk('q-bouquet', [frameRegion(r, 'st_bouquet_x2', '__BASE', BOUQUET[0] - 76, BOUQUET[1] - 194)])],
    };
    this.pulse = 0;
  }
  polyPart(tex, poly) {                                     // pixels of a texture inside a polygon (world px), as an outline source
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
    g.beginPath(); poly.forEach(([x, y], i) => i ? g.lineTo(x - x0, y - y0) : g.moveTo(x - x0, y - y0)); g.closePath(); g.clip();
    g.drawImage(this.r.textures.get(tex).getSourceImage(), -x0, -y0); return { img: cv, x: 0, y: 0, w, h, dx: x0, dy: y0 };
  }
  // which objects carry the white quest outline right now
  questIds() {
    const r = this.r;
    switch (this.step) {
      case 'door': return this.s.flags.knocked ? ['door'] : [];
      case 'mailbox': return this.hinted() ? (r.obj.door.on ? ['mailbox'] : ['door', 'mailbox']) : [];
      case 'bluebox': return this.hinted() ? ['bluebox'] : [];
      case 'mirror': return this.hinted() ? (r.obj.wcdoor.on ? ['tap'] : ['wcdoor', 'tap']) : [];
      case 'suitcase': return this.hinted() ? ['suitcase'] : [];
      case 'bed': return this.hinted() ? ['bed'] : [];
      case 'garden': return r.obj.door.on ? ['bouquet'] : ['door', 'bouquet'];
      default: return [];
    }
  }
  hinted() { return !!this.s.flags['hint_' + this.step]; }
  refresh() {
    for (const o of OBJECTS) this.r.obj[o.id].def.active = o.id !== 'bouquet' || this.s.step >= STEPS.indexOf('garden');   // everything can be looked at; order is enforced in onUse
    this.hud();
  }
  restore() {
    const st = this.step, after = (s) => this.s.step > STEPS.indexOf(s);
    if (after('door')) { this.craneMode = 'follow'; this.crane.setVisible(true); }
    if (after('bed')) { this.dark = 0; this.bouquet.setVisible(true); this.trail(true); }
    if (st === 'end') { const h = this.r.hero; this.anh.setVisible(true).setPosition(h.x + 142, h.y + 2).play('anh-idle-left'); this.bouquet.setPosition(h.x + 70, h.y + 10).setDepth(h.y + 2); }
    this.refresh();
  }

  // ---- per-frame: outlines pulse, crane follows the hero -------------------------------------------------------------------
  drawNight() {
    const r = this.r, g = this.nm.getContext(), W = 375, H = 315, P = (x, y) => [(x + 500) / 6, (y + 500) / 6];
    g.clearRect(0, 0, W, H); if (this.dark <= 0.01) { this.nm.refresh(); this.night.setVisible(false); return; }
    this.night.setVisible(true); g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(14,18,58,${this.dark})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    const hole = (x, y, rad, a) => { const [cx, cy] = P(x, y), rr = rad / 6, gr = g.createRadialGradient(cx, cy, rr * 0.25, cx, cy, rr); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill(); };
    hole(r.hero.x, r.hero.y - 60, 300, 0.95);                                     // a warm bubble of light around Hương: always easy to see where she goes
    if (r.obj.lamp && r.obj.lamp.on) hole(985, 540, 260, 0.9);
    hole(270, 640, 170, 0.45); hole(940, 330, 120, 0.35);                         // moonlight through the window, glow from the WC
    for (const p of this.petals || []) hole(p.x, p.y, 60, 0.6);
    g.globalCompositeOperation = 'source-over'; this.nm.refresh();
  }
  update(dt) {
    this.drawNight();
    const r0 = this.r, now = r0.time.now;
    if (this.thought) { this.thought.setPosition(r0.hero.x, r0.hero.y - 168); if (now > this.thought.getData('until')) { const t = this.thought; this.thought = null; r0.tweens.add({ targets: t, alpha: 0, duration: 250, onComplete: () => t.destroy() }); } }
    if (!r0.modal) for (const [i, d] of (DECOYS[this.step] || []).entries()) {
      const k = 'th_' + this.step + i; if (this.s.flags[k] || Math.hypot(r0.hero.x - d[0], r0.hero.y - d[1]) > d[2]) continue;
      this.s.flags[k] = true; this.save(); this.think(d[3]); break;
    }
    this.glintT = (this.glintT || 4) - dt; if (this.glintT <= 0) { this.glintT = 5 + Math.random() * 3; this.glint(); }
    const r = this.r, ids = this.questIds(); this.pulse += dt * 3.2; const a = 0.6 + 0.4 * Math.sin(this.pulse);
    for (const [id, imgs] of Object.entries(this.qo)) imgs.forEach(i => i.setVisible(ids.includes(id)).setAlpha(a));
    for (const id of ['door', 'wcdoor']) { const hl = r.hl[id]; if (hl && ids.includes(id)) hl.forEach((im, k) => im.setVisible((k === 1) === !!r.obj[id].on).setAlpha(a).setDepth(9100)); }
    if (this.craneMode === 'follow') {
      const h = r.hero, side = (r.facing === 'left' || r.facing === 'up') ? 1 : -1, tx = h.x + side * 46, ty = h.y - 2;
      const dx = tx - this.crane.x, dy = ty - this.crane.y, d = Math.hypot(dx, dy);
      if (d > 4) { const k = Math.min(1, dt * 4); this.crane.x += dx * k; this.crane.y += dy * k; }
      const fly = d > 14; if (fly && this.crane.anims.currentAnim?.key !== 'crane-fly') this.crane.play('crane-fly'); if (!fly && this.crane.anims.currentAnim?.key === 'crane-fly') this.crane.play('crane-idle');
      if (Math.abs(dx) > 2) this.crane.setFlipX(dx < 0);
      this.crane.setDepth(this.crane.y + (fly ? 60 : 0));
    }
    const bob = this.craneMode === 'follow' ? Math.sin(this.pulse * 1.3) * 3 : 0; this.crane.setData('bob', bob);
  }
  craneHit(x, y) { return this.crane.visible && this.crane.getBounds().contains(x, y); }

  // ---- crane moves ---------------------------------------------------------------------------------------------------------
  flyTo(x, y, ms = 900) {
    this.craneMode = 'busy'; const c = this.crane; c.play('crane-fly'); c.setFlipX(x < c.x); c.setDepth(9000);
    return new Promise(res => this.r.tweens.add({ targets: c, x, y, duration: ms, ease: 'Sine.easeInOut', onComplete: () => { c.play('crane-idle'); c.setDepth(y); res(); } }));
  }
  async peck() { this.crane.play('crane-peck'); await wait(700); this.crane.play('crane-idle'); }
  happy() { const c = this.crane; sfx.magic(); this.r.tweens.add({ targets: c, y: c.y - 30, duration: 220, yoyo: true, ease: 'Quad.easeOut' }); this.r.tweens.add({ targets: c, scaleX: { from: 2, to: -2 }, duration: 160, yoyo: true, repeat: 1 }); }
  shake() { this.r.tweens.add({ targets: this.crane, x: this.crane.x + 5, duration: 60, yoyo: true, repeat: 3 }); }
  async hint() {
    const st = this.step; if (this.r.modal || !HINTS[st]) return;
    this.r.modal = true; const lv = Math.min(3, (this.s.flags['hl_' + st] || 0) + 1); this.s.flags['hl_' + st] = lv; this.save();
    if (lv === 1) { this.happy(); await wait(500); }
    if (lv === 2) { const [x, y] = AREA[st]; await this.flyTo(x, y - 40, 800); await this.circle(x, y - 40); }
    if (lv === 3) { const [x, y] = EXACT[st]; await this.flyTo(x, y - 30, 700); await this.peck(); this.s.flags['hint_' + st] = true; this.save(); }   // outline from now on
    await say('Paper Crane', null, HINTS[st][lv - 1]); this.craneMode = 'follow'; this.r.modal = false;
  }
  circle(x, y) {                                           // fly a loop over the area
    const c = this.crane, o = { t: 0 }; c.play('crane-fly');
    return new Promise(res => this.r.tweens.add({ targets: o, t: Math.PI * 2, duration: 1600, onUpdate: () => { c.setPosition(x + Math.cos(o.t) * 70, y + Math.sin(o.t) * 30); c.setFlipX(Math.sin(o.t) > 0); }, onComplete: () => { c.play('crane-idle'); res(); } }));
  }
  // D. a thought bubble over Hương's head, without stopping the game
  think(text) {
    const r = this.r; if (this.thought) this.thought.destroy();
    const t = r.add.text(r.hero.x, r.hero.y - 168, text, { fontFamily: 'Pixelify Sans, monospace', fontSize: '22px', color: '#371506', backgroundColor: '#fdfae6', padding: { x: 10, y: 6 }, wordWrap: { width: 360 } })
      .setOrigin(0.5, 1).setDepth(9600).setAlpha(0); this.thought = t; t.setData('until', r.time.now + 3600);
    r.tweens.add({ targets: t, alpha: 1, duration: 200 });
  }
  // F. a little star flashes where the current piece hides
  glint() {
    const p = GLINT[this.step]; if (!p || this.r.modal) return;
    const g = this.r.add.image(p[0], p[1], 'st_glint').setScale(0).setDepth(9150);
    this.r.tweens.add({ targets: g, scale: 2.4, angle: 90, duration: 380, yoyo: true, ease: 'Sine.easeOut', onComplete: () => g.destroy() });
  }

  // ---- interaction hooks from the room -------------------------------------------------------------------------------------
  // returns true when the story handled the use of this object
  onUse(id) {
    const st = this.step;
    if (id === 'tap' && st === 'mirror') { this.cuMirror(); return true; }
    if (id === 'door' && this.s.step >= STEPS.indexOf('garden') && this.r.obj.door.on) { this.think('The garden is waiting. Let\'s go outside!'); return true; }   // keep the way out open
    if (this.r.obj[id] && this.r.obj[id].def.type === 'story') {
      if (!this.r.obj[id].def.active || this.r.modal) return true;
      const mine = OBJECTS.find(o => o.id === id).step, i = STEPS.indexOf(mine), now = this.s.step;
      if (i > now) { this.r.modal = true; say('Hương', 'neutral', NOT_YET[id]).then(() => { this.r.modal = false; }); return true; }
      if (i < now) { this.r.modal = true; say('Hương', 'neutral', DONE[id]).then(() => { this.r.modal = false; }); return true; }
      ({ mailbox: () => this.cuMailbox(), bluebox: () => this.cuBox(), suitcase: () => this.cuSuitcase(), bed: () => this.cuBed(), bouquet: () => this.finale() })[id]();
      return true;
    }
    return false;
  }
  onToggled(id, on) { if (id === 'door' && on && this.step === 'door' && this.s.flags.knocked) this.meetCrane(); }

  // ---- 0. prologue: night, three knocks --------------------------------------------------------------------------------------
  async run() {
    this.hud();
    if (this.step !== 'door' || this.s.flags.knocked) return;
    const r = this.r; r.modal = true; await wait(900); await bars(true);
    await caption('October 20th · 00:00', 2200);
    sfx.knock(); r.cameras.main.shake(260, 0.004); await wait(1100);
    await say('Hương', 'surprised', 'Three knocks... at midnight?');
    sfx.knock(); await wait(900);
    await say('Hương', 'neutral', 'Who could that be? I should check the front door.');
    await bars(false); this.s.flags.knocked = true; this.save(); r.modal = false;
  }

  // ---- 1. the paper crane at the door; the fan blows the letter apart ----------------------------------------------------------
  async meetCrane() {
    const r = this.r; r.modal = true; await wait(700); await bars(true);
    const c = this.crane; c.setPosition(500, 910).setVisible(true).setAlpha(0).setDepth(910); r.tweens.add({ targets: c, alpha: 1, duration: 500 });
    sfx.magic(); await wait(600);
    await talk([['Paper Crane', null, 'Happy 20/10, Hương!'], ['Hương', 'surprised', 'A paper crane...? You can talk?']]);
    await say('Paper Crane', null, 'I flew all night with a letter from Hiếu. It is very, very important!');
    await this.flyTo(r.hero.x + 60, r.hero.y - 70, 1100);
    // the fan switches itself on and the letter flies apart
    if (!r.obj.fan.on) r.toggle('fan'); sfx.whoosh(); r.cameras.main.shake(400, 0.003);
    r.tweens.add({ targets: c, angle: { from: -25, to: 25 }, duration: 120, yoyo: true, repeat: 5, onComplete: () => c.setAngle(0) });
    await this.scatter(); await wait(500);
    if (r.obj.fan.on) r.toggle('fan');
    await talk([['Paper Crane', null, 'Oh no... the wind took it! Five pieces, all over the house.'],
      ['Hương', 'neutral', 'Then we will find all five.'],
      ['Paper Crane', null, 'I will stay right beside you. Tap me whenever you are stuck!']]);
    await bars(false); this.craneMode = 'follow'; this.advance(); r.modal = false;
  }
  scatter() {
    const r = this.r, from = [this.crane.x, this.crane.y], to = [[548, 940], [1008, 470], [780, 330], [1150, 480], [480, 560]];
    return Promise.all(to.map(([x, y], i) => new Promise(res => {
      const p = r.add.image(from[0], from[1], 'st_piece').setScale(2).setDepth(9050), o = { t: 0 }, mx = (from[0] + x) / 2 + (i % 2 ? 120 : -120), my = Math.min(from[1], y) - 180;
      r.tweens.add({ targets: o, t: 1, duration: 1300 + i * 180, delay: i * 120, ease: 'Sine.easeInOut',
        onUpdate: () => { const t = o.t, u = 1 - t; p.setPosition(u * u * from[0] + 2 * u * t * mx + t * t * x, u * u * from[1] + 2 * u * t * my + t * t * y).setAngle(t * 720 + i * 40); },
        onComplete: () => r.tweens.add({ targets: p, alpha: 0, scale: 0.5, duration: 300, onComplete: () => { p.destroy(); res(); } }) });
    })));
  }

  // ---- shared: a piece of the letter was found ---------------------------------------------------------------------------------
  async found(n, cu) {
    this.s.pieces = n; this.save(); this.hud(); sfx.pick();
    await paper(PIECES[n], { title: `Piece ${n} of 5` });
    this.happy();
  }
  async finishStep(cu) { await wait(300); if (cu) await cu.close(); this.advance(); this.r.modal = false; }

  // ---- 2. mailbox: piece 1 + heart key -----------------------------------------------------------------------------------------
  async cuMailbox() {
    const r = this.r; r.modal = true; const f = this.s.flags;
    const cu = new Close(f.mbOpen ? 'cu_mailbox_open.png' : 'cu_mailbox_closed.png');
    const items = () => {
      if (!f.p1) cu.item('p1', 'it_piece.png', 62, 50, async () => { cu.drop('p1'); f.p1 = true; await this.found(1, cu); done(); });
      if (!this.has('key') && !f.keyUsed) cu.item('key', 'it_key.png', 92, 56, () => { cu.drop('key'); sfx.pick(); this.give('key'); done(); });
    };
    const done = () => { if (f.p1 && (this.has('key') || f.keyUsed)) this.finishStep(cu); };
    if (f.mbOpen) items(); else cu.zone(40, 10, 72, 60, (z) => { z.remove(); f.mbOpen = true; this.save(); sfx.unlock(); cu.setBg('cu_mailbox_open.png'); items(); });
    await cu.closed; r.modal = false;
  }

  // ---- 3. blue box on the shelf: heart lock -> piece 2 --------------------------------------------------------------------------
  async cuBox() {
    const r = this.r; r.modal = true; const f = this.s.flags;
    const cu = new Close(f.boxOpen ? 'cu_box_open.png' : 'cu_box_closed.png');
    const piece = () => { if (!f.p2) cu.item('p2', 'it_piece.png', 68, 38, async () => { cu.drop('p2'); f.p2 = true; await this.found(2, cu); this.finishStep(cu); }); };
    if (f.boxOpen) piece();
    else cu.zone(70, 34, 20, 16, async (z) => {
      if (!this.has('key')) { await say('Hương', 'neutral', 'Locked. There is a tiny heart-shaped keyhole...'); return; }
      z.remove(); this.take('key'); f.keyUsed = true; f.boxOpen = true; this.save(); sfx.unlock(); cu.setBg('cu_box_open.png'); piece();
    });
    await cu.closed; r.modal = false;
  }

  // ---- 4. WC mirror: hot water -> steam shows 20.10, piece 3 slides out ----------------------------------------------------------
  async cuMirror() {
    const r = this.r; r.modal = true; const f = this.s.flags;
    const cu = new Close('cu_mirror.png'), fog = cu.img('cu_mirror_fog.png', 0, 0, 'fog'); fog.style.opacity = f.steam ? 1 : 0; fog.style.transition = 'opacity 2.6s';
    const piece = () => { if (!f.p3) cu.item('p3', 'it_piece.png', 100, 52, async () => { cu.drop('p3'); f.p3 = true; await this.found(3, cu); this.finishStep(cu); }); };
    if (f.steam) piece();
    cu.zone(64, 62, 12, 10, async () => {                  // hot knob
      if (f.steam) return; sfx.water(); f.steam = true; this.save(); fog.style.opacity = 1; await wait(2700);
      await say('Hương', 'surprised', '"20.10"... and a little heart. Someone wrote on the mirror!'); piece();
    });
    cu.zone(84, 62, 12, 10, () => { sfx.water(); say('Hương', 'neutral', 'Brr... cold water. Nothing happens.'); });
    await cu.closed; r.modal = false;
  }

  // ---- 5. suitcase: 4-digit lock "2010" -> piece 4 + flashlight -------------------------------------------------------------------
  async cuSuitcase() {
    const r = this.r; r.modal = true; const f = this.s.flags;
    const cu = new Close(f.caseOpen ? 'cu_suitcase_open.png' : 'cu_suitcase_closed.png'), k = cu.k;
    const contents = () => {
      if (!f.p4) cu.item('p4', 'it_piece.png', 64, 70, async () => { cu.drop('p4'); f.p4 = true; await this.found(4, cu); end(); });
      if (!this.has('light') && !f.lightUsed) cu.item('light', 'it_light.png', 100, 74, () => { cu.drop('light'); sfx.pick(); this.give('light'); end(); });
    };
    const end = () => { if (f.p4 && (this.has('light') || f.lightUsed)) this.finishStep(cu); };
    if (f.caseOpen) contents();
    else {
      const dig = f.dial || [0, 0, 0, 0], wheels = [];
      for (let i = 0; i < 4; i++) {
        const w = document.createElement('div'); w.className = 'cu-img';
        Object.assign(w.style, { left: (58 + i * 12) * k + 'px', top: (54 + 0) * k + 'px', width: 7 * k + 'px', height: 11 * k + 'px', backgroundImage: 'url(assets/story/digits.png)', backgroundSize: `${70 * k}px ${11 * k}px`, imageRendering: 'pixelated' });
        cu.stage.appendChild(w); wheels.push(w);
      }
      const show = () => wheels.forEach((w, i) => { w.style.backgroundPosition = `${-dig[i] * 7 * k}px 0`; });
      const turn = (i, d) => {
        dig[i] = (dig[i] + d + 10) % 10; f.dial = dig; this.save(); sfx.tick(); show();
        if (dig.join('') === '2010') { setTimeout(() => { sfx.unlock(); f.caseOpen = true; this.save(); wheels.forEach(w => w.remove()); cu.stage.querySelectorAll('.cu-zone').forEach(z => z.remove()); cu.setBg('cu_suitcase_open.png'); contents(); }, 350); }
      };
      for (let i = 0; i < 4; i++) { cu.zone(57 + i * 12, 40, 10, 8, () => turn(i, 1)); cu.zone(57 + i * 12, 50, 10, 18, () => turn(i, 1)); cu.zone(57 + i * 12, 70, 10, 8, () => turn(i, -1)); }
      show();
    }
    await cu.closed; r.modal = false;
  }

  // ---- 6. under the bed: flashlight, the photo, piece 5 -----------------------------------------------------------------------------
  async cuBed() {
    const r = this.r; r.modal = true; const f = this.s.flags;
    const cu = new Close('cu_underbed.png'), cv = cu.canvas(), g = cv.getContext('2d'), k = cu.k; let lx = 80 * k, ly = 60 * k;
    const dark = () => {
      g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = 'rgba(8,4,10,0.96)'; g.fillRect(0, 0, cv.width, cv.height);
      if (!this.has('light')) return;
      g.globalCompositeOperation = 'destination-out'; const R = 26 * k, gr = g.createRadialGradient(lx, ly, R * 0.3, lx, ly, R);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(lx, ly, R, 0, Math.PI * 2); g.fill();
      g.globalCompositeOperation = 'source-over';
    };
    const aim = (e) => { const b = cu.stage.getBoundingClientRect(); lx = e.clientX - b.left; ly = e.clientY - b.top; dark(); };
    cu.stage.addEventListener('pointermove', aim); cu.stage.addEventListener('pointerdown', aim, true);   // capture: the light moves before an item checks it
    const lit = (x, y) => this.has('light') && Math.hypot(x * k - lx, y * k - ly) < 26 * k;
    if (!f.photo) cu.item('photo', 'it_photo.png', 84, 60, async () => {
      if (!lit(98, 72)) return;
      cu.drop('photo'); f.photo = true; this.save(); sfx.pick();
      await showImage('photo_big.png', '04.10 · us');
      await say('Hương', 'teary', 'Hiếu kept this photo...'); end();
    });
    if (!f.p5) cu.item('p5', 'it_piece.png', 126, 80, async () => { if (!lit(139, 88)) return; cu.drop('p5'); f.p5 = true; await this.found(5, cu); end(); });
    const end = () => { if (f.photo && f.p5) cu.back.classList.add('pulse'); };   // keep looking around as long as she likes; Back goes on
    dark();
    if (!this.has('light')) say('Hương', 'neutral', 'It is far too dark under here... I need some light.');
    await cu.closed; r.modal = false;
    if (f.photo && f.p5) { this.take('light'); f.lightUsed = true; this.advance(); this.dawn(); }
  }

  // ---- 7. dawn: the crane leads Hương outside, petals light the path --------------------------------------------------------------------
  async dawn() {
    const r = this.r; r.modal = true; await bars(true);
    r.tweens.add({ targets: this, dark: 0, duration: 3600, ease: 'Sine.easeInOut' }); r.tweens.add({ targets: this.warm, alpha: 0.22, duration: 1800, yoyo: true });   // sunrise
    await caption('The sky turns pink...', 2400);
    await say('Paper Crane', null, 'All five pieces! It is almost morning... Follow me, Hương!');
    if (!r.obj.door.on) r.toggle('door');
    this.bouquet.setVisible(true).setAlpha(0); r.tweens.add({ targets: this.bouquet, alpha: 1, duration: 800 });
    await this.flyTo(505, 860, 900); await this.flyTo(...TRAIL[3], 900); this.trail(); await this.flyTo(BOUQUET[0] - 10, BOUQUET[1] - 205, 1200);
    this.craneMode = 'perch'; await bars(false); r.modal = false;
  }
  trail(instant) {
    this.petals = this.petals || [];
    TRAIL.forEach(([x, y], i) => {
      const p = this.r.add.image(x, y, 'st_petal').setScale(3).setDepth(y - 1).setAlpha(instant ? 0.9 : 0); this.petals.push(p);
      this.r.tweens.add({ targets: p, alpha: { from: instant ? 0.9 : 0, to: 0.9 }, duration: 400, delay: instant ? 0 : i * 180, onComplete: () => this.r.tweens.add({ targets: p, alpha: 0.45, scale: 2.4, duration: 900, yoyo: true, repeat: -1 }) });
    });
  }

  // ---- 8. finale: Hiếu steps out from behind the pink tree and gives the bouquet ----------------------------------------------------
  async finale() {
    const r = this.r; if (this.step !== 'garden') return; r.modal = true; await bars(true);
    const a = this.anh, b = this.bouquet, h = r.hero, walk = (x, y, ms, dir) => new Promise(res => {
      a.play('anh-walk-' + dir); r.tweens.add({ targets: a, x, y, duration: ms, onUpdate: () => a.setDepth(a.y), onComplete: () => { a.play('anh-idle-' + dir); res(); } }); });
    const hold = () => b.setPosition(a.x - 34, a.y + 6).setDepth(a.y + 2);    // the bouquet in Hiếu's arms
    r.facing = 'right'; h.play('idle-right');
    // Hiếu steps out from behind the pink tree and picks the bouquet up
    a.setVisible(true).setPosition(...ANH_FROM); await walk(BOUQUET[0] + 46, BOUQUET[1] + 2, 1300, 'left');
    await say('Hiếu', null, 'Happy birthday, Hương.');
    await say('Hương', 'surprised', 'Hiếu?! You were here the whole time?');
    this.craneMode = 'busy'; r.tweens.add({ targets: this.crane, y: this.crane.y - 40, duration: 400 });
    r.tweens.add({ targets: b, y: b.y - 10, duration: 250, yoyo: true }); await wait(300); hold();
    // ... carries it over to Hương
    const tx = h.x + 142, ty = h.y + 2;
    await new Promise(res => { a.play('anh-walk-left'); r.tweens.add({ targets: a, x: tx, y: ty, duration: 1100, onUpdate: () => { a.setDepth(a.y); hold(); }, onComplete: () => { a.play('anh-idle-left'); res(); } }); });
    await say('Hiếu', null, 'Happy 20/10, too. These are for you.');
    sfx.magic(); await new Promise(res => r.tweens.add({ targets: b, x: h.x + 70, y: h.y + 10, duration: 700, ease: 'Back.easeOut', onUpdate: () => b.setDepth(h.y + 2), onComplete: res }));   // ... into her arms
    await this.flyTo(h.x + 70, h.y - 200, 900); this.craneMode = 'perch';
    await talk([['Hương', 'teary', 'They are so beautiful...'], ['Hiếu', null, 'I love you.']]);
    this.s.step = STEPS.indexOf('end'); this.save(); this.refresh();
    await paper(LETTER, { title: 'For Hương', full: true, hint: 'with love' });
    this.happy(); await wait(600); await bars(false);
    endCard(() => this.replay(false));
  }
}
