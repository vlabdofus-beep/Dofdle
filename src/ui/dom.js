// Mini-helpers DOM (pas de framework)

/** h('div.card#id', {onclick, title}, ...children) */
export function h(tag, attrs, ...children) {
  const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9]*)(.*)$/i);
  const el = document.createElement(name || 'div');
  for (const part of rest.match(/[.#][^.#]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
  }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { children.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.className += ` ${v}`;
    // Liens et sources : jamais d'URL exécutable (données externes, stockage local modifiable)
    else if ((k === 'href' || k === 'src') && /^\s*(javascript|vbscript|data:text\/html)/i.test(String(v))) continue;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };

let toastTimer;
export function toast(message, ms = 2200) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div#toast', { role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/** Image avec repli silencieux si l'URL est cassée. */
export function img(src, alt = '', cls = '') {
  const i = h('img', { src, alt, loading: 'lazy', decoding: 'async', class: cls || undefined, referrerpolicy: 'no-referrer' });
  i.addEventListener('error', () => i.classList.add('broken'), { once: true });
  return i;
}

export function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Écran tactile sans souris : on évite d'ouvrir le clavier virtuel sans action du joueur. */
export const isTouch = () => typeof matchMedia === 'function' && matchMedia('(hover: none) and (pointer: coarse)').matches;

/** Message lu par les lecteurs d'écran (zone invisible), sans rien afficher. */
export function announce(text) {
  let el = document.getElementById('sr-announcer');
  if (!el) { el = h('div#sr-announcer.sr-only', { role: 'status', 'aria-live': 'polite' }); document.body.append(el); }
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 60);
}
