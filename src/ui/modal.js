import { h, clear } from './dom.js';

let current = null;

export function openModal(title, ...content) {
  closeModal();
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

function onKey(e) { if (e.key === 'Escape') closeModal(); }

export function closeModal() {
  if (!current) return;
  document.removeEventListener('keydown', onKey);
  const el = current; current = null;
  el.classList.remove('open');
  setTimeout(() => { clear(el); el.remove(); }, 160);
}
