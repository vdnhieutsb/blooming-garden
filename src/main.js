import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { RoomScene } from './scenes/RoomScene.js';
import { bindDialog } from './ui.js';
import { setMuted, isMuted, startMusic } from './audio.js';

bindDialog();
document.getElementById('soundBtn').onclick = (e) => { setMuted(!isMuted()); e.currentTarget.textContent = isMuted() ? '×' : '♪'; };
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', backgroundColor: '#1b0d07', pixelArt: true, roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [BootScene, TitleScene, RoomScene],
});
window.__game = game;
