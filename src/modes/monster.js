// Mode principal : Guess the Monster
import { h, img } from '../ui/dom.js';
import { normalize } from '../core/text.js';
import { monstersDataset, compareMonsters, monsterImg, KIND_LABEL } from '../data/monsters.js';
import { colorsFromImage } from '../data/colors.js';

/** Indices déblocables (silhouette, zone) */
function hintsClue(ctx, hints) {
  const el = h('div.hints');
  const update = (game) => {
    el.replaceChildren(...hints.map((hint) => {
      const left = hint.at - game.guesses.length;
      const unlocked = left <= 0 || game.won;
      const btn = h('button.hint', {
        disabled: !unlocked,
        class: hint.open ? 'open' : undefined,
        onclick: () => { hint.open = !hint.open; update(game); },
      }, h('span.hint-title', hint.title), h('span.hint-state', unlocked ? (hint.open ? 'Masquer' : 'Révéler') : `dans ${left} essai${left > 1 ? 's' : ''}`));
      return h('div.hint-wrap', btn, unlocked && hint.open ? h('div.hint-body', hint.render()) : null);
    }));
  };
  return { el, update };
}

export const monsterMode = {
  id: 'monstre',
  label: 'Monstre',
  emoji: '🐉',
  icon: 'assets/game/ui/mode-monstre.png',
  salt: 'monstre',
  dataset: monstersDataset,
  intro: 'Devine le monstre du jour. Chaque proposition révèle ce qu\'elle a en commun avec lui.',
  placeholder: 'Nom d\'un monstre (ex. Bouftou, Tofu…)',
  nameLabel: 'Monstre',
  partialHelp: 'Partiel (même famille, même région, couleur en commun…)',
  columns: [
    { key: 'race', label: 'Famille', help: 'Orange : même super-famille' },
    { key: 'level', label: 'Niveau', help: 'Orange : les plages de niveau se chevauchent' },
    { key: 'zone', label: 'Zone', help: 'Orange : le monstre vit aussi dans cette zone, ou même région' },
    { key: 'kind', label: 'Rang', help: 'Boss / Mini-boss / Archimonstre / Normal' },
    { key: 'weak', label: 'Faiblesse', help: 'Élément(s) de plus faible résistance au grade max' },
    { key: 'drop', label: 'Drop notable', help: 'Orange : même type de ressource' },
    { key: 'color', label: 'Couleur', help: 'Couleur dominante du monstre. Orange : une couleur en commun' },
  ],

  prepare(data) {
    // Un seul monstre par nom (certaines variantes partagent leur nom)
    const seen = new Set();
    const entries = [];
    for (const m of data.monsters) {
      const key = normalize(m.n);
      if (seen.has(key)) continue;
      seen.add(key);
      const race = data.races[m.r]?.n || '';
      entries.push({ id: m.id, n: m.n, img: monsterImg(m), sub: `${race} · niv. ${m.l[0] === m.l[1] ? m.l[0] : m.l.join('–')}`, ref: m });
    }
    // Le daily évite les archimonstres (très nombreux et quasi identiques à leur monstre de base)
    const pool = entries.filter((e) => e.ref.k !== 'archi');
    return { entries, pool };
  },

  compare: compareMonsters,

  /** Couleurs absentes du snapshot : calculées depuis l'image (puis mises en cache). */
  async ensure(entries) {
    await Promise.all(entries.filter((e) => e && !e.ref.c).map(async (e) => {
      try { e.ref.c = await colorsFromImage(monsterImg(e.ref)); } catch { e.ref.c = []; }
    }));
  },

  clue(ctx) {
    const { target, data } = ctx;
    return hintsClue(ctx, [
      { at: 5, title: 'Zone principale', render: () => h('p', `${data.subareas[target.ref.z]?.n} (${data.areas[data.subareas[target.ref.z]?.a] || '?'})`) },
      { at: 11, title: 'Silhouette', render: () => img(monsterImg(target.ref), 'Silhouette du monstre', 'silhouette') },
    ]);
  },

  reveal(target, data) {
    const m = target.ref;
    const sub = data.subareas[m.z];
    return h('div.reveal',
      img(monsterImg(m), m.n, 'reveal-img'),
      h('div',
        h('h3', m.n),
        h('p', `${data.races[m.r]?.n || ''} · ${KIND_LABEL[m.k]} · niveau ${m.l[0] === m.l[1] ? m.l[0] : m.l.join('–')}`),
        h('p.muted', `${sub?.n || ''}${sub ? ` — ${data.areas[sub.a] || ''}` : ''}`),
        h('a.ext', { href: `https://dofusdb.fr/fr/database/monster/${m.id}`, target: '_blank', rel: 'noopener' }, 'Voir sur DofusDB ↗')));
  },
};
