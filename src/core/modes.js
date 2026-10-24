// Ordre des modes (navigation + lien "jeu suivant"). Pas d'import d'UI ici.
import { loadGame } from './storage.js';
import { todayKey } from './daily.js';

// Chaque mode est associé à l'un des six Dofus primordiaux : réussir le défi du jour
// d'un mode, c'est "récolter" son Dofus.
export const MODE_ORDER = [
  { id: 'monstre', label: 'Monstre', dofus: 'Pourpre', icon: 23001, badge: 'assets/game/ui/mode-monstre.png',
    tagline: 'Devine le monstre grâce à sa famille, son niveau, sa zone et ses faiblesses.' },
  { id: 'sort', label: 'Sort', dofus: 'Turquoise', icon: 23003, badge: 'assets/game/ui/mode-sort.png',
    tagline: 'Reconnais le sort de classe caché derrière son icône floutée ou zoomée.' },
  { id: 'carte', label: 'Carte', dofus: 'Émeraude', icon: 23002, badge: 'assets/game/ui/mode-carte.png',
    tagline: 'Situe la map mystère sur la carte du Monde des Douze.' },
  { id: 'objet', label: 'Objet', dofus: 'Ocre', icon: 23012, badge: 'assets/game/ui/mode-objet.png',
    tagline: 'Retrouve l\'équipement à partir de ses effets ou de son icône.' },
  { id: 'cri', label: 'Cri', dofus: 'Ivoire', icon: 23011, badge: 'assets/game/ui/mode-cri.png',
    tagline: 'Écoute le cri et retrouve le monstre qui le pousse.' },
  { id: 'juste-prix', label: 'Juste prix', dofus: 'Ébène', icon: 23007, badge: 'assets/game/ui/mode-chiffre.png',
    tagline: 'Trouve le nombre exact d\'une question improbable sur le jeu.' },
];

/** Icône officielle du Dofus d'un mode (servie par DofusDB, comme les autres images du jeu). */
export const dofusImg = (id) => `https://api.dofusdb.fr/img/items/${modeInfo(id).icon}.png`;

export const modeInfo = (id) => MODE_ORDER.find((m) => m.id === id) || MODE_ORDER[0];

/** Dofus récoltés aujourd'hui (défis du jour réussis). */
export const harvestedToday = (date = todayKey()) => MODE_ORDER.filter((m) => loadGame(m.id, date).won).map((m) => m.id);

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
