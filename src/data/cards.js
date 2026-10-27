// Cartes du Bestiaire du Krosmoz : une carte par monstre jouable et par Dofus.
// La rareté découle des données : Dofus > boss > archimonstres > monstres de niveau 160+ > le reste.
import { monsterEntries, monsterImg } from './monsters.js';
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

export const UNCOMMON_LEVEL = 160;

/** Toutes les cartes, dans l'ordre des planches (Dofus en dernier). */
export function buildCards(data) {
  const monsters = monsterEntries(data, normalize).filter((e) => !e.hidden).map((e) => {
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
  monsters.forEach((c, i) => { c.num = String(i + 1).padStart(4, '0'); });
  const dofus = DOFUS.map(([id, name, lvl, icon], i) => ({
    id: `d${id}`, name, rarity: 5, img: `https://api.dofusdb.fr/img/items/${icon}.png`,
    family: PRIMORDIAUX.has(icon) ? 'Dofus primordial' : 'Dofus', habitat: 'Krosmoz', level: [lvl, lvl],
    num: `D-${String(i + 1).padStart(2, '0')}`,
  }));
  const cards = [...monsters, ...dofus];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const byRarity = RARITIES.map((r) => cards.filter((c) => c.rarity === r.id));
  return { cards, byId, byRarity };
}
