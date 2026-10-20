// DOM overlay helpers: toast, dialogue, inventory.
const $ = (id) => document.getElementById(id);
let toastTimer = 0, dialogQueue = [], dialogDone = null;
export function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms); }
export function say(lines, done) {
  dialogQueue = Array.isArray(lines) ? lines.slice() : [lines]; dialogDone = done || null; nextLine();
}
function nextLine() {
  const d = $('dialog');
  if (!dialogQueue.length) { d.classList.add('hidden'); const f = dialogDone; dialogDone = null; if (f) f(); return; }
  $('dialogText').textContent = dialogQueue.shift(); d.classList.remove('hidden');
}
export const dialogOpen = () => !$('dialog').classList.contains('hidden');
export function bindDialog() { const d = $('dialog'); d.addEventListener('pointerdown', (e) => { e.stopPropagation(); nextLine(); }); window.addEventListener('keydown', (e) => { if (dialogOpen() && (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E')) { e.preventDefault(); nextLine(); } }); }
