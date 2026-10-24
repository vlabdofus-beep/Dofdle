// Mode Chiffre : questions chiffrées générées à partir de l'API DofusDB.
// Chaque modèle tire un paramètre au hasard (graine du jour) puis calcule la
// réponse avec 1 à 3 requêtes ($limit=0 renvoie directement le total).
// Pas de gros téléchargement : la question du jour est mise en cache localement.

const fr = (o) => (o && (o.fr || o.en)) || '';
const q = (s) => `« ${s} »`;
const fmt = (n) => Number(n).toLocaleString('fr-FR');

// Monstres "réels" : visibles au bestiaire, hors quête, avec au moins une sous-zone
const MONSTER_FILTER = { 'hideInBestiary[$ne]': true, 'isQuestMonster[$ne]': true, 'subareas[$gt]': 0 };
// Super-familles exclues : créatures de quête, invocations, expéditions
const EXCLUDED_SUPER_RACES = [27, 28, 45];
const ARCHI_SUPER_RACE = 20;
const WORLD = 0; // super-zone "Monde des Douze"
// Maps de la carte du monde, hors doublons/instances placés en [0,0]
const WORLD_MAPS = { worldMap: 1, '$or[0][hasPriorityOnWorldmap]': true, '$or[1][posX][$ne]': 0, '$or[2][posY][$ne]': 0 };
const REAL_JOBS = { 'id[$ne]': 1 }; // le métier "Base" n'en est pas un
const isExpedition = (name) => /^Exp[ée]dition/i.test(name);
// Les réponses trop petites se devinent trop vite : on ne garde que celles d'au moins 40
export const MIN_ANSWER = 40;
const EQUIPMENT_TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 19, 22, 82, 114, 271];

export const THEMES = {
  geo: { label: 'Géographie', emoji: '🗺️' },
  bestiaire: { label: 'Bestiaire', emoji: '🐗' },
  objets: { label: 'Objets', emoji: '🎒' },
  craft: { label: 'Artisanat', emoji: '🔨' },
  quetes: { label: 'Quêtes', emoji: '📜' },
  succes: { label: 'Succès', emoji: '🏆' },
  donjons: { label: 'Donjons', emoji: '🗝️' },
  encyclo: { label: 'Encyclopédie', emoji: '📚' },
};

// ---------- Helpers API ----------
const count = async (api, path, params = {}) => (await api.get(path, { ...params, '$limit': 0 })).total;

/** Un document tiré au hasard parmi ceux qui correspondent au filtre (2 requêtes). */
async function pickOne(api, path, params, r, select) {
  const total = await count(api, path, params);
  if (!total) return null;
  const skip = Math.floor(r() * total);
  const res = await api.get(path, { ...params, '$limit': 1, '$skip': skip, '$sort[id]': 1, ...(select ? { '$select': select } : {}) });
  return res.data[0] || null;
}

async function listAll(api, path, params = {}) {
  const out = [];
  for (let skip = 0; ; skip += 50) {
    const res = await api.get(path, { ...params, '$limit': 50, '$skip': skip, '$sort[id]': 1 });
    out.push(...res.data);
    if (res.data.length < 50 || out.length >= res.total) return out;
  }
}

let excludedRaces = null;
async function getExcludedRaces(api) {
  excludedRaces ||= listAll(api, 'monster-races', { 'superRaceId[$in]': EXCLUDED_SUPER_RACES, '$select': ['id'] }).then((l) => l.map((x) => x.id));
  return excludedRaces;
}
const monsterFilter = async (api) => ({ ...MONSTER_FILTER, 'race[$nin]': await getExcludedRaces(api) });

// ---------- Modèles de questions ----------
// pick(api, r) -> { text, answer, note? } ou null si le tirage ne convient pas

export const TEMPLATES = [
  // --- Géographie
  {
    id: 'maps-region', theme: 'geo',
    async pick(api, r) {
      const area = await pickOne(api, 'areas', { superAreaId: WORLD }, r, ['id', 'name']);
      if (!fr(area?.name)) return null;
      const subs = await listAll(api, 'subareas', { areaId: area.id, '$select': ['id'] });
      if (!subs.length) return null;
      const answer = await count(api, 'map-positions', { ...WORLD_MAPS, 'subAreaId[$in]': subs.map((s) => s.id) });
      if (answer < MIN_ANSWER) return null;
      return { text: `Combien de maps compte la région ${q(fr(area.name))} ?`, answer, note: 'Maps de la carte du monde, toutes sous-zones de la région confondues (hors intérieurs et instances).' };
    },
  },
  {
    id: 'maps-sous-zone', theme: 'geo',
    async pick(api, r) {
      const sub = await pickOne(api, 'subareas', { displayOnWorldMap: true }, r, ['id', 'name', 'areaId']);
      if (!fr(sub?.name)) return null;
      const answer = await count(api, 'map-positions', { ...WORLD_MAPS, subAreaId: sub.id });
      if (answer < MIN_ANSWER) return null;
      return { text: `Combien de maps compte la sous-zone ${q(fr(sub.name))} ?`, answer, note: 'Maps de la carte du monde (hors intérieurs et instances).' };
    },
  },

  // --- Bestiaire
  {
    id: 'pv-boss', theme: 'bestiaire',
    async pick(api, r) {
      const boss = await pickOne(api, 'monsters', { ...(await monsterFilter(api)), isBoss: true }, r, ['id', 'name', 'grades.grade', 'grades.lifePoints', 'grades.level']);
      if (!fr(boss?.name) || !boss.grades?.length) return null;
      // Grade le plus haut hors paliers d'expédition (grades 6+)
      const g = [...boss.grades].sort((a, b) => a.grade - b.grade).slice(0, 5).pop();
      if (!(g.lifePoints > 0) || g.level > 300) return null;
      return { text: `Combien de points de vie a le boss ${q(fr(boss.name))} au niveau ${g.level} ?`, answer: g.lifePoints, note: `Grade ${g.grade} du monstre, sans bonus d'idoles ni de challenge.` };
    },
  },
  {
    id: 'drop-ressource', theme: 'bestiaire',
    async pick(api, r) {
      const it = await pickOne(api, 'items', { [`dropMonsterIds.${MIN_ANSWER - 1}[$exists]`]: true }, r, ['id', 'name', 'dropMonsterIds']);
      if (!fr(it?.name)) return null;
      return { text: `Combien de monstres différents peuvent lâcher l'objet ${q(fr(it.name))} ?`, answer: it.dropMonsterIds.length, note: 'Selon les tables de drop du jeu (archimonstres et variantes compris).' };
    },
  },
  {
    id: 'monstres-niveau', theme: 'bestiaire',
    async pick(api, r) {
      // Nombre de monstres de niveau >= N dans le bestiaire
      const level = [50, 100, 150, 180, 200][Math.floor(r() * 5)];
      const answer = await count(api, 'monsters', { ...(await monsterFilter(api)), 'grades.0.level[$gte]': level });
      if (answer < MIN_ANSWER) return null;
      return { text: `Combien de monstres du bestiaire sont au moins niveau ${level} dès leur premier grade ?`, answer, note: 'Monstres visibles dans le bestiaire, hors monstres de quête et d\'expédition.' };
    },
  },

  // --- Objets
  {
    id: 'objets-type', theme: 'objets',
    async pick(api, r) {
      const type = await pickOne(api, 'item-types', { 'categoryId[$in]': [0, 1, 2] }, r, ['id', 'name']);
      if (!fr(type?.name)) return null;
      const answer = await count(api, 'items', { typeId: type.id, 'level[$gt]': 0 });
      if (answer < MIN_ANSWER) return null;
      return { text: `Combien d'objets de la catégorie ${q(fr(type.name))} existe-t-il ?`, answer, note: 'Objets présents dans les données du jeu pour cette catégorie.' };
    },
  },
  {
    id: 'equipements-niveau', theme: 'objets',
    async pick(api, r) {
      const from = 1 + Math.floor(r() * 20) * 10; // tranches de 10 niveaux : 1-10 … 191-200
      const to = from + 9;
      const answer = await count(api, 'items', { 'level[$gte]': from, 'level[$lte]': to, 'typeId[$in]': EQUIPMENT_TYPES });
      return { text: `Combien d'équipements (armes comprises) ont un niveau compris entre ${from} et ${to} ?`, answer, note: 'Amulettes, anneaux, ceintures, bottes, coiffes, capes, boucliers, trophées et armes.' };
    },
  },
  {
    id: 'niveau-panoplie', theme: 'objets',
    async pick(api, r) {
      const set = await pickOne(api, 'item-sets', { isCosmetic: false, 'level[$gte]': MIN_ANSWER }, r, ['id', 'name', 'level', 'items']);
      if (!fr(set?.name) || (set.items || []).length < 2) return null;
      const name = fr(set.name);
      return { text: /^panoplie/i.test(name) ? `Quel est le niveau de la ${name} ?` : `Quel est le niveau de la panoplie ${q(name)} ?`, answer: set.level, note: `Niveau de la panoplie (celui de son objet le plus haut). Elle compte ${set.items.length} objets.` };
    },
  },
  {
    id: 'panoplies-niveau', theme: 'objets',
    async pick(api, r) {
      const from = 1 + Math.floor(r() * 10) * 20; // tranches de 20 niveaux
      const to = from + 19;
      const answer = await count(api, 'item-sets', { isCosmetic: false, 'level[$gte]': from, 'level[$lte]': to });
      if (answer < MIN_ANSWER) return null;
      return { text: `Combien de panoplies ont un niveau compris entre ${from} et ${to} ?`, answer, note: 'Panoplies d\'équipement, hors panoplies cosmétiques.' };
    },
  },

  // --- Artisanat
  {
    id: 'recettes-metier', theme: 'craft',
    async pick(api, r) {
      const job = await pickOne(api, 'jobs', REAL_JOBS, r, ['id', 'name']);
      if (!fr(job?.name)) return null;
      const answer = await count(api, 'recipes', { jobId: job.id });
      if (answer < MIN_ANSWER) return null;
      return { text: `Combien de recettes peut réaliser le métier ${q(fr(job.name))} ?`, answer };
    },
  },
  {
    id: 'recettes-ressource', theme: 'craft',
    async pick(api, r) {
      const it = await pickOne(api, 'items', { [`recipesThatUse.${MIN_ANSWER - 1}[$exists]`]: true }, r, ['id', 'name', 'recipesThatUse']);
      if (!fr(it?.name)) return null;
      return { text: `Dans combien de recettes l'objet ${q(fr(it.name))} est-il utilisé ?`, answer: it.recipesThatUse.length };
    },
  },
  {
    id: 'quantite-craft', theme: 'craft',
    async pick(api, r) {
      const rec = await pickOne(api, 'recipes', { 'resultLevel[$gte]': 120, 'resultTypeId[$in]': EQUIPMENT_TYPES }, r, ['id', 'resultName', 'resultLevel', 'quantities']);
      if (!fr(rec?.resultName)) return null;
      const answer = (rec.quantities || []).reduce((a, b) => a + b, 0);
      if (answer < MIN_ANSWER) return null;
      return { text: `Combien de ressources faut-il au total pour fabriquer l'objet ${q(fr(rec.resultName))} ?`, answer, note: `Somme des quantités de chaque ingrédient (${rec.quantities.length} ingrédients différents).` };
    },
  },
  {
    id: 'objets-niveau-metier', theme: 'craft',
    async pick(api, r) {
      const job = await pickOne(api, 'jobs', REAL_JOBS, r, ['id', 'name']);
      if (!fr(job?.name)) return null;
      const from = [1, 50, 100, 150][Math.floor(r() * 4)];
      const answer = await count(api, 'recipes', { jobId: job.id, 'resultLevel[$gte]': from, 'resultLevel[$lte]': from + 49 });
      if (answer < MIN_ANSWER) return null;
      return { text: `Combien de recettes du métier ${q(fr(job.name))} donnent un objet de niveau ${from} à ${from + 49} ?`, answer };
    },
  },

  // --- Quêtes
  {
    id: 'quetes-categorie', theme: 'quetes',
    async pick(api, r) {
      const cats = (await listAll(api, 'quest-categories', { '$select': ['id', 'name', 'questIds'] }))
        .filter((c) => fr(c.name) && (c.questIds || []).length >= MIN_ANSWER);
      if (!cats.length) return null;
      const cat = cats[Math.floor(r() * cats.length)];
      return { text: `Combien de quêtes compte la catégorie ${q(fr(cat.name))} ?`, answer: cat.questIds.length, note: 'Catégories du journal de quêtes.' };
    },
  },
  {
    id: 'quetes-niveau', theme: 'quetes',
    async pick(api, r) {
      const from = 1 + Math.floor(r() * 10) * 20;
      const answer = await count(api, 'quests', { 'levelMin[$gte]': from, 'levelMin[$lte]': from + 19 });
      if (answer < MIN_ANSWER) return null;
      return { text: `Combien de quêtes ont un niveau minimum compris entre ${from} et ${from + 19} ?`, answer };
    },
  },
  {
    id: 'quetes-groupe', theme: 'quetes',
    async pick(api, r) {
      const kinds = [
        { f: { isDungeonQuest: true }, t: 'Combien de quêtes se déroulent dans un donjon ?' },
        { f: { isPartyQuest: true }, t: 'Combien de quêtes sont considérées comme des quêtes de groupe ?' },
        { f: { isEvent: true }, t: 'Combien de quêtes sont liées à un événement ?' },
        { f: { 'repeatType[$gt]': 0 }, t: 'Combien de quêtes peut-on refaire (quotidiennes, répétables…) ?' },
      ];
      const k = kinds[Math.floor(r() * kinds.length)];
      const answer = await count(api, 'quests', k.f);
      if (answer < MIN_ANSWER) return null;
      return { text: k.t, answer };
    },
  },

  // --- Succès
  {
    id: 'succes-categorie', theme: 'succes',
    async pick(api, r) {
      const all = await listAll(api, 'achievement-categories', { '$select': ['id', 'name', 'parentId', 'achievementIds'] });
      const byId = new Map(all.map((c) => [c.id, c]));
      const cats = all.filter((c) => c.parentId > 0 && fr(c.name) && (c.achievementIds || []).length >= MIN_ANSWER
        && !/temporis/i.test(`${fr(c.name)} ${fr(byId.get(c.parentId)?.name)}`)); // serveurs éphémères exclus
      if (!cats.length) return null;
      const cat = cats[Math.floor(r() * cats.length)];
      const p = fr(byId.get(cat.parentId)?.name);
      return { text: `Combien de succès compte la catégorie ${q(fr(cat.name))}${p ? ` (${p})` : ''} ?`, answer: cat.achievementIds.length };
    },
  },
  {
    id: 'succes-points', theme: 'succes',
    async pick(api, r) {
      const pts = [5, 10, 15, 20, 30, 40][Math.floor(r() * 6)];
      const answer = await count(api, 'achievements', { points: pts });
      if (answer < MIN_ANSWER) return null;
      return { text: `Combien de succès rapportent exactement ${pts} points ?`, answer };
    },
  },
  {
    id: 'succes-niveau', theme: 'succes',
    async pick(api, r) {
      const from = 1 + Math.floor(r() * 10) * 20;
      const answer = await count(api, 'achievements', { 'level[$gte]': from, 'level[$lte]': from + 19 });
      if (answer < MIN_ANSWER) return null;
      return { text: `Combien de succès sont de niveau ${from} à ${from + 19} ?`, answer };
    },
  },

  // --- Donjons
  {
    id: 'donjons-seuil', theme: 'donjons',
    async pick(api, r) {
      const variants = [
        ...[60, 100, 140, 160, 180, 190, 200].map((x) => ({ f: { 'optimalPlayerLevel[$gte]': x }, t: `Combien de donjons ont un niveau conseillé d'au moins ${x} ?` })),
        ...[100, 110, 120].map((x) => ({ f: { 'optimalPlayerLevel[$gt]': 0, 'optimalPlayerLevel[$lte]': x }, t: `Combien de donjons ont un niveau conseillé de ${x} ou moins ?` })),
      ];
      const k = variants[Math.floor(r() * variants.length)];
      return { text: k.t, answer: await count(api, 'dungeons', k.f), note: 'Donjons répertoriés dans les données du jeu, expéditions comprises.' };
    },
  },

  // --- Encyclopédie (grands totaux)
  {
    id: 'totaux', theme: 'encyclo',
    async pick(api, r) {
      const all = [
        { t: 'Combien d\'émotes existe-t-il dans Dofus ?', f: () => count(api, 'emoticons') },
        { t: 'Combien d\'ornements existe-t-il ?', f: () => count(api, 'ornaments') },
        { t: 'Combien de titres un personnage peut-il obtenir ?', f: () => count(api, 'titles', { visible: true }) },
        { t: 'Combien d\'idoles existe-t-il ?', f: () => count(api, 'idols') },
        { t: 'Combien de montures différentes existe-t-il ?', f: () => count(api, 'mounts') },
        { t: 'Combien de succès existe-t-il au total ?', f: () => count(api, 'achievements') },
        { t: 'Combien de quêtes existe-t-il au total ?', f: () => count(api, 'quests') },
        { t: 'Combien de recettes d\'artisanat existe-t-il au total ?', f: () => count(api, 'recipes') },
        { t: 'Combien de panoplies (hors cosmétiques) existe-t-il ?', f: () => count(api, 'item-sets', { isCosmetic: false }) },
        { t: 'Combien de donjons existe-t-il ?', f: () => count(api, 'dungeons') },
        { t: 'Combien de boss compte le bestiaire ?', f: async () => count(api, 'monsters', { ...(await monsterFilter(api)), isBoss: true }) },
        { t: 'Combien d\'équipements de niveau 200 existe-t-il ?', f: () => count(api, 'items', { level: 200, 'typeId[$in]': EQUIPMENT_TYPES }) },
        { t: 'Combien de régions compte le Monde des Douze ?', f: () => count(api, 'areas', { superAreaId: WORLD }) },
        { t: 'Combien de challenges de combat existe-t-il ?', f: () => count(api, 'challenges') },
        { t: 'Combien de familles de monstres existe-t-il ?', f: () => count(api, 'monster-races', { 'superRaceId[$nin]': EXCLUDED_SUPER_RACES }) },
        { t: 'Combien de monstres compte le bestiaire ?', f: async () => count(api, 'monsters', await monsterFilter(api)) },
        { t: 'Combien de maps compte la carte du Monde des Douze ?', f: () => count(api, 'map-positions', WORLD_MAPS) },
        { t: 'Combien de PNJ sont recensés dans les données du jeu ?', f: () => count(api, 'npcs') },
      ];
      const k = all[Math.floor(r() * all.length)];
      const answer = await k.f();
      if (!(answer > 5)) return null;
      return { text: k.t, answer };
    },
  },
  {
    id: 'montures-famille', theme: 'encyclo',
    async pick(api, r) {
      const fam = await pickOne(api, 'mount-families', {}, r, ['id', 'name']);
      if (!fr(fam?.name)) return null;
      const answer = await count(api, 'mounts', { familyId: fam.id });
      if (answer < MIN_ANSWER) return null;
      return { text: `Combien de montures différentes compte la famille ${q(fr(fam.name))} ?`, answer, note: 'Toutes les couleurs et croisements de la famille.' };
    },
  },
];

const THEME_IDS = Object.keys(THEMES);
const byTheme = Object.fromEntries(THEME_IDS.map((t) => [t, TEMPLATES.filter((x) => x.theme === t)]));

/** Petit PRNG déterministe (mulberry32) */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ordre des thèmes : chaque cycle de N jours passe par tous les thèmes une fois,
 * dans un ordre mélangé, sans répéter un thème d'un jour sur l'autre.
 */
export function themeForDay(day, hashFn) {
  const n = THEME_IDS.length;
  const order = (cycle) => [...THEME_IDS].sort((a, b) => hashFn(`chiffre-theme|${cycle}|${a}`) - hashFn(`chiffre-theme|${cycle}|${b}`));
  const cycle = Math.floor(day / n);
  const cur = order(cycle);
  const prev = order(cycle - 1);
  // Évite un même thème sur deux jours de suite à la jonction de deux cycles
  if (cur[0] === prev[n - 1]) [cur[0], cur[1]] = [cur[1], cur[0]];
  return { theme: cur[((day % n) + n) % n], cycle };
}

/**
 * Construit la question d'un jour.
 * Les modèles d'un thème tournent de cycle en cycle : la même formulation ne
 * revient pas avant (nb de thèmes × nb de modèles du thème) jours.
 */
export async function buildQuestion(api, { day, seed, hashFn }) {
  const r = prng(seed);
  const { theme, cycle } = themeForDay(day, hashFn);
  const list = byTheme[theme];
  const start = (cycle + (hashFn(`chiffre-tpl|${theme}`) % list.length)) % list.length;
  const templates = list.map((_, i) => list[(start + i) % list.length]);
  for (const tpl of templates) {
    for (let attempt = 0; attempt < 8; attempt++) {
      let res = null;
      try { res = await tpl.pick(api, r); } catch (e) { if (attempt === 7) throw e; }
      if (res && Number.isFinite(res.answer) && res.answer >= MIN_ANSWER) return { ...res, theme, template: tpl.id };
    }
  }
  throw new Error('Impossible de générer une question');
}

export const formatNumber = fmt;
