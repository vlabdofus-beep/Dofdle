// Page « Bestiaire » : les coffres à ouvrir (par 1 ou par 10) et l'album des cartes.
import { h, clear, toast } from './dom.js';
import { openModal, closeModal } from './modal.js';
import { loadDataset } from '../core/cache.js';
import { monstersDataset } from '../data/monsters.js';
import { itemsDataset } from '../data/items.js';
import { spellsDataset } from '../data/spells.js';
import { buildCards, RARITIES, SERIES, rarity } from '../data/cards.js';
import { collection, openChests, craftCard } from '../core/chests.js';
import { cardEl, cardBack, sealedPlate } from './card.js';
import { play } from './sound.js';
import { normalize } from '../core/text.js';

let SET = null;
async function cardSet() {
  if (!SET) {
    const [m, i, sp] = await Promise.all([loadDataset(monstersDataset), loadDataset(itemsDataset), loadDataset(spellsDataset)]);
    SET = buildCards(m, i, sp);
  }
  return SET;
}

const fmt = (n) => n.toLocaleString('fr-FR');
const plural = (n, one, many) => `${fmt(n)} ${n > 1 ? many : one}`;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function renderBestiary(root) {
  clear(root).append(h('div.loader', h('div.loader-label', 'Ouverture du Bestiaire…')));
  let set;
  try { set = await cardSet(); } catch {
    clear(root).append(h('div.panel.error', h('h3', 'Bestiaire indisponible'), h('p.muted', 'Les données des monstres n\'ont pas pu être chargées. Réessaie dans un instant.')));
    return;
  }
  clear(root);
  const head = h('div.bst-head');
  const album = h('section.bst-album', { 'aria-label': 'Album des cartes' });
  root.append(head, album);

  // --- En-tête : coffres et progression
  function drawHead() {
    const c = collection();
    const owned = set.cards.filter((x) => c.cards[x.id]).length;
    const stack = h('div.bst-stack', { 'aria-hidden': 'true' }, [0, 1, 2].map(() => cardBack()));
    head.replaceChildren(
      h('div.bst-title',
        h('h2', 'Bestiaire du Krosmoz'),
        h('p.muted', `${fmt(owned)} cartes sur ${fmt(set.cards.length)}`, h('span.bst-sep', { 'aria-hidden': 'true' }), plural(c.shards, 'éclat', 'éclats')),
        h('div.bst-progress', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(set.cards.length), 'aria-valuenow': String(owned), 'aria-label': 'Progression de l\'album' },
          h('i', { style: `width:${((owned / set.cards.length) * 100).toFixed(2)}%` }))),
      h('div.bst-chests',
        stack,
        h('div.bst-chest-info',
          h('p.bst-chest-count', h('strong', fmt(c.chests)), c.chests > 1 ? ' coffres à ouvrir' : ' coffre à ouvrir'),
          h('div.bst-actions',
            h('button.btn.primary', { type: 'button', disabled: c.chests < 1 || undefined, onclick: () => open(1) }, 'Ouvrir 1 coffre'),
            h('button.btn', { type: 'button', disabled: c.chests < 10 || undefined, onclick: () => open(10) }, 'Ouvrir 10 coffres')),
          h('p.small.muted', c.chests ? 'Par 10 : au moins une carte Rare garantie. ' : 'Gagne des coffres en réussissant les défis du jour. ',
            h('button.link', { type: 'button', onclick: showRates }, 'Chances et éclats')))));
  }

  // --- Album : filtres, vignettes, pages de 60
  const state = { series: '', rarity: '', owned: '', q: '', shown: 60 };
  const grid = h('div.bst-grid');
  const more = h('button.btn.bst-more', { type: 'button', onclick: () => { state.shown += 60; drawGrid(); } }, 'Afficher plus');
  const count = h('span.ac-count');
  const sel = (label, options, key) => h('select.ac-select', { 'aria-label': label, onchange: (e) => { state[key] = e.target.value; state.shown = 60; drawGrid(); } },
    options.map(([v, t]) => h('option', { value: v }, t)));
  const search = h('input.guess-input.bst-search', { type: 'search', placeholder: 'Chercher une carte', 'aria-label': 'Chercher une carte',
    oninput: (e) => { state.q = normalize(e.target.value); state.shown = 60; drawGrid(); } });
  album.append(
    h('div.bst-filters',
      search,
      sel('Série', [['', 'Toutes les séries'], ...SERIES.map((x) => [x.id, x.label])], 'series'),
      sel('Rareté', [['', 'Toutes les raretés'], ...RARITIES.map((r) => [String(r.id), r.label])], 'rarity'),
      sel('Cartes', [['', 'Toutes les cartes'], ['oui', 'Possédées'], ['non', 'Manquantes']], 'owned'),
      count),
    grid, more);

  function drawGrid() {
    const c = collection();
    const list = set.cards.filter((x) => (!state.series || x.series === state.series) && (!state.rarity || String(x.rarity) === state.rarity)
      && (!state.owned || (state.owned === 'oui') === !!c.cards[x.id])
      && (!state.q || normalize(x.name).includes(state.q)));
    count.textContent = plural(list.length, 'carte', 'cartes');
    grid.replaceChildren(...list.slice(0, state.shown).map((x) => {
      const n = c.cards[x.id] || 0;
      return h('button.bst-cell', { type: 'button', 'aria-label': n ? `${x.name}, possédée${n > 1 ? ` en ${n} exemplaires` : ''}` : `Carte n° ${x.num}, manquante`, onclick: () => showCard(x) },
        n ? cardEl(x, { count: n }) : cardBack({ missing: x }));
    }));
    more.hidden = list.length <= state.shown;
  }

  // --- Une carte en grand (et création avec des éclats si elle manque)
  function showCard(x) {
    const c = collection();
    const n = c.cards[x.id] || 0;
    const r = rarity(x.rarity);
    openModal(n ? x.name : `Carte n° ${x.num}`,
      h('div.bst-detail',
        h('div.bst-big', n ? cardEl(x) : cardBack({ missing: x })),
        n
          ? h('p.muted', n > 1 ? `${n} exemplaires. Chaque doublon de plus t'a rapporté ${plural(r.shards, 'éclat', 'éclats')}.` : 'Un exemplaire.')
          : h('div',
            h('p.muted', `Carte ${r.label.toLowerCase()} pas encore trouvée.`),
            h('button.btn.primary', { type: 'button', disabled: c.shards < r.cost || undefined,
              onclick: () => { if (craftCard(x)) { closeModal(); toast(`${x.name} rejoint ton Bestiaire !`); play('harvest'); refresh(); } } },
            `Créer avec ${plural(r.cost, 'éclat', 'éclats')}`),
            c.shards < r.cost ? h('p.small.muted', `Tu as ${plural(c.shards, 'éclat', 'éclats')}.`) : null)));
  }

  function showRates() {
    openModal('Chances et éclats',
      h('table.stats-table',
        h('thead', h('tr', h('th', 'Rareté'), h('th', 'Chance'), h('th', 'Doublon'), h('th', 'Créer'))),
        h('tbody', RARITIES.map((r) => h('tr',
          h('td', r.label), h('td', `${String(r.weight).replace('.', ',')} %`), h('td', `+${r.shards}`), h('td', fmt(r.cost)))))),
      h('p.small.muted', 'Chaque coffre contient une carte : une chance sur deux d\'un équipement, une chance sur deux d\'un monstre, d\'un sort, d\'une classe ou d\'un Dofus. La rareté est ensuite tirée selon ce tableau.'),
      h('p.small.muted', 'Ouverture par 10 : au moins une carte Rare ou mieux. Un doublon se transforme en éclats ; avec assez d\'éclats, tu crées la carte manquante de ton choix.'),
      h('p.small.muted', 'Les coffres se gagnent en jouant : 1 par défi réussi, 3 pour la journée complète, 2 à chaque évolution d\'un œuf de série. Rien ne s\'achète.'));
  }

  function refresh() { drawHead(); drawGrid(); }

  function open(n) {
    const draws = openChests(set, n);
    if (!draws) return;
    refresh();
    showOpening(draws, set, { onAgain: (k) => open(k), onClose: refresh });
  }

  refresh();
}

/** Ouverture : les cartes arrivent de dos, avec la lueur de leur rareté, et se retournent au clic. */
function showOpening(draws, set, { onAgain, onClose }) {
  document.querySelector('.chest-open')?.remove();
  const last = document.activeElement;
  const overlay = h('div.chest-open', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ouverture des coffres' });
  const grid = h(`div.co-grid${draws.length === 1 ? '.single' : ''}`);
  const summary = h('div.co-summary', { 'aria-live': 'polite' });
  let left = draws.length;

  // Briser le sceau, puis la planche se retourne ; les Rares et plus ont leur effet de révélation
  const flip = (slot, d) => {
    if (slot.classList.contains('breaking') || slot.classList.contains('flipped')) return;
    const r = d.card.rarity;
    slot.classList.add('breaking');
    slot.setAttribute('aria-label', `${d.card.name}, ${rarity(r).label.toLowerCase()}${d.dup ? ', doublon' : ', nouvelle'}`);
    const wait = reduceMotion() ? 0 : r >= 5 ? 650 : 320;
    if (r >= 5 && !reduceMotion()) slot.classList.add('charging');
    setTimeout(() => {
      slot.classList.add('flipped');
      if (r >= 3) {
        slot.classList.add(`fx${r}`);
        slot.querySelector('.co-front .bcard')?.classList.add('shine');
        if (r >= 5) { overlay.classList.remove('flash'); void overlay.offsetWidth; overlay.classList.add('flash'); }
      }
      play(r >= 5 ? 'day' : r >= 3 ? 'harvest' : 'reveal');
      if (--left === 0) done();
    }, wait);
  };
  draws.forEach((d, i) => {
    const slot = h('button.co-slot', { type: 'button', 'aria-label': `Pli ${i + 1} : briser le sceau`, style: `--i:${i}` },
      h('div.co-inner',
        h('div.co-face.co-back', sealedPlate(d.card.rarity)),
        h('div.co-face.co-front', cardEl(d.card), h(`span.co-tag${d.dup ? '' : '.new'}`, d.dup ? `Doublon, +${d.shards} éclat${d.shards > 1 ? 's' : ''}` : 'Nouvelle !'))));
    slot.addEventListener('click', () => flip(slot, d));
    grid.append(slot);
  });

  const all = h('button.btn', { type: 'button', onclick: () => {
    [...grid.children].forEach((slot, i) => setTimeout(() => flip(slot, draws[i]), reduceMotion() ? 0 : i * 110));
  } }, 'Tout ouvrir');
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); onClose?.(); last?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  function done() {
    const fresh = draws.filter((d) => !d.dup).length;
    const shards = draws.reduce((a, d) => a + d.shards, 0);
    const c = collection();
    all.remove();
    summary.replaceChildren(
      h('p', fresh ? `${plural(fresh, 'nouvelle carte', 'nouvelles cartes')} dans ton Bestiaire` : 'Que des doublons cette fois', shards ? `, +${plural(shards, 'éclat', 'éclats')}.` : '.'),
      h('div.co-actions',
        c.chests >= 1 ? h('button.btn', { type: 'button', onclick: () => { overlay.remove(); onAgain(1); } }, 'Ouvrir 1 coffre') : null,
        c.chests >= 10 ? h('button.btn', { type: 'button', onclick: () => { overlay.remove(); onAgain(10); } }, 'Ouvrir 10 coffres') : null,
        h('button.btn.primary', { type: 'button', onclick: close }, 'Voir le Bestiaire')));
    summary.querySelector('.btn.primary')?.focus();
  }

  overlay.append(
    h('div.co-head', h('h2', draws.length > 1 ? `${draws.length} coffres ouverts` : 'Coffre ouvert'), h('p.muted', 'Touche un pli pour briser son sceau.')),
    grid,
    h('div.co-bar', all, summary),
    h('button.modal-close.co-close', { type: 'button', 'aria-label': 'Fermer', onclick: close }, '×'));
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  grid.querySelector('.co-slot')?.focus();
}
