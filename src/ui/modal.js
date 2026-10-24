import { h, clear } from './dom.js';

let current = null;
let lastFocus = null;
let onCloseCb = null;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Ouvre une fenêtre modale. Le dernier argument peut être { onClose } pour être
 * prévenu à la fermeture. Le focus reste dans la fenêtre (Tab / Maj+Tab) et revient
 * ensuite sur l'élément qui l'avait ouverte.
 */
export function openModal(title, ...content) {
  let opts = {};
  const last = content[content.length - 1];
  if (last && typeof last === 'object' && !(last instanceof Node) && !Array.isArray(last) && 'onClose' in last) opts = content.pop();
  closeModal();
  lastFocus = document.activeElement;
  onCloseCb = opts.onClose || null;
  const close = h('button.modal-close', { 'aria-label': 'Fermer', onclick: closeModal }, '×');
  const box = h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div.modal-head', h('h2', title), close),
    h('div.modal-body', ...content));
  const backdrop = h('div.modal-backdrop', { onclick: (e) => { if (e.target === backdrop) closeModal(); } }, box);
  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  current = backdrop;
  requestAnimationFrame(() => backdrop.classList.add('open'));
  close.focus();
  return box;
}

function onKey(e) {
  if (e.key === 'Escape') { closeModal(); return; }
  if (e.key !== 'Tab' || !current) return;
  const items = [...current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], end = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
  else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
}

export function closeModal() {
  if (!current) return;
  document.removeEventListener('keydown', onKey);
  const el = current; current = null;
  el.classList.remove('open');
  setTimeout(() => { clear(el); el.remove(); }, 160);
  const cb = onCloseCb; onCloseCb = null;
  if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  cb?.();
}
