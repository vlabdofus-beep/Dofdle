// Jeu de données "Monstres" — construit depuis l'API DofusDB.
// Format compact, sérialisable en JSON (snapshot statique ou IndexedDB).
import { tr } from '../core/text.js';
import { stepper } from '../core/cache.js';
import { ELEMENT_ORDER } from './elements.js';
import { COLORS, compareColors } from './colors.js';

export const ARCHI_SUPER_RACE = 20;
// Super-familles exclues : créatures de quête, invocations, créatures des Expéditions
export const EXCLUDED_SUPER_RACES = new Set([27, 28, 45]);
// Monstres retirés du jeu à partir du 25/10/2026 (marqués `x` dans les données, gardés pour les
// défis passés) : créatures d'alignement (Bonta et Brâkmar) et monstres hors bestiaire
// (aucun succès de chasse : monstres de quête, d'événement, de didacticiel…).
export const ALIGNMENT_SUPER_RACE = 13;
// Gardés malgré tout : Fantômes de Brâkmar, Rats Brâkmariens et Bontariens, Volkornes sauvages, créatures d'Incarnam
const KEPT_RACES = new Set([53, 240, 241, 183]);
const KEPT_SUPER_RACES = new Set([18]);
/** Famille gardée en jeu même si elle répond aux critères de retrait. */
export const isKeptRace = (raceId, race) => KEPT_RACES.has(Number(raceId)) || KEPT_SUPER_RACES.has(race?.sr);
export const SPECIAL_EXCLUDED_FROM = '2026-10-25';
const NORMAL_GRADES = 5;
const RES_KEYS = { neutre: 'reductionNeutral', terre: 'reductionEarth', feu: 'reductionFire', eau: 'reductionWater', air: 'reductionAir' };

export const monstersDataset = {
  key: 'monsters',
  version: 8,
  minVersion: 7, // v8 ajoute seulement le marqueur x (monstres retirés)
  async build(api, onProgress = () => {}) {
    const step = stepper(onProgress, [['Monstres', 6], ['Familles', 1], ['Zones', 2]]);

    const raw = await api.getAll('monsters', {
      'hideInBestiary[$ne]': true,
      'isQuestMonster[$ne]': true,
      'subareas[$gt]': 0, // au moins une sous-zone
      '$select': ['id', 'name', 'gfxId', 'look', 'race', 'isBoss', 'isMiniBoss', 'favoriteSubareaId', 'subareas', 'achievements',
        'grades.grade', 'grades.level', 'grades.lifePoints', ...Object.values(RES_KEYS).map((k) => `grades.${k}`)],
    }, { onProgress: step.Monstres });

    const [races, superRaces] = await Promise.all([
      api.getAll('monster-races', { '$select': ['id', 'name', 'superRaceId'] }),
      api.getAll('monster-super-races', { '$select': ['id', 'name'] }),
    ]);
    step.Familles(1, 1);

    const [subareas, areas] = await Promise.all([
      api.getAll('subareas', { '$select': ['id', 'name', 'areaId'] }, { onProgress: step.Zones }),
      api.getAll('areas', { '$select': ['id', 'name'] }),
    ]);

    const subareaMap = Object.fromEntries(subareas.map((s) => [s.id, { n: tr(s.name), a: s.areaId }]));
    const data = {
      v: this.version,
      builtAt: new Date().toISOString(),
      superRaces: Object.fromEntries(superRaces.map((s) => [s.id, tr(s.name)])),
      races: Object.fromEntries(races.map((r) => [r.id, { n: tr(r.name), sr: r.superRaceId }])),
      areas: Object.fromEntries(areas.map((a) => [a.id, tr(a.name)])),
      subareas: subareaMap,
      monsters: [],
    };

    for (const m of raw) {
      const name = tr(m.name);
      const race = data.races[m.race];
      if (!name || !m.grades?.length || EXCLUDED_SUPER_RACES.has(race?.sr)) continue;
      // Grades 6+ = paliers d'expédition (ex. 75 / 130 / 200) : on garde les 5 grades normaux
      const grades = [...m.grades].sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0)).slice(0, NORMAL_GRADES);
      const levels = grades.map((g) => g.level);
      const hp = grades.map((g) => g.lifePoints || 0);
      const top = grades[grades.length - 1];
      const res = ELEMENT_ORDER.map((el) => top[RES_KEYS[el]] ?? 0);
      const subs = (m.subareas || []).filter((s) => subareaMap[s]);
      if (!subs.length || !isPlayableMonster({ n: name, l: [Math.min(...levels), Math.max(...levels)] })) continue;
      const main = subareaMap[m.favoriteSubareaId] ? m.favoriteSubareaId : subs[0];
      const bones = Number((m.look || '').match(/^\{(\d+)/)?.[1]) || 0;
      data.monsters.push({
        id: m.id,
        n: name,
        g: m.gfxId,
        b: bones,
        r: m.race,
        l: [Math.min(...levels), Math.max(...levels)],
        hp: [Math.min(...hp), Math.max(...hp)],
        k: m.isBoss ? 'boss' : race?.sr === ARCHI_SUPER_RACE ? 'archi' : m.isMiniBoss ? 'miniboss' : 'normal',
        z: main,
        zs: subs,
        res,
        ...(isSpecialMonster(race, m.achievements, m.race) ? { x: 1 } : {}),
      });
    }
    data.monsters.sort((a, b) => a.id - b.id);
    return data;
  },
};

// ---------- Logique de jeu (indépendante de l'UI) ----------

// Monstres exclus du jeu : monstres de test et niveaux aberrants (raids à niveau variable, au-delà de 300)
export const MAX_MONSTER_LEVEL = 300;
export const isPlayableMonster = (m) => !/^test/i.test(m.n) && m.l[1] <= MAX_MONSTER_LEVEL;

/** Créature d'alignement, ou monstre (hors archimonstre) qui ne compte dans aucun succès de chasse. */
function isSpecialMonster(race, achievements, raceId) {
  if (isKeptRace(raceId, race)) return false;
  if (race?.sr === ALIGNMENT_SUPER_RACE) return true;
  return race?.sr !== ARCHI_SUPER_RACE && !(achievements || []).length;
}

export const KIND_LABEL = { boss: 'Boss', miniboss: 'Mini-boss', archi: 'Archimonstre', normal: 'Normal' };

export const monsterImg = (m) => `https://api.dofusdb.fr/img/monsters/${m.g}.png`;

/** Élément(s) de faiblesse : plus basse résistance au grade max. Vide si toutes égales. */
export function weaknesses(m) {
  const min = Math.min(...m.res);
  const max = Math.max(...m.res);
  if (min === max) return [];
  return ELEMENT_ORDER.filter((_, i) => m.res[i] === min);
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const fmtRange = ([a, b], fmt = (x) => x) => (a === b ? fmt(a) : `${fmt(a)}–${fmt(b)}`);
const fmtHp = (n) => n.toLocaleString('fr-FR');

/** Plage numérique : vert identique, orange si chevauchement, flèche vers la cible. */
function rangeCell(key, g, t, value) {
  let status = 'ko';
  if (g[0] === t[0] && g[1] === t[1]) status = 'ok';
  else if (g[0] <= t[1] && t[0] <= g[1]) status = 'partial';
  const gm = (g[0] + g[1]) / 2, tm = (t[0] + t[1]) / 2;
  const arrow = status === 'ok' ? undefined : tm > gm ? 'up' : 'down';
  // Écart important : la cible vaut plus du double (ou moins de la moitié) de la proposition
  const far = status === 'ko' && Math.max(gm, tm) > 2 * Math.max(1, Math.min(gm, tm));
  return { key, status, arrow, far, value };
}

/**
 * Compare une proposition à la cible. Retourne une liste de cellules :
 * { key, status: 'ok'|'partial'|'ko', arrow?: 'up'|'down', value }
 */
export function compareMonsters(guess, target, data, keys) {
  const cells = [];
  const want = (k) => !keys || keys.includes(k);

  // Famille : vert ou rouge (la proximité géographique est donnée par la zone)
  if (want('race')) cells.push({ key: 'race', status: guess.r === target.r ? 'ok' : 'ko', value: data.races[guess.r]?.n || '?' });

  if (want('level')) cells.push(rangeCell('level', guess.l, target.l, fmtRange(guess.l)));

  if (want('hp')) cells.push(rangeCell('hp', guess.hp || [0, 0], target.hp || [0, 0], fmtRange(guess.hp || [0, 0], fmtHp)));

  // Zone principale : vert même sous-zone, orange si la cible y vit aussi ou même région
  if (want('zone')) {
    const gz = data.subareas[guess.z], tz = data.subareas[target.z];
    let zone = 'ko';
    if (guess.z === target.z) zone = 'ok';
    else if (target.zs.includes(guess.z) || guess.zs.includes(target.z) || (gz && tz && gz.a === tz.a)) zone = 'partial';
    cells.push({ key: 'zone', status: zone, value: gz?.n || '?', sub: data.areas[gz?.a] || '' });
  }

  if (want('kind')) cells.push({ key: 'kind', status: guess.k === target.k ? 'ok' : 'ko', value: KIND_LABEL[guess.k] });

  if (want('weak')) {
    const gw = weaknesses(guess), tw = weaknesses(target);
    cells.push({ key: 'weak', status: sameSet(gw, tw) ? 'ok' : gw.some((e) => tw.includes(e)) ? 'partial' : 'ko', value: gw });
  }

  // Couleur dominante de l'image (calculée au snapshot ou à la volée, cf. colors.js)
  if (want('color')) {
    const gc = guess.c || [], tc = target.c || [];
    cells.push({
      key: 'color',
      status: compareColors(gc, tc),
      value: gc.length ? COLORS[gc[0]].label : '?',
      sub: gc[1] ? `+ ${COLORS[gc[1]].label.toLowerCase()}` : '',
      swatches: gc.map((c) => COLORS[c].hex),
    });
  }
  return cells;
}

/** Un seul monstre par nom (certaines variantes partagent leur nom). */
export function monsterEntries(data, normalize) {
  const seen = new Set();
  const entries = [];
  for (const m of data.monsters) {
    if (!isPlayableMonster(m)) continue;
    const key = normalize(m.n);
    if (seen.has(key)) continue;
    seen.add(key);
    const race = data.races[m.r]?.n || '';
    // hidden : retiré des suggestions et des tirages (voir SPECIAL_EXCLUDED_FROM)
    const raceInfo = data.races[m.r];
    const hidden = (!!m.x || raceInfo?.sr === ALIGNMENT_SUPER_RACE) && !isKeptRace(m.r, raceInfo);
    entries.push({ id: m.id, n: m.n, img: monsterImg(m), sub: `${race} · niv. ${fmtRange(m.l)}`, ref: m, hidden });
  }
  return entries;
}
