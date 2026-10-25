// Œuf de série : un Dofus qui évolue tous les 5 jours de série, du Dofawa vers des
// Dofus plus rares. Les six Dofus primordiaux sont réservés aux modes de jeu.
import { h } from './dom.js';

export const STEP = 5;
// [nom, icône DofusDB, couleur de l'aura (teinte dominante de l'icône)]
export const STREAK_EGGS = [
  ['Dofawa', 23009, '#d8842d'],
  ['Dofus Cawotte', 23006, '#e68e1e'],
  ['Dokille', 23017, '#6da5da'],
  ['Dofus Kaliptus', 23010, '#bbdf6f'],
  ['Dolmanax', 23018, '#da664c'],
  ['Dofus Vulbis', 23004, '#c4402a'],
  ['Dofus des Glaces', 23005, '#7ac5e0'],
  ['Dofus Tacheté', 23008, '#a7ca9f'],
  ['Dofus Nébuleux', 23016, '#788cdf'],
  ['Dofus Abyssal', 23023, '#5cbebb'],
  ['Dofus Forgelave', 23024, '#d19227'],
  ['Dofus du Cauchemar', 23034, '#c08a5a'],
];

const eggImg = (icon) => `https://api.dofusdb.fr/img/items/${icon}.png`;

/** Palier atteint pour une série de n jours (0 = pas de série). */
export function streakTier(n) {
  const i = Math.min(STREAK_EGGS.length - 1, Math.floor(Math.max(0, n) / STEP));
  const [name, icon, color] = STREAK_EGGS[i];
  const next = STREAK_EGGS[i + 1];
  return { index: i, name, icon, color, next: next ? next[0] : null, nextIn: next ? (i + 1) * STEP - n : 0 };
}

/** Texte d'info-bulle : Dofus actuel et prochaine évolution. */
export function streakTitle(n) {
  if (!n) return 'Pas de série en cours : réussis le défi pour faire éclore ton Dofawa';
  const t = streakTier(n);
  return t.next
    ? `${t.name} : évolue en ${t.next} dans ${t.nextIn} jour${t.nextIn > 1 ? 's' : ''}`
    : `${t.name} : le plus rare des œufs de série`;
}

/**
 * Petit œuf de série. Sans série, un Dofawa éteint ; ensuite, une aura discrète
 * à la couleur du Dofus, un peu plus présente à chaque palier.
 */
export function streakEgg(n) {
  const t = streakTier(n);
  const strength = n ? 0.22 + Math.min(t.index, 8) * 0.05 : 0;
  return h(`span.streak-egg${n ? '.on' : ''}`, {
    'aria-hidden': 'true', title: streakTitle(n), 'data-tier': String(t.index),
    style: `--aura:${t.color};--aura-a:${strength.toFixed(2)}`,
  }, h('img', { src: eggImg(t.icon), alt: '', width: 22, height: 22 }));
}
