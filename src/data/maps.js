// Jeu de données "Cartes" — DofusDB /subareas, /areas, /map-positions
// Contient les sous-zones du Monde des Douze et toutes les maps "réelles" de
// la carte du monde (worldMap 1, prioritaires) : de quoi tirer la map du jour,
// dessiner la mini-carte et calculer les distances sans autre requête.
import { tr } from '../core/text.js';
import { stepper } from '../core/cache.js';
import { rankDaily } from '../core/daily.js';

export const WORLD_SUPER_AREA = 0; // Monde des Douze
export const WORLD_MAP = 1;

export const mapsDataset = {
  key: 'maps',
  version: 3,
  async build(api, onProgress = () => {}) {
    const step = stepper(onProgress, [['Zones', 1], ['Sous-zones', 2], ['Maps', 6]]);
    const areas = await api.getAll('areas', { '$select': ['id', 'name', 'superAreaId'] }, { onProgress: step.Zones });
    const subareas = await api.getAll('subareas', { '$select': ['id', 'name', 'areaId', 'displayOnWorldMap'] }, { onProgress: step['Sous-zones'] });
    // Toutes les maps de la carte du monde, sauf ~1 800 doublons/instances non prioritaires
    // placés en [0,0]. Beaucoup de vraies maps (Cania, Pandala…) n'ont pas le drapeau
    // "prioritaire" : on garde une map par coordonnée, la prioritaire si elle existe.
    const positions = await api.getAll('map-positions', {
      worldMap: WORLD_MAP,
      '$or[0][hasPriorityOnWorldmap]': true,
      '$or[1][posX][$ne]': 0,
      '$or[2][posY][$ne]': 0,
      '$select': ['id', 'posX', 'posY', 'subAreaId', 'outdoor', 'hasPriorityOnWorldmap'],
    }, { onProgress: step.Maps });

    const areaMap = Object.fromEntries(areas.map((a) => [a.id, { n: tr(a.name), sa: a.superAreaId }]));
    const subs = subareas
      .filter((s) => tr(s.name) && areaMap[s.areaId]?.sa === WORLD_SUPER_AREA)
      .map((s) => ({ id: s.id, n: tr(s.name), a: s.areaId, w: s.displayOnWorldMap ? 1 : 0 }));
    const subIds = new Set(subs.map((s) => s.id));
    // [mapId, x, y, sousZone, extérieur]
    const byCoord = new Map();
    for (const p of positions) {
      if (!subIds.has(p.subAreaId)) continue;
      const k = `${p.posX},${p.posY}`;
      const cur = byCoord.get(k);
      if (!cur || (p.hasPriorityOnWorldmap && !cur.hasPriorityOnWorldmap)) byCoord.set(k, p);
    }
    const maps = [...byCoord.values()]
      .sort((a, b) => a.id - b.id)
      .map((p) => [p.id, p.posX, p.posY, p.subAreaId, p.outdoor ? 1 : 0]);
    return { v: this.version, builtAt: new Date().toISOString(), areas: areaMap, subareas: subs, maps };
  },
};

export const mapImg = (mapId, scale = '1') => `https://api.dofusdb.fr/img/maps/${scale}/${mapId}.jpg`;

/** Index pratiques : maps par sous-zone, map par coordonnées. */
export function indexMaps(data) {
  const bySub = new Map();
  const byCoord = new Map();
  for (const m of data.maps) {
    const [id, x, y, sub] = m;
    if (!bySub.has(sub)) bySub.set(sub, []);
    bySub.get(sub).push(m);
    const k = `${x},${y}`;
    if (!byCoord.has(k)) byCoord.set(k, { id, x, y, sub });
  }
  return { bySub, byCoord };
}

/** Map du jour : sous-zone puis map extérieure, tirées de façon déterministe. */
export function pickMap(data, index, salt, key) {
  const pool = data.subareas.filter((s) => s.w && index.bySub.get(s.id)?.some((m) => m[4]));
  const sub = rankDaily(pool, `${salt}-zone`, key)[0];
  const candidates = index.bySub.get(sub.id).filter((m) => m[4]).map((m) => ({ id: m[0], m }));
  const { m } = rankDaily(candidates, `${salt}-map`, key)[0];
  return { id: m[0], posX: m[1], posY: m[2], sub, img: { '1': mapImg(m[0], '1'), '0.5': mapImg(m[0], '0.5') } };
}

/** Distance en nombre de maps (Manhattan). */
export const mapDistance = (a, b) => Math.abs(a.posX - b.posX) + Math.abs(a.posY - b.posY);

/** "[-3, 12]", "-3,12", "-3 12" -> {posX, posY} */
export function parseCoords(input) {
  const m = String(input).match(/^\s*\[?\s*(-?\d{1,3})\s*[,;\s]\s*(-?\d{1,3})\s*\]?\s*$/);
  return m ? { posX: Number(m[1]), posY: Number(m[2]) } : null;
}
