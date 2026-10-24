// Jeu de données "Équipements" — DofusDB /items, /item-types, /item-sets, /effects
import { tr, formatEffect } from '../core/text.js';
import { stepper } from '../core/cache.js';
import { STAT_EFFECT_TO_ELEMENT, sortElements } from './elements.js';

// Types d'équipement retenus (amulettes, armes, anneaux, ceintures, bottes, chapeaux, capes, boucliers)
export const EQUIPMENT_TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 19, 22, 82, 114, 271];
export const WEAPON_TYPES = new Set([2, 3, 4, 5, 6, 7, 8, 19, 22, 114, 271]);

export const itemsDataset = {
  key: 'items',
  version: 2,
  async build(api, onProgress = () => {}) {
    const step = stepper(onProgress, [['Équipements', 8], ['Panoplies', 1], ['Effets', 1]]);
    const raw = await api.getAll('items', {
      'typeId[$in]': EQUIPMENT_TYPES,
      '$select': ['id', 'name', 'typeId', 'level', 'iconId', 'itemSetId', 'effects.effectId', 'effects.from', 'effects.to'],
    }, { onProgress: step['Équipements'] });

    const setIds = [...new Set(raw.map((i) => i.itemSetId).filter((x) => x > 0))];
    const [sets, types] = await Promise.all([
      api.getByIds('item-sets', setIds, { '$select': ['id', 'name'] }, { onProgress: step.Panoplies }),
      api.getByIds('item-types', EQUIPMENT_TYPES, { '$select': ['id', 'name'] }),
    ]);
    const effectIds = [...new Set(raw.flatMap((i) => (i.effects || []).map((e) => e.effectId)))];
    const effects = await api.getByIds('effects', effectIds, { '$select': ['id', 'description', 'bonusType'] }, { onProgress: step.Effets });

    const items = [];
    for (const i of raw) {
      const name = tr(i.name);
      if (!name || !(i.level > 0) || /^\[|\]$/.test(name)) continue; // objets de test
      const fx = (i.effects || []).map((e) => [e.effectId, e.from, e.to]);
      const stats = {};
      for (const [id, from, to] of fx) {
        const el = STAT_EFFECT_TO_ELEMENT[id];
        if (el) stats[el] = (stats[el] || 0) + Math.max(from, to);
      }
      const max = Math.max(0, ...Object.values(stats));
      const el = max > 0 ? sortElements(Object.keys(stats).filter((k) => stats[k] >= max * 0.75)) : [];
      items.push({ id: i.id, n: name, t: i.typeId, l: i.level, i: i.iconId, s: i.itemSetId > 0 ? i.itemSetId : 0, el, fx });
    }
    items.sort((a, b) => a.id - b.id);
    return {
      v: this.version,
      builtAt: new Date().toISOString(),
      types: Object.fromEntries(types.map((t) => [t.id, tr(t.name)])),
      sets: Object.fromEntries(sets.map((s) => [s.id, tr(s.name)])),
      effects: Object.fromEntries(effects.map((e) => [e.id, tr(e.description)])),
      items,
    };
  },
};

export const itemImg = (it) => `https://api.dofusdb.fr/img/items/${it.i}.png`;

export function itemEffectLines(it, data) {
  return it.fx
    .map(([id, from, to]) => formatEffect(data.effects[id], from, to))
    .filter((s) => s && !/^\s*$/.test(s));
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export function compareItems(guess, target, data) {
  const lvl = guess.l === target.l ? 'ok' : Math.abs(guess.l - target.l) <= 10 ? 'partial' : 'ko';
  const sameFamily = WEAPON_TYPES.has(guess.t) && WEAPON_TYPES.has(target.t);
  return [
    { key: 'type', status: guess.t === target.t ? 'ok' : sameFamily ? 'partial' : 'ko', value: data.types[guess.t] || '?' },
    { key: 'level', status: lvl, arrow: guess.l === target.l ? undefined : target.l > guess.l ? 'up' : 'down', far: Math.abs(target.l - guess.l) >= 50, value: `${guess.l}` },
    { key: 'element', status: sameSet(guess.el, target.el) ? 'ok' : guess.el.some((e) => target.el.includes(e)) ? 'partial' : 'ko', value: guess.el },
    { key: 'set', status: guess.s === target.s ? 'ok' : 'ko', value: guess.s ? data.sets[guess.s] || 'Panoplie' : 'Aucune' },
  ];
}
