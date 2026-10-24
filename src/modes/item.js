// Mode Objet : deviner un équipement à partir de ses effets ou de son icône floutée
import { h, img } from '../ui/dom.js';
import { hash, rng } from '../core/daily.js';
import { createHints } from '../ui/hints.js';
import { itemsDataset, compareItems, itemImg, itemEffectLines } from '../data/items.js';

export const itemMode = {
  id: 'objet',
  label: 'Objet',
  emoji: '🗡️',
  icon: 'assets/game/ui/mode-objet.png',
  salt: 'objet',
  dataset: itemsDataset,
  intro: 'Trouve l\'équipement du jour. Selon les jours, tu pars de ses effets ou de son icône floutée.',
  placeholder: 'Nom d\'un équipement (ex. Coiffe du Bouftou…)',
  nameLabel: 'Objet',
  yesterdayLabel: 'L\'objet d\'hier était',
  rowImages: false,
  partialHelp: 'Partiel (arme du même genre, niveau à ±10)',
  columns: [
    { key: 'type', label: 'Type', help: 'Type d\'équipement. Orange : arme du même genre' },
    { key: 'level', label: 'Niveau', help: 'Orange : à 10 niveaux près' },
    { key: 'set', label: 'Panoplie', help: 'Vert : même panoplie (ou aucun des deux n\'en a)' },
  ],

  prepare(data) {
    // Pas de vignette : l'icône des propositions permettrait de comparer avec l'icône floutée
    const entries = data.items.map((it) => ({ id: it.id, n: it.n, sub: `${data.types[it.t] || ''} · niv. ${it.l}`, ref: it }));
    const count = {};
    for (const e of entries) count[e.n] = (count[e.n] || 0) + 1;
    for (const e of entries) if (count[e.n] > 1) e.n = `${e.n} (niv. ${e.ref.l})`;
    // Daily : objets avec au moins 3 effets (sinon trop peu d'indices)
    const pool = entries.filter((e) => itemEffectLines(e.ref, data).length >= 3);
    return { entries, pool };
  },

  compare: (g, t, data) => compareItems(g, t, data).filter((c) => c.key !== 'element'),

  clue(ctx) {
    const { target, data, game } = ctx;
    const it = target.ref;
    const r = rng(hash(`objet-visuel|${game.date}`));
    const variant = r() < 0.55 ? 'stats' : 'icone';
    const lines = itemEffectLines(it, data);
    const picture = img(itemImg(it), 'Icône de l\'objet mystère');
    const list = h('ul.effects');

    const hintList = [
      { key: 'panoplie', at: 6, title: 'Panoplie', render: () => h('p', it.s ? data.sets[it.s] || 'Panoplie inconnue' : 'Cet objet ne fait partie d\'aucune panoplie') },
    ];
    if (variant === 'icone') {
      hintList.unshift({ key: 'effets', at: 4, title: 'Effets', render: () => h('ul.effects', lines.map((l) => h('li', l))) });
    }
    const hints = createHints(ctx, hintList, { className: 'compact' });

    const el = variant === 'stats'
      ? h('div.panel.clue', h('div.clue-visual', h('span', { style: { font: '700 64px var(--font-title)', color: 'var(--gold)' } }, '?')),
        h('div.clue-meta', h('h3', 'Effets de l\'objet'), h('p.muted', 'Un effet de plus à chaque essai.'), list, hints.el))
      : h('div.panel.clue', h('div.clue-visual', picture),
        h('div.clue-meta', h('h3', 'Icône floutée'), h('p.muted', 'Elle se précise à chaque essai. Clique sur les indices débloqués pour les révéler.'), hints.el));

    function update(g) {
      const n = g.guesses.length;
      const done = g.won;
      if (variant === 'stats') {
        const shown = done ? lines.length : Math.min(lines.length, 3 + n);
        list.replaceChildren(...lines.map((l, i) => (i < shown ? h('li', l) : h('li.hidden-fx', '• • •'))));
        if (done) el.querySelector('.clue-visual').replaceChildren(img(itemImg(it), it.n));
      } else {
        picture.style.filter = done ? '' : `blur(${Math.max(0, 10 - n * 1.6)}px) grayscale(${n >= 2 ? 0 : 1})`;
      }
      hints.update(g);
    }
    return { el, update };
  },

  reveal(target, data) {
    const it = target.ref;
    return h('div.reveal',
      img(itemImg(it), it.n, 'reveal-img'),
      h('div',
        h('h3', it.n),
        h('p', `${data.types[it.t] || ''} · niveau ${it.l}`),
        it.s ? h('p.muted', `Panoplie : ${data.sets[it.s] || '?'}`) : null,
        h('ul.effects.small', itemEffectLines(it, data).map((l) => h('li', l))),
        h('a.ext', { href: `https://dofusdb.fr/fr/database/object/${it.id}`, target: '_blank', rel: 'noopener' }, 'Voir sur DofusDB ↗')));
  },
};
