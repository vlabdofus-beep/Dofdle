// Œuf de série : un Dofus qui évolue tous les 5 jours de série, du Dofawa vers des
// Dofus plus rares. Les six Dofus primordiaux sont réservés aux modes de jeu.
import { h } from './dom.js';

export const STEP = 5;
// [nom, icône DofusDB, couleur de l'aura]
export const STREAK_EGGS = [
  ['Dofawa', 23009, '#d8b98a'],
  ['Dofus Cawotte', 23006, '#f08a2c'],
  ['Dokille', 23017, '#9bd16a'],
  ['Dofus Kaliptus', 23010, '#6fcf8e'],
  ['Dolmanax', 23018, '#e4c25a'],
  ['Dofus Vulbis', 23004, '#b48cf0'],
  ['Dofus des Glaces', 23005, '#8fd6f2'],
  ['Dofus Tacheté', 23008, '#e6d8b0'],
  ['Dofus Nébuleux', 23016, '#9aa8ff'],
  ['Dofus Abyssal', 23023, '#4fb6d8'],
  ['Dofus Forgelave', 23024, '#ff7a3c'],
  ['Dofus du Cauchemar', 23034, '#d05a8c'],
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
  }, h('img', { src: eggImg(t.icon), alt: '', width: 22, height: 22, loading: 'lazy' }));
}
