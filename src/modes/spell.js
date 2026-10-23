// Mode Sort : deviner un sort de classe à partir de son icône (floutée ou zoomée)
import { h, img } from '../ui/dom.js';
import { hash, rng } from '../core/daily.js';
import { spellsDataset, compareSpells, spellImg, breedHead } from '../data/spells.js';
import { ELEMENTS } from '../data/elements.js';

const HINTS = [
  { at: 3, label: 'Coût & portée' },
  { at: 5, label: 'Élément' },
  { at: 7, label: 'Classe' },
];

function elementChips(s) {
  if (s.el.length) return s.el.map((e) => h('span.chip', img(ELEMENTS[e].icon, ''), ELEMENTS[e].label));
  return [h('span.chip', s.soin ? 'Soin' : 'Aucun élément (sort utilitaire)')];
}

export const spellMode = {
  id: 'sort',
  label: 'Sort',
  emoji: '✨',
  icon: 'assets/game/ui/mode-sort.png',
  salt: 'sort',
  dataset: spellsDataset,
  intro: 'Retrouve le sort de classe caché derrière cette icône. Elle se dévoile un peu plus à chaque essai.',
  placeholder: 'Nom d\'un sort (ex. Flèche Magique, Pression…)',
  nameLabel: 'Sort',
  partialHelp: 'Partiel (élément en commun, valeur à ±1)',
  columns: [
    { key: 'breed', label: 'Classe' },
    { key: 'element', label: 'Élément', help: 'Élément(s) des dommages / vols de vie' },
    { key: 'pa', label: 'Coût PA', help: 'Au rang maximal du sort' },
    { key: 'po', label: 'Portée', help: 'Portée maximale (au rang max)' },
  ],

  prepare(data) {
    const entries = data.spells.map((s) => ({ id: s.id, n: s.n, img: spellImg(s), sub: data.breeds[s.b], ref: s }));
    // Désambiguïse les rares homonymes entre classes
    const count = {};
    for (const e of entries) count[e.n] = (count[e.n] || 0) + 1;
    for (const e of entries) if (count[e.n] > 1) e.n = `${e.n} (${e.sub})`;
    return { entries, pool: entries };
  },

  compare: compareSpells,

  clue(ctx) {
    const { target, data, game, endless } = ctx;
    const s = target.ref;
    const seed = endless ? Math.random() * 1e9 : hash(`sort-visuel|${game.date}`);
    const r = rng(seed);
    const variant = r() < 0.5 ? 'flou' : 'zoom';
    const origin = `${Math.round(20 + r() * 60)}% ${Math.round(20 + r() * 60)}%`;
    const picture = img(spellImg(s), 'Icône du sort mystère');
    picture.style.transformOrigin = origin;
    const chips = h('div.chips');
    const el = h('div.panel.clue',
      h('div.clue-visual', picture),
      h('div.clue-meta',
        h('h3', variant === 'flou' ? 'Icône floutée' : 'Icône zoomée'),
        h('p.muted', 'Indices débloqués au fil des essais :'),
        chips));

    function update(g) {
      const n = g.guesses.length;
      const done = g.won;
      if (variant === 'flou') {
        const blur = done ? 0 : Math.max(0, 12 - n * 1.6);
        picture.style.filter = `blur(${blur}px) ${done || n >= 4 ? '' : 'grayscale(1)'}`;
      } else {
        const scale = done ? 1 : Math.max(1, 4.2 - n * 0.45);
        picture.style.transform = `scale(${scale})`;
        picture.style.filter = done || n >= 4 ? '' : 'grayscale(1)';
      }
      chips.replaceChildren(...HINTS.map((hint, i) => {
        const left = hint.at - n;
        if (left > 0 && !done) return h('span.chip.locked', `${hint.label} — dans ${left} essai${left > 1 ? 's' : ''}`);
        if (i === 0) return h('span.chip', img('assets/game/ui/pa.png', ''), `${s.pa} PA · `, img('assets/game/ui/po.png', ''), `PO ${s.po[0]}–${s.po[1]}${s.pb ? '' : ' (non modifiable)'}`);
        if (i === 1) return elementChips(s);
        return h('span.chip', img(breedHead(s.b), ''), data.breeds[s.b]);
      }).flat());
    }
    return { el, update };
  },

  reveal(target, data) {
    const s = target.ref;
    return h('div.reveal',
      img(spellImg(s), s.n, 'reveal-img'),
      h('div',
        h('h3', s.n),
        h('p', h('img', { src: breedHead(s.b), alt: '', width: 22, height: 22, style: { verticalAlign: 'middle' } }), ` ${data.breeds[s.b]} · ${s.pa} PA · PO ${s.po[0]}–${s.po[1]}`),
        s.de ? h('p.muted', { style: { maxWidth: '460px' } }, s.de) : null,
        h('a.ext', { href: `https://dofusdb.fr/fr/database/spell/${s.id}`, target: '_blank', rel: 'noopener' }, 'Voir sur DofusDB ↗')));
  },
};
