// Mode principal : Guess the Monster
import { h, img } from '../ui/dom.js';
import { normalize } from '../core/text.js';
import { createHints } from '../ui/hints.js';
import { monstersDataset, compareMonsters, monsterImg, monsterEntries, KIND_LABEL } from '../data/monsters.js';
import { colorsFromImage } from '../data/colors.js';

/** Couleurs absentes du snapshot : calculées depuis l'image (puis mises en cache). */
export async function ensureColors(entries) {
  await Promise.all(entries.filter((e) => e && e.ref && !e.ref.c).map(async (e) => {
    try { e.ref.c = await colorsFromImage(monsterImg(e.ref)); } catch { e.ref.c = []; }
  }));
}

export function monsterReveal(m, data, extra = null) {
  const sub = data.subareas[m.z];
  return h('div.reveal',
    img(monsterImg(m), m.n, 'reveal-img'),
    h('div',
      h('h3', m.n),
      h('p', `${data.races[m.r]?.n || ''} · ${KIND_LABEL[m.k]} · niveau ${m.l[0] === m.l[1] ? m.l[0] : m.l.join('–')}`),
      h('p.muted', `${sub?.n || ''}${sub ? ` — ${data.areas[sub.a] || ''}` : ''}`),
      extra,
      h('a.ext', { href: `https://dofusdb.fr/fr/database/monster/${m.id}`, target: '_blank', rel: 'noopener' }, 'Voir sur DofusDB ↗')));
}

const COLUMNS = ['race', 'level', 'hp', 'zone', 'kind', 'weak', 'color'];

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
  partialHelp: 'Partiel (plages qui se chevauchent, même région, couleur en commun…)',
  columns: [
    { key: 'race', label: 'Famille' },
    { key: 'level', label: 'Niveau', help: 'Orange : les plages de niveau se chevauchent' },
    { key: 'hp', label: 'PV', help: 'Points de vie (grade min – grade max). Orange : les plages se chevauchent' },
    { key: 'zone', label: 'Zone', help: 'Orange : le monstre vit aussi dans cette zone, ou même région' },
    { key: 'kind', label: 'Rang', help: 'Boss / Mini-boss / Archimonstre / Normal' },
    { key: 'weak', label: 'Faiblesse', help: 'Élément(s) de plus faible résistance au grade max' },
    { key: 'color', label: 'Couleur', help: 'Couleur dominante du monstre. Orange : une couleur en commun' },
  ],

  prepare(data) {
    const entries = monsterEntries(data, normalize);
    // Le daily évite les archimonstres (très nombreux et quasi identiques à leur monstre de base)
    const pool = entries.filter((e) => e.ref.k !== 'archi');
    return { entries, pool };
  },

  compare: (g, t, data) => compareMonsters(g, t, data, COLUMNS),
  ensure: ensureColors,

  clue(ctx) {
    const { target, data } = ctx;
    const sub = data.subareas[target.ref.z];
    return createHints(ctx, [
      { key: 'zone', at: 5, title: 'Zone principale', render: () => h('p', `${sub?.n || '?'} (${data.areas[sub?.a] || '?'})`) },
      { key: 'famille', at: 10, title: 'Famille', render: () => h('p', data.races[target.ref.r]?.n || '?') },
      { key: 'silhouette', at: 30, title: 'Silhouette', render: () => img(monsterImg(target.ref), 'Silhouette du monstre', 'silhouette') },
    ]);
  },

  reveal: (target, data) => monsterReveal(target.ref, data),
};
