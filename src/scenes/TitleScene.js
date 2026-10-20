import { unlock, startMusic } from '../audio.js';
export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }
  create() {
    const w = this.scale.width, h = this.scale.height;
    this.garden = this.add.image(w / 2, h / 2, 'garden').setTint(0x9a7a6a); this.bg = this.add.image(w / 2, h / 2, 'room').setTint(0x9a7a6a);
    const fit = () => { const W = this.scale.width, H = this.scale.height, k = Math.max(W / 1448, H / 1086) * 1.05; this.bg.setPosition(W / 2, H / 2).setScale(k); this.garden.setPosition(W / 2, H / 2).setScale(k); };
    fit(); this.scale.on('resize', fit);
    const f = { fontFamily: 'Pixelify Sans, monospace', color: '#fdfae6' };
    this.add.rectangle(0, 0, 5000, 5000, 0x1b0d07, 0.55).setOrigin(0);
    this.t1 = this.add.text(w / 2, h * 0.36, 'Blooming Garden', { ...f, fontSize: Math.min(64, w / 9) + 'px', stroke: '#371506', strokeThickness: 8 }).setOrigin(0.5);
    this.t2 = this.add.text(w / 2, h * 0.36 + Math.min(64, w / 9) * 1.1, '20 · 10', { ...f, fontSize: Math.min(26, w / 18) + 'px', color: '#f1c93b' }).setOrigin(0.5);
    this.t3 = this.add.text(w / 2, h * 0.7, 'Tap to start', { ...f, fontSize: Math.min(24, w / 20) + 'px' }).setOrigin(0.5);
    this.tweens.add({ targets: this.t3, alpha: 0.3, yoyo: true, repeat: -1, duration: 800 });
    this.scale.on('resize', () => { const W = this.scale.width, H = this.scale.height; this.t1.setPosition(W / 2, H * 0.36); this.t2.setPosition(W / 2, H * 0.36 + 64); this.t3.setPosition(W / 2, H * 0.7); });
    this.input.once('pointerdown', () => this.go()); this.input.keyboard.once('keydown', () => this.go());
  }
  go() { unlock(); startMusic(); this.scene.start('Room'); }
}
