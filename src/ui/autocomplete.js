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
 *  - filters: [{ id, label, all, options: [[valeur, libellé]], test(item, valeur) }] : listes déroulantes
 *  - sorts: [{ value, label, cmp? }] : ordre de la liste (le premier = ordre alphabétique)
 *  - noun: ['monstre', 'monstres'] pour le compteur de résultats
 * La liste n'est pas limitée : elle se remplit au fil du défilement.
 */
const PAGE = 40;

export function createAutocomplete({ items, placeholder, shortPlaceholder, onSelect, exclude = () => new Set(), onFreeText, browse = true, filters = [], sorts = [], noun = ['résultat', 'résultats'] }) {
  // Petit écran : texte d'exemple sans la parenthèse, pour qu'il ne soit pas coupé
  const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 560px)').matches;
  const shown_placeholder = narrow ? (shortPlaceholder || placeholder.replace(/\s*\(.*\)\s*/, '').replace(/…$/, '')) : placeholder;
  const index = items.map((it) => ({ it, key: normalize(it.n), words: normalize(it.n).split(' ') }));
  const alphabetical = [...index].sort((a, b) => a.key.localeCompare(b.key));
  let results = [];
  let shown = 0;
  let active = -1;

  const input = h('input.guess-input', {
    type: 'text', placeholder: shown_placeholder, autocomplete: 'off', spellcheck: 'false',
    'aria-autocomplete': 'list', 'aria-controls': 'ac-list', role: 'combobox', 'aria-expanded': 'false',
  });
  const list = h('ul.ac-list#ac-list', { role: 'listbox' });
  const button = h('button.guess-btn', { type: 'submit', 'aria-label': 'Valider' }, 'Valider');
  const form = h('form.guess-form', { onsubmit: (e) => { e.preventDefault(); submit(); } },
    h('div.ac-wrap', input, list), button);

  // --- Filtres et tri : réduisent la liste (champ vide = toute la sélection à parcourir)
  const chosen = {};
  let sortBy = sorts[0]?.value || '';
  const count = h('span.ac-count', { 'aria-live': 'polite' });
  const reset = h('button.link.ac-reset', { type: 'button', hidden: true, onclick: () => {
    for (const k of Object.keys(chosen)) delete chosen[k];
    sortBy = sorts[0]?.value || '';
    bar.querySelectorAll('select').forEach((s) => { s.value = s.dataset.default; });
    reset.hidden = true; count.textContent = '';
    results = []; render();
  } }, 'Tout afficher');
  const select = (label, def, options, onchange) => {
    const s = h('select.ac-select', { 'aria-label': label, 'data-default': def, onchange: (e) => { onchange(e.target.value); refreshFilters(); } },
      options.map(([v, t]) => h('option', { value: v }, t)));
    s.value = def;
    return s;
  };
  const hasControls = filters.length || sorts.length > 1;
  const bar = hasControls ? h('div.ac-filters',
    filters.map((f) => select(f.label, '', [['', f.all], ...f.options], (v) => { if (v) chosen[f.id] = v; else delete chosen[f.id]; })),
    sorts.length > 1 ? select('Classer par', sortBy, sorts.map((s) => [s.value, s.label]), (v) => { sortBy = v; }) : null,
    count, reset) : null;
  // Filtres au-dessus du champ : la liste qui s'ouvre sous le champ ne les cache pas
  const block = h('div.ac-block', bar, form);
  const active_filters = () => filters.filter((f) => chosen[f.id] !== undefined);
  const filtering = () => active_filters().length > 0 || (sorts.length && sortBy !== sorts[0].value);
  const passes = (it) => active_filters().every((f) => f.test(it, chosen[f.id]));
  const sortCmp = () => sorts.find((s) => s.value === sortBy)?.cmp;

  function refreshFilters() {
    const on = filtering();
    reset.hidden = !on;
    if (on) {
      const ex = exclude();
      const n = items.filter((it) => !ex.has(it.id) && passes(it)).length;
      count.textContent = `${n} ${n > 1 ? noun[1] : noun[0]}`;
    } else count.textContent = '';
    // La sélection s'affiche tout de suite, sans avoir à taper
    results = search(input.value);
    active = input.value.trim() && results.length ? 0 : -1;
    render();
  }

  /** Toutes les correspondances, meilleures en premier, sans les éléments déjà proposés. */
  function search(q) {
    const nq = normalize(q);
    const ex = exclude();
    const cmp = sortCmp();
    if (!nq) {
      if (!browse && !filtering()) return [];
      const all = alphabetical.filter((row) => !ex.has(row.it.id) && passes(row.it)).map((row) => row.it);
      return cmp ? all.sort((a, b) => cmp(a, b) || a.n.localeCompare(b.n, 'fr')) : all;
    }
    const scored = [];
    for (const row of index) {
      if (ex.has(row.it.id) || !passes(row.it)) continue;
      let score = -1;
      if (row.key === nq) score = 0;
      else if (row.key.startsWith(nq)) score = 1;
      else if (row.words.some((w) => w.startsWith(nq))) score = 2;
      else if (row.key.includes(nq)) score = 3;
      if (score >= 0) scored.push([score, row.key.length, row.it]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].n.localeCompare(b[2].n));
    const found = scored.map((s) => s[2]);
    // Un tri choisi par le joueur prime sur la pertinence
    return cmp ? found.sort((a, b) => cmp(a, b) || a.n.localeCompare(b.n, 'fr')) : found;
  }

  function itemEl(it, i) {
    return h('li.ac-item', {
      role: 'option', id: `ac-opt-${i}`, 'aria-selected': i === active ? 'true' : 'false',
      class: i === active ? 'active' : undefined,
      onmousedown: (e) => { e.preventDefault(); choose(it); },
    },
    it.img ? img(it.img, '', 'ac-img') : null,
    h('span.ac-text', h('span.ac-name', it.n), it.sub ? h('span.ac-sub', it.sub) : null),
    it.tag ? h('span.ac-tag', it.tag) : null);
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
  // Liste complète seulement quand le joueur la demande (clic dans le champ, flèche bas),
  // jamais quand le champ reçoit le focus automatiquement à l'arrivée sur un mode
  input.addEventListener('pointerdown', () => { if ((browse || filtering()) && !input.value.trim() && !results.length) setTimeout(refresh, 0); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && !results.length && browse && !input.value.trim()) { e.preventDefault(); refresh(); setActive(0); }
    else if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive(Math.min(active + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0 && !input.value.trim()) { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') { results = []; render(); }
  });
  // La liste se ferme quand on quitte la zone de recherche (pas en touchant les filtres)
  input.addEventListener('blur', () => setTimeout(() => { if (!block.contains(document.activeElement)) { results = []; render(); } }, 150));
  document.addEventListener('pointerdown', (e) => { if (results.length && !block.contains(e.target)) { results = []; render(); } });

  return {
    el: block,
    /** À appeler après chaque proposition : le compteur de la sélection suit. */
    sync() { if (filtering()) { const ex = exclude(); const n = items.filter((x) => !ex.has(x.id) && passes(x)).length; count.textContent = `${n} ${n > 1 ? noun[1] : noun[0]}`; } },
    focus: () => input.focus(),
    disable(flag) { input.disabled = flag; button.disabled = flag; form.classList.toggle('disabled', flag); bar?.querySelectorAll('select').forEach((s) => { s.disabled = flag; }); },
  };
}
