import { load } from '../state.js';
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    const w = this.scale.width, h = this.scale.height, f = { fontFamily: 'Pixelify Sans, monospace', color: '#fdfae6' };   // loading screen
    const t = this.add.text(w / 2, h / 2 - 24, 'Blooming Garden', { ...f, fontSize: '28px' }).setOrigin(0.5);
    const bar = this.add.rectangle(w / 2 - 110, h / 2 + 14, 0, 10, 0xf1c93b).setOrigin(0, 0.5); this.add.rectangle(w / 2, h / 2 + 14, 224, 16).setStrokeStyle(3, 0xa63803);
    this.load.on('progress', (v) => { bar.width = 220 * v; }); this.loadingText = t;
    this.load.image('room', 'assets/room_cut.png'); this.load.image('garden', 'assets/garden.png'); this.load.image('roomBase', 'assets/room_base.png'); this.load.json('layout', 'assets/layout.json'); this.load.json('anim', 'assets/anim.json');
    this.load.spritesheet('hero_walk', 'assets/hero_chibi_walk.png', { frameWidth: 36, frameHeight: 56 }); this.load.spritesheet('hero_idle', 'assets/hero_chibi_idle.png', { frameWidth: 36, frameHeight: 56 });
    for (const k of ['w1', 'w2', 'w3', 'w4', 'w5', 'w6']) this.load.image('wall_' + k, `assets/wall_${k}.png`);
    this.load.spritesheet('st_crane', 'assets/story/crane.png', { frameWidth: 30, frameHeight: 26 });              // story (Game-2)
    for (const k of ['mailbox', 'bouquet', 'petal']) this.load.image('st_' + k, `assets/story/${k}.png`);
    this.load.image('st_piece', 'assets/story/it_piece.png');
    this.load.spritesheet('anh_walk', 'assets/anh_walk.png', { frameWidth: 36, frameHeight: 56 }); this.load.spritesheet('anh_idle', 'assets/anh_idle.png', { frameWidth: 36, frameHeight: 56 });
  }
  create() {
    load(); const a = this.cache.json.get('anim'), pieces = this.cache.json.get('layout').pieces.map(p => p.id);   // furniture + garden trees
    for (const k of pieces) this.load.image('piece_' + k, `assets/piece_${k}.png`);
    for (const [k, m] of Object.entries(a)) this.load.spritesheet('anim_' + k, m.file, { frameWidth: m.w, frameHeight: m.h });
    this.load.once('complete', () => {
      // an image that failed to load (e.g. fetched while the asset tools were rewriting it) shows as a black box: reload once
      const missing = ['roomBase', 'garden', 'hero_walk', 'hero_idle', 'st_crane', 'st_mailbox', 'st_bouquet', 'st_petal', 'st_piece', 'anh_walk', 'anh_idle', ...pieces.map(k => 'piece_' + k), ...['w1', 'w2', 'w3', 'w4', 'w5', 'w6'].map(k => 'wall_' + k), ...Object.keys(a).map(k => 'anim_' + k)].filter(k => !this.textures.exists(k));
      let tries = 0; try { tries = +sessionStorage.getItem('boot-retry') || 0; } catch (e) { /* private mode */ }
      if (missing.length && tries < 2) { try { sessionStorage.setItem('boot-retry', tries + 1); } catch (e) { /* ignore */ } location.reload(); return; }
      try { sessionStorage.removeItem('boot-retry'); } catch (e) { /* ignore */ }
      const q = new URLSearchParams(location.search); this.scene.start(q.get('go') === 'room' || q.get('debug') ? 'Room' : 'Title');
    }); this.load.start();
  }
}
