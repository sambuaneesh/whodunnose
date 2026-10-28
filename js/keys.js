'use strict';
// Remappable keys. The game is written against default physical keys (e.code, so WASD sits in the same
// place on AZERTY and other layouts); a binding translates the player's chosen key to the default one.
// Arrow keys, Escape, Enter, Space and the number keys always work and cannot be rebound.
const Keys = (() => {
  const ACTIONS = [
    ['up', 'Walk up', 'KeyW'], ['left', 'Walk left', 'KeyA'], ['down', 'Walk down', 'KeyS'], ['right', 'Walk right', 'KeyD'],
    ['talk', 'Talk / hold to search', 'KeyE'], ['sniff', 'Sniff (gag)', 'KeyQ'], ['smellVision', 'Smell Vision', 'KeyV'],
    ['release', 'Let it go', 'KeyF'], ['clench', 'Clench (hold)', 'KeyC'], ['object', 'Call it', 'KeyO'],
    ['notebook', 'Notebook', 'KeyN'], ['hint', 'Hint', 'KeyH'],
  ];
  const DEFAULT = Object.fromEntries(ACTIONS.map(([id, , code]) => [id, code]));
  const FIXED = new Set(['Escape', 'Enter', 'Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyM', 'KeyP', 'Backquote']);
  let map = {}, layout = null;

  const bound = () => ({ ...DEFAULT, ...(Store.settings().keys || {}) });
  function rebuild() {
    map = {};
    const b = bound();
    for (const id in b) if (b[id] !== DEFAULT[id]) map[DEFAULT[id]] = null; // a moved default stops working...
    for (const id in b) if (b[id] !== DEFAULT[id]) map[b[id]] = DEFAULT[id]; // ...unless another action now uses it
  }
  // the game asks for a code and gets the default it stands for (null: that key now does nothing)
  const translate = (code) => (code in map ? map[code] : code);
  function bind(id, code) {
    if (FIXED.has(code) || /^Digit/.test(code)) return false;
    const b = bound();
    const clash = Object.keys(b).find((k) => k !== id && b[k] === code);
    if (clash) b[clash] = b[id]; // swap, so nothing is left without a key
    b[id] = code;
    const diff = Object.fromEntries(Object.entries(b).filter(([k, v]) => v !== DEFAULT[k]));
    Store.set('keys', diff); rebuild();
    return true;
  }
  function reset() { Store.set('keys', {}); rebuild(); }
  // what is printed on the key in this keyboard layout, where the browser can tell us
  function label(code) {
    if (layout && layout.get(code)) return layout.get(code).toUpperCase();
    return code.replace(/^Key/, '').replace(/^Digit/, '');
  }
  const labelFor = (id) => label(bound()[id]);
  function init() {
    rebuild();
    try { if (navigator.keyboard && navigator.keyboard.getLayoutMap) navigator.keyboard.getLayoutMap().then((m) => { layout = m; }).catch(() => {}); } catch (e) { /* not supported */ }
  }
  return { ACTIONS, init, translate, bind, reset, label, labelFor, bound };
})();
