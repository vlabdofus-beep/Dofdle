// Champ de saisie avec autocomplétion (insensible aux accents / majuscules)
import { h, img, clear, isTouch } from './dom.js';
import { normalize } from '../core/text.js';

/**
 * @param {object} opts
 *  - items: [{ id, n, img?, sub? }]
 *  - placeholder
 *  - onSelect(item)
 *  - exclude(): Set d'ids à masquer (déjà proposés)
 *  - onFreeText(text): appelé sur Entrée sans suggestion (ex. coordonnées)
 */
export function createAutocomplete({ items, placeholder, onSelect, exclude = () => new Set(), onFreeText, max = 8 }) {
  const index = items.map((it) => ({ it, key: normalize(it.n), words: normalize(it.n).split(' ') }));
  let results = [];
  let active = -1;

  const input = h('input.guess-input', {
    type: 'text', placeholder, autocomplete: 'off', spellcheck: 'false',
    'aria-autocomplete': 'list', 'aria-controls': 'ac-list', role: 'combobox', 'aria-expanded': 'false',
  });
  const list = h('ul.ac-list#ac-list', { role: 'listbox' });
  const button = h('button.guess-btn', { type: 'submit', 'aria-label': 'Valider' }, 'Valider');
  const form = h('form.guess-form', { onsubmit: (e) => { e.preventDefault(); submit(); } },
    h('div.ac-wrap', input, list), button);

  function search(q) {
    const nq = normalize(q);
    if (!nq) return [];
    const ex = exclude();
    const scored = [];
    for (const row of index) {
      let score = -1;
      if (row.key === nq) score = 0;
      else if (row.key.startsWith(nq)) score = 1;
      else if (row.words.some((w) => w.startsWith(nq))) score = 2;
      else if (row.key.includes(nq)) score = 3;
      if (score >= 0) scored.push([score, row.key.length, row.it]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    used = ex;
    return scored.slice(0, max).map((s) => s[2]);
  }
  let used = new Set();
  const isUsed = (it) => used.has(it.id);

  function render() {
    clear(list);
    input.setAttribute('aria-expanded', results.length ? 'true' : 'false');
    results.forEach((it, i) => {
      const done = isUsed(it);
      const li = h('li.ac-item', {
        role: 'option', 'aria-selected': i === active ? 'true' : 'false', 'aria-disabled': done ? 'true' : undefined,
        class: [i === active ? 'active' : '', done ? 'used' : ''].join(' ').trim() || undefined,
        onmousedown: (e) => { e.preventDefault(); if (!done) choose(it); },
      },
      it.img ? img(it.img, '', 'ac-img') : null,
      h('span.ac-text', h('span.ac-name', it.n), h('span.ac-sub', done ? 'Déjà proposé' : it.sub || '')));
      list.append(li);
    });
    list.classList.toggle('open', results.length > 0);
  }

  function choose(it) {
    input.value = '';
    results = []; active = -1; render();
    onSelect(it);
    // Mobile : on ferme le clavier pour laisser voir la nouvelle ligne
    if (isTouch()) input.blur(); else input.focus();
  }

  function submit() {
    if (results.length) {
      const it = results[Math.max(active, 0)];
      if (!isUsed(it)) choose(it);
      return;
    }
    const text = input.value.trim();
    if (text && onFreeText && onFreeText(text) !== false) { input.value = ''; if (isTouch()) input.blur(); }
  }

  input.addEventListener('input', () => {
    results = search(input.value);
    active = results.findIndex((it) => !isUsed(it));
    if (active < 0) active = results.length ? 0 : -1;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); active = (active + 1) % results.length; render(); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); active = (active - 1 + results.length) % results.length; render(); }
    else if (e.key === 'Escape') { results = []; render(); }
  });
  input.addEventListener('blur', () => setTimeout(() => { results = []; render(); }, 120));

  return {
    el: form,
    focus: () => input.focus(),
    disable(flag) { input.disabled = flag; button.disabled = flag; form.classList.toggle('disabled', flag); },
  };
}
