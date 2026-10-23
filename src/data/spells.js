// Jeu de données "Sorts de classe" — DofusDB /breeds, /spell-variants, /spells, /spell-levels
import { tr, cleanGameText } from '../core/text.js';
import { stepper } from '../core/cache.js';
import { DAMAGE_EFFECTS, HEAL_EFFECTS, sortElements } from './elements.js';

export const spellsDataset = {
  key: 'spells',
  version: 2,
  async build(api, onProgress = () => {}) {
    const step = stepper(onProgress, [['Classes', 1], ['Sorts', 3], ['Niveaux', 3]]);
    const breeds = await api.getAll('breeds', { '$select': ['id', 'shortName'] });
    const variants = await api.getAll('spell-variants', { '$select': ['id', 'breedId', 'spellIds'] }, { onProgress: step.Classes });
    const spellToBreed = new Map();
    for (const v of variants) for (const s of v.spellIds || []) spellToBreed.set(s, v.breedId);

    const spells = await api.getByIds('spells', [...spellToBreed.keys()],
      { '$select': ['id', 'name', 'description', 'iconId', 'spellLevels'] }, { onProgress: step.Sorts });
    const levelIds = spells.map((s) => s.spellLevels?.[s.spellLevels.length - 1]).filter(Boolean);
    const levels = await api.getByIds('spell-levels', levelIds,
      { '$select': ['id', 'spellId', 'apCost', 'minRange', 'range', 'rangeCanBeBoosted', 'effects.effectId', 'effects.effectElement'] },
      { onProgress: step.Niveaux });
    const levelBySpell = new Map(levels.map((l) => [l.spellId, l]));

    const breedNames = Object.fromEntries(breeds.map((b) => [b.id, tr(b.shortName)]));
    const out = [];
    for (const s of spells) {
      const name = tr(s.name);
      const lvl = levelBySpell.get(s.id);
      const breed = spellToBreed.get(s.id);
      if (!name || !lvl || !breedNames[breed]) continue;
      const els = new Set();
      let heal = false;
      for (const e of lvl.effects || []) {
        if (DAMAGE_EFFECTS[e.effectId]) els.add(DAMAGE_EFFECTS[e.effectId]);
        if (HEAL_EFFECTS.has(e.effectId)) heal = true;
      }
      out.push({
        id: s.id,
        n: name,
        b: breed,
        i: s.iconId,
        pa: lvl.apCost,
        po: [lvl.minRange, lvl.range],
        pb: lvl.rangeCanBeBoosted ? 1 : 0,
        el: sortElements([...els]),
        soin: heal ? 1 : 0,
        de: cleanGameText(tr(s.description)).slice(0, 400),
      });
    }
    out.sort((a, b) => a.id - b.id);
    return { v: this.version, builtAt: new Date().toISOString(), breeds: breedNames, spells: out };
  },
};

export const spellImg = (s) => `https://api.dofusdb.fr/img/spells/sort_${s.i}.png`;
export const breedHead = (id) => `assets/game/classes/${id}.png`;

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const numCell = (key, g, t, value) => ({ key, status: g === t ? 'ok' : Math.abs(g - t) <= 1 ? 'partial' : 'ko', arrow: g === t ? undefined : t > g ? 'up' : 'down', value });

export function compareSpells(guess, target, data) {
  const gEl = guess.el.length ? guess.el : guess.soin ? ['soin'] : [];
  const tEl = target.el.length ? target.el : target.soin ? ['soin'] : [];
  return [
    { key: 'breed', status: guess.b === target.b ? 'ok' : 'ko', value: data.breeds[guess.b], icon: breedHead(guess.b) },
    { key: 'element', status: sameSet(gEl, tEl) ? 'ok' : gEl.some((e) => tEl.includes(e)) ? 'partial' : 'ko', value: gEl },
    numCell('pa', guess.pa, target.pa, `${guess.pa} PA`),
    numCell('po', guess.po[1], target.po[1], guess.po[0] === guess.po[1] ? `${guess.po[1]}` : `${guess.po[0]}–${guess.po[1]}`),
  ];
}
