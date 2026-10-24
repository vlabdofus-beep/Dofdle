// Mode Sort : deviner un sort de classe à partir de son icône (floutée ou zoomée)
import { h, img } from '../ui/dom.js';
import { hash, rng } from '../core/daily.js';
import { spellsDataset, compareSpells, spellImg, breedHead } from '../data/spells.js';
import { ELEMENTS } from '../data/elements.js';
import { createHints } from '../ui/hints.js';

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
  yesterdayLabel: 'Le sort d\'hier était',
  rowImages: false,
  partialHelp: 'Partiel (élément en commun, valeur à ±1)',
  columns: [
    { key: 'breed', label: 'Classe', help: 'Classe à laquelle appartient le sort' },
    { key: 'element', label: 'Élément', help: 'Élément(s) des dommages / vols de vie' },
    { key: 'pa', label: 'Coût PA', help: 'Au rang maximal du sort' },
    { key: 'po', label: 'Portée', help: 'Portée maximale (au rang max)' },
  ],

  prepare(data) {
    // Pas de vignette : l'icône des propositions permettrait de comparer avec l'icône mystère
    const entries = data.spells.map((s) => ({ id: s.id, n: s.n, sub: data.breeds[s.b], ref: s }));
    // Désambiguïse les rares homonymes entre classes
    const count = {};
    for (const e of entries) count[e.n] = (count[e.n] || 0) + 1;
    for (const e of entries) if (count[e.n] > 1) e.n = `${e.n} (${e.sub})`;
    return { entries, pool: entries };
  },

  compare: compareSpells,

  clue(ctx) {
    const { target, data, game } = ctx;
    const s = target.ref;
    const seed = hash(`sort-visuel|${game.date}`);
    const r = rng(seed);
    const variant = r() < 0.5 ? 'flou' : 'zoom';
    // Zoom centré sur le motif du sort (léger décalage pour varier), jamais dans un coin
    const origin = `${Math.round(42 + r() * 16)}% ${Math.round(42 + r() * 16)}%`;
    const picture = img(spellImg(s), 'Icône du sort mystère');
    picture.style.transformOrigin = origin;
    const hints = createHints(ctx, [
      { key: 'cout', at: 3, title: 'Coût & portée', render: () => h('div.chips', h('span.chip', img('assets/game/ui/pa.png', ''), `${s.pa} PA`), h('span.chip', img('assets/game/ui/po.png', ''), `PO ${s.po[0]}–${s.po[1]}${s.pb ? '' : ' (non modifiable)'}`)) },
      { key: 'element', at: 5, title: 'Élément', render: () => h('div.chips', elementChips(s)) },
      { key: 'classe', at: 7, title: 'Classe', render: () => h('div.chips', h('span.chip', img(breedHead(s.b), ''), data.breeds[s.b])) },
    ], { className: 'compact' });
    const el = h('div.panel.clue',
      h('div.clue-visual', picture),
      h('div.clue-meta',
        h('h3', variant === 'flou' ? 'Icône floutée' : 'Icône zoomée'),
        h('p.muted', 'Elle se dévoile à chaque essai. Des indices se débloquent en chemin : clique pour les révéler.'),
        hints.el));

    function update(g) {
      const n = g.guesses.length;
      const done = g.won;
      if (variant === 'flou') {
        const blur = done ? 0 : Math.max(0, 9 - n * 1.5);
        picture.style.filter = `blur(${blur}px) ${done || n >= 3 ? '' : 'grayscale(1)'}`;
      } else {
        const scale = done ? 1 : Math.max(1, 3 - n * 0.35);
        picture.style.transform = `scale(${scale})`;
        picture.style.filter = done || n >= 3 ? '' : 'grayscale(1)';
      }
      hints.update(g);
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
