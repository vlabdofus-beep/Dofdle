// Ordre des modes (navigation + lien "jeu suivant"). Pas d'import d'UI ici.
import { loadGame } from './storage.js';
import { todayKey } from './daily.js';

export const MODE_ORDER = [
  { id: 'monstre', label: 'Monstre' },
  { id: 'sort', label: 'Sort' },
  { id: 'carte', label: 'Carte' },
  { id: 'objet', label: 'Objet' },
  { id: 'cri', label: 'Cri' },
];

/** Prochain mode dont le défi du jour n'est pas encore réussi (sinon le suivant). */
export function nextMode(currentId) {
  const i = MODE_ORDER.findIndex((m) => m.id === currentId);
  const date = todayKey();
  for (let k = 1; k < MODE_ORDER.length; k++) {
    const m = MODE_ORDER[(i + k) % MODE_ORDER.length];
    if (!loadGame(m.id, date).won) return { ...m, done: false };
  }
  return { ...MODE_ORDER[(i + 1) % MODE_ORDER.length], done: true };
}
