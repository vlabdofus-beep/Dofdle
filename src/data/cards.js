// Cartes du Bestiaire du Krosmoz : monstres, équipements, sorts, classes et Dofus.
// Raretés, d'après les données du jeu :
//  - monstres : Dofus > boss > archimonstres > niveau 140+ > le reste
//  - équipements : objets légendaires > niveau 200 > 180-199 > 100-179 > le reste
//  - sorts : 6 PA et plus Épique, 4-5 PA Peu commune, 3 PA et moins Commune
//  - classes : toutes Épiques
import { monsterEntries, monsterImg } from './monsters.js';
import { itemImg } from './items.js';
import { spellImg } from './spells.js';
import { ELEMENTS } from './elements.js';
import { normalize } from '../core/text.js';

export const RARITIES = [
  { id: 1, key: 'commune', label: 'Commune', weight: 70, shards: 1, cost: 10 },
  { id: 2, key: 'peu-commune', label: 'Peu commune', weight: 20, shards: 3, cost: 30 },
  { id: 3, key: 'rare', label: 'Rare', weight: 7, shards: 10, cost: 100 },
  { id: 4, key: 'epique', label: 'Épique', weight: 2.5, shards: 25, cost: 250 },
  { id: 5, key: 'legendaire', label: 'Légendaire', weight: 0.5, shards: 100, cost: 1000 },
];
export const rarity = (id) => RARITIES[id - 1];

// Dofus (objets de type « Dofus » sur DofusDB) : [id, nom, niveau, icône]. Un exemplaire par nom.
const DOFUS = [
  [7113, 'Dofawa', 6, 23009], [19629, 'Dofus Argenté', 20, 23025], [30356, 'Jyfus', 20, 23038],
  [20833, 'Dofus Cacao', 50, 23029], [972, 'Dofus Cawotte', 60, 23006], [10907, 'Dokille', 80, 23017],
  [17078, 'Dokoko', 80, 23022], [737, 'Dofus Émeraude', 100, 23002], [8072, 'Dofus Kaliptus', 100, 23010],
  [13344, 'Dolmanax', 100, 23018], [16061, 'Dofus des Veilleurs', 100, 23020], [694, 'Dofus Pourpre', 110, 23001],
  [15235, 'Dotruche', 110, 23019], [23237, 'Domakuro', 120, 23032], [23408, 'Dorigami', 150, 23033],
  [739, 'Dofus Turquoise', 160, 23003], [7754, 'Dofus Ocre', 160, 23012], [31794, 'Dofoozbz', 170, 23039],
  [6980, 'Dofus Vulbis', 180, 23004], [7043, 'Dofus des Glaces', 180, 23005], [7112, 'Dofus Tacheté', 180, 23008],
  [7114, 'Dofus Ébène', 180, 23007], [7115, 'Dofus Ivoire', 180, 23011], [8698, 'Dofus Nébuleux', 180, 23016],
  [18043, 'Dofus Abyssal', 180, 23023], [19398, 'Dofus Forgelave', 180, 23024], [20286, 'Dofus Argenté Scintillant', 180, 23027],
  [26066, 'Dofus du Cauchemar', 180, 23034], [27803, 'Dom de Pin', 180, 23035], [29134, 'Dofus Sylvestre', 180, 23036],
  [29135, 'Dofus Verdoyant', 180, 23037],
];
const PRIMORDIAUX = new Set([23001, 23002, 23003, 23007, 23011, 23012]);

export const UNCOMMON_LEVEL = 140;

// Équipements légendaires (isLegendary sur DofusDB)
const LEGENDARY_ITEMS = new Set([20353, 20354, 20355, 20356, 20357, 20358, 20359, 20360, 20361, 20362, 20363, 20364, 20365,
  20366, 22368, 22412, 22429, 22444, 32114, 32115, 32116, 32117, 32118, 32119, 32121, 32163]);
const itemRarity = (it) => (LEGENDARY_ITEMS.has(it.id) ? 5 : it.l >= 200 ? 4 : it.l >= 180 ? 3 : it.l >= 100 ? 2 : 1);
const spellRarity = (s) => (s.pa >= 6 ? 4 : s.pa >= 4 ? 2 : 1);

export const SERIES = [
  { id: 'm', label: 'Monstres' }, { id: 'e', label: 'Équipements' }, { id: 's', label: 'Sorts' },
  { id: 'c', label: 'Classes' }, { id: 'd', label: 'Dofus' },
];
const pad = (n, w) => String(n).padStart(w, '0');

/**
 * Toutes les cartes, série par série, dans l'ordre des planches.
 * @param {object} monsters données Monstres ; items, spells : facultatives
 */
export function buildCards(monsters, items = null, spells = null) {
  const data = monsters;
  const mons = monsterEntries(data, normalize).filter((e) => !e.hidden).map((e) => {
    const m = e.ref;
    const r = m.k === 'boss' ? 4 : m.k === 'archi' ? 3 : m.l[1] >= UNCOMMON_LEVEL ? 2 : 1;
    const race = data.races[m.r]?.n || '';
    const sub = data.subareas[m.z];
    return {
      id: `m${m.id}`, name: m.n, rarity: r, img: monsterImg(m),
      family: m.k === 'boss' ? (race ? `Boss des ${race}` : 'Boss') : race,
      habitat: data.areas[sub?.a] || sub?.n || 'Inconnu', level: m.l,
    };
  }).sort((a, b) => a.level[0] - b.level[0] || a.name.localeCompare(b.name, 'fr'));
  mons.forEach((c, i) => { c.num = pad(i + 1, 4); c.series = 'm'; });
  const dofus = DOFUS.map(([id, name, lvl, icon], i) => ({
    id: `d${id}`, name, rarity: 5, img: `https://api.dofusdb.fr/img/items/${icon}.png`,
    family: PRIMORDIAUX.has(icon) ? 'Dofus primordial' : 'Dofus', habitat: 'Krosmoz', level: [lvl, lvl],
    num: `D-${pad(i + 1, 2)}`, series: 'd',
  }));

  const equip = !items ? [] : [...items.items].sort((a, b) => a.l - b.l || a.n.localeCompare(b.n, 'fr')).map((it, i) => ({
    id: `e${it.id}`, name: it.n, rarity: itemRarity(it), img: itemImg(it), series: 'e', num: `E-${pad(i + 1, 4)}`,
    family: items.types[it.t] || 'Équipement', level: [it.l, it.l],
    habitat: it.s ? (items.sets[it.s] || 'Panoplie') : 'Hors panoplie', habLabel: 'Panoplie',
  }));

  const spellCards = !spells ? [] : [...spells.spells].sort((a, b) => a.b - b.b || a.n.localeCompare(b.n, 'fr')).map((sp, i) => ({
    id: `s${sp.id}`, name: sp.n, rarity: spellRarity(sp), img: spellImg(sp), series: 's', num: `S-${pad(i + 1, 4)}`,
    family: spells.breeds[sp.b] || 'Sort', habLabel: 'Élément',
    habitat: (sp.el || []).length ? sp.el.map((e) => ELEMENTS[e]?.label || e).join(', ') : (sp.soin ? 'Soin' : 'Aucun'),
    stat: `${sp.pa} PA, portée ${sp.po[0] === sp.po[1] ? sp.po[0] : `${sp.po[0]} à ${sp.po[1]}`}`,
  }));

  const classes = !spells ? [] : Object.entries(spells.breeds).map(([id, name], i) => {
    const n = spells.spells.filter((sp) => String(sp.b) === id).length;
    return {
      id: `c${id}`, name, rarity: 4, img: `https://api.dofusdb.fr/img/breeds/logo_transparent_${id}.png`, series: 'c',
      num: `C-${pad(i + 1, 2)}`, family: 'Classe', habLabel: 'Sorts', habitat: `${n} sort${n > 1 ? 's' : ''}`, stat: 'Classe du Monde des Douze',
    };
  });
  const cards = [...mons, ...equip, ...spellCards, ...classes, ...dofus];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const byRarity = RARITIES.map((r) => cards.filter((c) => c.rarity === r.id));
  return { cards, byId, byRarity };
}
