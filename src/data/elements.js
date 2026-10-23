// Éléments Dofus (ids DofusDB : effectElement / elementId)
export const ELEMENTS = {
  neutre: { id: 0, label: 'Neutre', icon: 'assets/game/elements/neutre.png', color: '#9a9a9a' },
  terre: { id: 1, label: 'Terre', icon: 'assets/game/elements/terre.png', color: '#a07a3c' },
  feu: { id: 2, label: 'Feu', icon: 'assets/game/elements/feu.png', color: '#e0632b' },
  eau: { id: 3, label: 'Eau', icon: 'assets/game/elements/eau.png', color: '#4aa3df' },
  air: { id: 4, label: 'Air', icon: 'assets/game/elements/air.png', color: '#62b04a' },
};
export const ELEMENT_BY_ID = Object.fromEntries(Object.entries(ELEMENTS).map(([k, v]) => [v.id, k]));

// Caractéristiques -> élément (effets d'objets)
export const STAT_EFFECT_TO_ELEMENT = { 118: 'terre', 126: 'feu', 123: 'eau', 119: 'air' };

// Effets de dégâts / vols de vie -> élément (sorts)
export const DAMAGE_EFFECTS = {
  91: 'eau', 92: 'terre', 93: 'air', 94: 'feu', 95: 'neutre', // vols
  96: 'eau', 97: 'terre', 98: 'air', 99: 'feu', 100: 'neutre', // dommages
};
export const HEAL_EFFECTS = new Set([108, 81, 143]);

/** Ordre d'affichage stable */
export const ELEMENT_ORDER = ['neutre', 'terre', 'feu', 'eau', 'air'];
export const sortElements = (arr) => [...arr].sort((a, b) => ELEMENT_ORDER.indexOf(a) - ELEMENT_ORDER.indexOf(b));
