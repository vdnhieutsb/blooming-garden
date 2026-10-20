// On/off state of the room's interactive objects (fan, lamp, tap, doors), in memory only: every visit starts fresh.
const KEY = 'truoc-khi-troi-sang-sandbox-v1';
export let S = { objects: {} };
export function load() { try { localStorage.removeItem(KEY); } catch (e) { /* private mode */ } S = { objects: {} }; return S; }
export function save() { /* nothing is stored between visits */ }
export const isOn = (id) => !!S.objects[id];
export function setOn(id, v) { S.objects[id] = !!v; save(); }
