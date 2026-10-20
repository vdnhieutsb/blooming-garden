// Sandbox state: only the on/off state of interactive objects (story state lives in _story/state.story.js).
const KEY = 'truoc-khi-troi-sang-sandbox-v1';
export let S = { objects: {} };
export function load() { try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && j.objects) S = j; } catch (e) { /* private mode */ } return S; }
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
export const isOn = (id) => !!S.objects[id];
export function setOn(id, v) { S.objects[id] = !!v; save(); }
