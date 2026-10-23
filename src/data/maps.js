// Jeu de données "Cartes" — DofusDB /subareas, /areas, /map-positions
// Le dataset ne contient que les sous-zones et leurs ids de maps (léger).
// Les coordonnées sont récupérées à la demande (map du jour, zones proposées).
import { tr } from '../core/text.js';
import { stepper } from '../core/cache.js';
import { rankDaily } from '../core/daily.js';

export const WORLD_SUPER_AREA = 0; // Monde des Douze
export const WORLD_MAP = 1;

export const mapsDataset = {
  key: 'maps',
  version: 1,
  async build(api, onProgress = () => {}) {
    const step = stepper(onProgress, [['Zones', 1], ['Sous-zones', 4]]);
    const areas = await api.getAll('areas', { '$select': ['id', 'name', 'superAreaId'] }, { onProgress: step.Zones });
    const subareas = await api.getAll('subareas', { '$select': ['id', 'name', 'areaId', 'mapIds', 'displayOnWorldMap', 'level'] }, { onProgress: step['Sous-zones'] });
    const areaMap = Object.fromEntries(areas.map((a) => [a.id, { n: tr(a.name), sa: a.superAreaId }]));
    const subs = subareas
      .filter((s) => tr(s.name) && s.mapIds?.length && areaMap[s.areaId]?.sa === WORLD_SUPER_AREA)
      .map((s) => ({ id: s.id, n: tr(s.name), a: s.areaId, w: s.displayOnWorldMap ? 1 : 0, lv: s.level || 0, m: s.mapIds }));
    return { v: this.version, builtAt: new Date().toISOString(), areas: areaMap, subareas: subs };
  },
};

/** Cache mémoire des positions de maps. */
const positions = new Map();

export async function fetchPositions(api, mapIds) {
  const missing = mapIds.filter((id) => !positions.has(id));
  if (missing.length) {
    const res = await api.getByIds('map-positions', missing, { '$select': ['id', 'posX', 'posY', 'subAreaId', 'worldMap', 'outdoor', 'hasPriorityOnWorldmap', 'img'] });
    for (const id of missing) positions.set(id, null);
    for (const p of res) positions.set(p.id, p);
  }
  return mapIds.map((id) => positions.get(id)).filter(Boolean);
}

/**
 * Tire la map du jour : sous-zone puis map, en vérifiant qu'elle est en
 * extérieur sur la carte du monde et qu'elle a une image.
 */
export async function pickMap(api, data, salt, key) {
  const pool = data.subareas.filter((s) => s.w);
  const subs = rankDaily(pool, `${salt}-zone`, key);
  for (const sub of subs.slice(0, 12)) {
    const ranked = rankDaily(sub.m.map((id) => ({ id })), `${salt}-map`, key).slice(0, 25).map((o) => o.id);
    const pos = await fetchPositions(api, ranked);
    const byId = new Map(pos.map((p) => [p.id, p]));
    for (const id of ranked) {
      const p = byId.get(id);
      if (isWorldMap(p) && p.outdoor && p.img) return { ...p, sub };
    }
  }
  throw new Error('Aucune map valide trouvée');
}

/** Map "réelle" de la carte du monde (exclut les doublons/instances placés en [0,0]). */
export const isWorldMap = (p) => !!p && p.worldMap === WORLD_MAP && p.hasPriorityOnWorldmap === true;

/** Distance en nombre de maps (Manhattan). */
export const mapDistance = (a, b) => Math.abs(a.posX - b.posX) + Math.abs(a.posY - b.posY);

/** Direction (flèche) de la proposition vers la cible. Y croît vers le sud. */
export function direction(from, to) {
  const dx = Math.sign(to.posX - from.posX), dy = Math.sign(to.posY - from.posY);
  const arrows = { '0,-1': '↑', '1,-1': '↗', '1,0': '→', '1,1': '↘', '0,1': '↓', '-1,1': '↙', '-1,0': '←', '-1,-1': '↖', '0,0': '•' };
  return arrows[`${dx},${dy}`];
}

/** "[-3, 12]", "-3,12", "-3 12" -> {posX, posY} */
export function parseCoords(input) {
  const m = String(input).match(/^\s*\[?\s*(-?\d{1,3})\s*[,;\s]\s*(-?\d{1,3})\s*\]?\s*$/);
  return m ? { posX: Number(m[1]), posY: Number(m[2]) } : null;
}
