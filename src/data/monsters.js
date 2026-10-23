// Jeu de données "Monstres" — construit depuis l'API DofusDB.
// Format compact, sérialisable en JSON (snapshot statique ou IndexedDB).
import { tr } from '../core/text.js';
import { stepper } from '../core/cache.js';
import { ELEMENT_ORDER } from './elements.js';
import { COLORS, compareColors } from './colors.js';

export const ARCHI_SUPER_RACE = 20;
const RES_KEYS = { neutre: 'reductionNeutral', terre: 'reductionEarth', feu: 'reductionFire', eau: 'reductionWater', air: 'reductionAir' };

export const monstersDataset = {
  key: 'monsters',
  version: 5,
  async build(api, onProgress = () => {}) {
    const step = stepper(onProgress, [['Monstres', 6], ['Races', 1], ['Zones', 2], ['Butins', 3]]);

    const raw = await api.getAll('monsters', {
      'hideInBestiary[$ne]': true,
      'isQuestMonster[$ne]': true,
      'subareas[$gt]': 0, // au moins une sous-zone
      '$select': ['id', 'name', 'gfxId', 'race', 'isBoss', 'isMiniBoss', 'favoriteSubareaId', 'subareas', 'correspondingMiniBossId',
        'grades.level', ...Object.values(RES_KEYS).map((k) => `grades.${k}`),
        'drops.objectId', 'drops.percentDropForGrade1', 'drops.hasCriterions'],
    }, { onProgress: step.Monstres });

    const [races, superRaces] = await Promise.all([
      api.getAll('monster-races', { '$select': ['id', 'name', 'superRaceId'] }),
      api.getAll('monster-super-races', { '$select': ['id', 'name'] }),
    ]);
    step.Races(1, 1);

    const [subareas, areas] = await Promise.all([
      api.getAll('subareas', { '$select': ['id', 'name', 'areaId', 'dungeonId'] }, { onProgress: step.Zones }),
      api.getAll('areas', { '$select': ['id', 'name', 'superAreaId'] }),
    ]);

    // "Drop notable" = butin sans condition le plus spécifique au monstre :
    // celui que le moins de monstres du pool lâchent, puis le plus fréquent.
    const dropCount = new Map();
    for (const m of raw) {
      for (const d of new Set((m.drops || []).filter((d) => !d.hasCriterions).map((d) => d.objectId))) {
        dropCount.set(d, (dropCount.get(d) || 0) + 1);
      }
    }
    const notable = new Map();
    for (const m of raw) {
      const drops = (m.drops || []).filter((d) => !d.hasCriterions && d.percentDropForGrade1 > 0);
      drops.sort((a, b) => (dropCount.get(a.objectId) - dropCount.get(b.objectId)) || (b.percentDropForGrade1 - a.percentDropForGrade1));
      if (drops[0]) notable.set(m.id, drops[0].objectId);
    }
    const itemsRaw = await api.getByIds('items', [...notable.values()], { '$select': ['id', 'name', 'typeId', 'iconId'] }, { onProgress: step.Butins });
    const typeIds = [...new Set(itemsRaw.map((i) => i.typeId))];
    const typesRaw = await api.getByIds('item-types', typeIds, { '$select': ['id', 'name'] });

    const subareaMap = Object.fromEntries(subareas.map((s) => [s.id, { n: tr(s.name), a: s.areaId, d: s.dungeonId > 0 ? 1 : 0 }]));
    const data = {
      v: this.version,
      builtAt: new Date().toISOString(),
      superRaces: Object.fromEntries(superRaces.map((s) => [s.id, tr(s.name)])),
      races: Object.fromEntries(races.map((r) => [r.id, { n: tr(r.name), sr: r.superRaceId }])),
      areas: Object.fromEntries(areas.map((a) => [a.id, tr(a.name)])),
      subareas: subareaMap,
      itemTypes: Object.fromEntries(typesRaw.map((t) => [t.id, tr(t.name)])),
      items: Object.fromEntries(itemsRaw.map((i) => [i.id, { n: tr(i.name), t: i.typeId, i: i.iconId }])),
      monsters: [],
    };

    for (const m of raw) {
      const name = tr(m.name);
      if (!name || !m.grades?.length) continue;
      const levels = m.grades.map((g) => g.level);
      const top = m.grades[m.grades.length - 1];
      const res = ELEMENT_ORDER.map((el) => top[RES_KEYS[el]] ?? 0);
      const subs = (m.subareas || []).filter((s) => subareaMap[s]);
      if (!subs.length) continue;
      const main = subareaMap[m.favoriteSubareaId] ? m.favoriteSubareaId : subs[0];
      const race = data.races[m.race];
      data.monsters.push({
        id: m.id,
        n: name,
        g: m.gfxId,
        r: m.race,
        l: [Math.min(...levels), Math.max(...levels)],
        k: m.isBoss ? 'boss' : race?.sr === ARCHI_SUPER_RACE ? 'archi' : m.isMiniBoss ? 'miniboss' : 'normal',
        z: main,
        zs: subs,
        res,
        d: notable.get(m.id) ?? null,
      });
    }
    data.monsters.sort((a, b) => a.id - b.id);
    return data;
  },
};

// ---------- Logique de jeu (indépendante de l'UI) ----------

export const KIND_LABEL = { boss: 'Boss', miniboss: 'Mini-boss', archi: 'Archimonstre', normal: 'Normal' };

export const monsterImg = (m) => `https://api.dofusdb.fr/img/monsters/${m.g}.png`;
export const itemImg = (iconId) => `https://api.dofusdb.fr/img/items/${iconId}.png`;

/** Élément(s) de faiblesse : plus basse résistance au grade max. Vide si toutes égales. */
export function weaknesses(m) {
  const min = Math.min(...m.res);
  const max = Math.max(...m.res);
  if (min === max) return [];
  return ELEMENT_ORDER.filter((_, i) => m.res[i] === min);
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Compare une proposition à la cible. Retourne une liste de cellules :
 * { key, status: 'ok'|'partial'|'ko', arrow?: 'up'|'down', value }
 */
export function compareMonsters(guess, target, data) {
  const cells = [];
  const gr = data.races[guess.r], tg = data.races[target.r];
  cells.push({
    key: 'race',
    status: guess.r === target.r ? 'ok' : gr && tg && gr.sr === tg.sr ? 'partial' : 'ko',
    value: gr?.n || '?',
  });

  // Niveau : vert si plage identique, orange si les plages se chevauchent
  const [gmin, gmax] = guess.l, [tmin, tmax] = target.l;
  let lvl = 'ko';
  if (gmin === tmin && gmax === tmax) lvl = 'ok';
  else if (gmin <= tmax && tmin <= gmax) lvl = 'partial';
  const arrow = lvl === 'ok' ? undefined : (tmin + tmax) / 2 > (gmin + gmax) / 2 ? 'up' : 'down';
  cells.push({ key: 'level', status: lvl, arrow, value: gmin === gmax ? `${gmin}` : `${gmin}–${gmax}` });

  // Zone principale : vert même sous-zone, orange si la cible y vit aussi ou même zone
  const gz = data.subareas[guess.z], tz = data.subareas[target.z];
  let zone = 'ko';
  if (guess.z === target.z) zone = 'ok';
  else if (target.zs.includes(guess.z) || guess.zs.includes(target.z) || (gz && tz && gz.a === tz.a)) zone = 'partial';
  cells.push({ key: 'zone', status: zone, value: gz?.n || '?', sub: data.areas[gz?.a] || '' });

  cells.push({ key: 'kind', status: guess.k === target.k ? 'ok' : 'ko', value: KIND_LABEL[guess.k] });

  const gw = weaknesses(guess), tw = weaknesses(target);
  cells.push({
    key: 'weak',
    status: sameSet(gw, tw) ? 'ok' : gw.some((e) => tw.includes(e)) ? 'partial' : 'ko',
    value: gw,
  });

  const gi = data.items[guess.d], ti = data.items[target.d];
  cells.push({
    key: 'drop',
    status: guess.d === target.d ? 'ok' : gi && ti && gi.t === ti.t ? 'partial' : 'ko',
    value: gi ? gi.n : 'Aucun',
    icon: gi ? itemImg(gi.i) : null,
    sub: gi ? data.itemTypes[gi.t] || '' : '',
  });

  // Couleur dominante de l'image (calculée au snapshot ou à la volée, cf. colors.js)
  const gc = guess.c || [], tc = target.c || [];
  cells.push({
    key: 'color',
    status: compareColors(gc, tc),
    value: gc.length ? COLORS[gc[0]].label : '?',
    sub: gc[1] ? `+ ${COLORS[gc[1]].label.toLowerCase()}` : '',
    swatches: gc.map((c) => COLORS[c].hex),
  });
  return cells;
}
