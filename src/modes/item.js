// Mode Objet : deviner un équipement à partir de ses effets ou de son icône floutée
import { h, img } from '../ui/dom.js';
import { hash, rng } from '../core/daily.js';
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
  partialHelp: 'Partiel (arme du même genre, niveau à ±10, élément en commun)',
  columns: [
    { key: 'type', label: 'Type' },
    { key: 'level', label: 'Niveau', help: 'Orange : à 10 niveaux près' },
    { key: 'element', label: 'Élément', help: 'Caractéristique(s) élémentaire(s) dominante(s) : Force, Intelligence, Chance, Agilité' },
    { key: 'set', label: 'Panoplie' },
  ],

  prepare(data) {
    const entries = data.items.map((it) => ({ id: it.id, n: it.n, img: itemImg(it), sub: `${data.types[it.t] || ''} · niv. ${it.l}`, ref: it }));
    const count = {};
    for (const e of entries) count[e.n] = (count[e.n] || 0) + 1;
    for (const e of entries) if (count[e.n] > 1) e.n = `${e.n} (niv. ${e.ref.l})`;
    // Daily : objets avec au moins 3 effets (sinon trop peu d'indices)
    const pool = entries.filter((e) => itemEffectLines(e.ref, data).length >= 3);
    return { entries, pool };
  },

  compare: compareItems,

  clue(ctx) {
    const { target, data, game, endless } = ctx;
    const it = target.ref;
    const r = rng(endless ? Math.random() * 1e9 : hash(`objet-visuel|${game.date}`));
    const variant = r() < 0.55 ? 'stats' : 'icone';
    const lines = itemEffectLines(it, data);
    const picture = img(itemImg(it), 'Icône de l\'objet mystère');
    const list = h('ul.effects');
    const el = variant === 'stats'
      ? h('div.panel.clue', h('div.clue-visual', h('span', { style: { font: '700 64px var(--font-title)', color: 'var(--gold)' } }, '?')),
        h('div.clue-meta', h('h3', 'Effets de l\'objet'), list))
      : h('div.panel.clue', h('div.clue-visual', picture),
        h('div.clue-meta', h('h3', 'Icône floutée'), h('p.muted', 'Elle se précise à chaque essai. Les effets arrivent après 4 essais.'), list));

    function update(g) {
      const n = g.guesses.length;
      const done = g.won;
      if (variant === 'stats') {
        const shown = done ? lines.length : Math.min(lines.length, 3 + n);
        list.replaceChildren(...lines.map((l, i) => (i < shown ? h('li', l) : h('li.hidden-fx', '• • •'))));
        const visual = el.querySelector('.clue-visual');
        if (done) visual.replaceChildren(img(itemImg(it), it.n));
      } else {
        picture.style.filter = done ? '' : `blur(${Math.max(0, 14 - n * 1.8)}px) grayscale(${n >= 3 ? 0 : 1})`;
        const shown = done ? lines.length : Math.max(0, n - 3);
        const rows = lines.slice(0, shown).map((l) => h('li', l));
        if (!done && shown < lines.length) rows.push(h('li.hidden-fx', shown ? '• • •' : `Effets révélés dans ${4 - n} essai${4 - n > 1 ? 's' : ''}`));
        list.replaceChildren(...rows);
      }
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
        h('a.ext', { href: `https://dofusdb.fr/fr/database/object/${it.id}`, target: '_blank', rel: 'noopener' }, 'Voir sur DofusDB ↗')));
  },
};
