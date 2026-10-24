// Champ de saisie avec autocomplétion (insensible aux accents / majuscules)
import { h, img, clear, isTouch } from './dom.js';
import { normalize } from '../core/text.js';

/**
 * @param {object} opts
 *  - items: [{ id, n, img?, sub? }]
 *  - placeholder
 *  - onSelect(item)
 *  - exclude(): Set d'ids déjà proposés (retirés de la liste)
 *  - onFreeText(text): appelé sur Entrée sans suggestion (ex. coordonnées)
 *  - browse: champ vide + focus = liste complète à parcourir (défaut : oui)
 * La liste n'est pas limitée : elle se remplit au fil du défilement.
 */
const PAGE = 40;

export function createAutocomplete({ items, placeholder, onSelect, exclude = () => new Set(), onFreeText, browse = true }) {
  const index = items.map((it) => ({ it, key: normalize(it.n), words: normalize(it.n).split(' ') }));
  const alphabetical = [...index].sort((a, b) => a.key.localeCompare(b.key));
  let results = [];
  let shown = 0;
  let active = -1;

  const input = h('input.guess-input', {
    type: 'text', placeholder, autocomplete: 'off', spellcheck: 'false',
    'aria-autocomplete': 'list', 'aria-controls': 'ac-list', role: 'combobox', 'aria-expanded': 'false',
  });
  const list = h('ul.ac-list#ac-list', { role: 'listbox' });
  const button = h('button.guess-btn', { type: 'submit', 'aria-label': 'Valider' }, 'Valider');
  const form = h('form.guess-form', { onsubmit: (e) => { e.preventDefault(); submit(); } },
    h('div.ac-wrap', input, list), button);

  /** Toutes les correspondances, meilleures en premier, sans les éléments déjà proposés. */
  function search(q) {
    const nq = normalize(q);
    const ex = exclude();
    if (!nq) return browse ? alphabetical.filter((row) => !ex.has(row.it.id)).map((row) => row.it) : [];
    const scored = [];
    for (const row of index) {
      if (ex.has(row.it.id)) continue;
      let score = -1;
      if (row.key === nq) score = 0;
      else if (row.key.startsWith(nq)) score = 1;
      else if (row.words.some((w) => w.startsWith(nq))) score = 2;
      else if (row.key.includes(nq)) score = 3;
      if (score >= 0) scored.push([score, row.key.length, row.it]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].n.localeCompare(b[2].n));
    return scored.map((s) => s[2]);
  }

  function itemEl(it, i) {
    return h('li.ac-item', {
      role: 'option', id: `ac-opt-${i}`, 'aria-selected': i === active ? 'true' : 'false',
      class: i === active ? 'active' : undefined,
      onmousedown: (e) => { e.preventDefault(); choose(it); },
    },
    it.img ? img(it.img, '', 'ac-img') : null,
    h('span.ac-text', h('span.ac-name', it.n), h('span.ac-sub', it.sub || '')));
  }

  /** Ajoute la page suivante de suggestions (défilement infini). */
  function more() {
    const end = Math.min(results.length, shown + PAGE);
    for (let i = shown; i < end; i++) list.append(itemEl(results[i], i));
    shown = end;
  }

  function render() {
    clear(list);
    shown = 0;
    list.scrollTop = 0;
    input.setAttribute('aria-expanded', results.length ? 'true' : 'false');
    more();
    list.classList.toggle('open', results.length > 0);
  }

  function setActive(i) {
    while (i >= shown && shown < results.length) more();
    list.querySelector('.ac-item.active')?.classList.remove('active');
    list.querySelector('[aria-selected="true"]')?.setAttribute('aria-selected', 'false');
    active = i;
    const el = list.children[i];
    if (!el) return;
    el.classList.add('active');
    el.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', el.id);
    el.scrollIntoView({ block: 'nearest' });
  }

  list.addEventListener('scroll', () => {
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 80) more();
  }, { passive: true });

  function choose(it) {
    input.value = '';
    results = []; active = -1; render();
    onSelect(it);
    // Mobile : on ferme le clavier pour laisser voir la nouvelle ligne
    if (isTouch()) input.blur(); else input.focus();
  }

  function submit() {
    if (input.value.trim() && results.length) { choose(results[Math.max(active, 0)]); return; }
    const text = input.value.trim();
    if (text && onFreeText && onFreeText(text) !== false) { input.value = ''; if (isTouch()) input.blur(); }
  }

  const refresh = () => {
    results = search(input.value);
    active = input.value.trim() && results.length ? 0 : -1;
    render();
  };
  input.addEventListener('input', refresh);
  input.addEventListener('focus', () => { if (browse && !input.value.trim()) refresh(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive(Math.min(active + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0 && !input.value.trim()) { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') { results = []; render(); }
  });
  input.addEventListener('blur', () => setTimeout(() => { results = []; render(); }, 120));

  return {
    el: form,
    focus: () => input.focus(),
    disable(flag) { input.disabled = flag; button.disabled = flag; form.classList.toggle('disabled', flag); },
  };
}
