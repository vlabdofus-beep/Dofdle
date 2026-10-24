#!/usr/bin/env node
// Génère les snapshots statiques data/*.json depuis l'API DofusDB.
// Usage : node scripts/build-data.mjs [monsters spells items maps]
// À relancer après chaque mise à jour de Dofus. Les joueurs chargent alors
// un simple fichier JSON (mis en cache par le CDN) au lieu d'interroger l'API.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createApi } from '../src/core/api.js';
import { monstersDataset } from '../src/data/monsters.js';
import { spellsDataset } from '../src/data/spells.js';
import { itemsDataset } from '../src/data/items.js';
import { mapsDataset } from '../src/data/maps.js';
import { classifyPixels } from '../src/data/colors.js';
import { decodePng } from './png.mjs';
import { buildQuestion, QUESTION_VERSION } from '../src/data/chiffres.js';
import { todayKey, addDays, dayNumber, hash } from '../src/core/daily.js';

const ALL = { monsters: monstersDataset, spells: spellsDataset, items: itemsDataset, maps: mapsDataset };
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : [...Object.keys(ALL), 'juste-prix'];

await mkdir(join(root, 'data'), { recursive: true });
const api = createApi({ concurrency: 4 }); // on reste raisonnable avec DofusDB

for (const key of wanted) {
  if (key === 'juste-prix') { await buildJustePrix(); continue; }
  const ds = ALL[key];
  if (!ds) { console.error(`Dataset inconnu : ${key}`); process.exitCode = 1; continue; }
  const t0 = Date.now();
  let last = -1;
  const data = await ds.build(api, (ratio, step) => {
    const pct = Math.floor(ratio * 100);
    if (pct !== last && pct % 10 === 0) { last = pct; process.stdout.write(`\r${key}: ${step} ${pct}%   `); }
  });
  if (key === 'monsters') await addMonsterColors(data);
  const file = join(root, 'data', `${ds.key}.json`);
  const json = JSON.stringify(data);
  await writeFile(file, json);
  console.log(`\r${key}: ${(json.length / 1024).toFixed(0)} Ko écrits dans data/${ds.key}.json (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

/** Couleur dominante de chaque monstre (une image par gfxId, 4 téléchargements en parallèle). */
async function addMonsterColors(data) {
  const byGfx = new Map();
  for (const m of data.monsters) byGfx.set(m.g, null);
  const gfx = [...byGfx.keys()];
  let done = 0, failed = 0;
  const worker = async () => {
    while (gfx.length) {
      const g = gfx.shift();
      try {
        const res = await fetch(`https://api.dofusdb.fr/img/monsters/${g}.png`);
        if (!res.ok) throw new Error(res.status);
        byGfx.set(g, classifyPixels(decodePng(Buffer.from(await res.arrayBuffer())).rgba));
      } catch { failed++; }
      if (++done % 50 === 0) process.stdout.write(`\rmonsters: couleurs ${done}/${byGfx.size}   `);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  for (const m of data.monsters) { const c = byGfx.get(m.g); if (c) m.c = c; }
  if (failed) console.log(`\n${failed} image(s) illisible(s) : leur couleur sera calculée dans le navigateur.`);
}

/**
 * Questions du Juste prix de la veille et des 16 prochains jours, calculées exactement
 * comme dans le navigateur. Le jeu lit ce fichier et n'interroge DofusDB qu'en secours.
 */
async function buildJustePrix() {
  const t0 = Date.now();
  const today = todayKey();
  const file = join(root, 'data', 'juste-prix.json');
  // Une question déjà publiée ne change plus (même si les données du jeu évoluent entre-temps)
  let previous = {};
  try {
    const old = JSON.parse(await readFile(file, 'utf8'));
    if (old.v === QUESTION_VERSION) previous = old.questions || {};
  } catch { /* premier passage */ }
  const questions = {};
  let failed = 0;
  for (let i = -1; i <= 16; i++) {
    const date = addDays(today, i);
    if (previous[date]) { questions[date] = previous[date]; continue; }
    try {
      questions[date] = await buildQuestion(api, { day: dayNumber(date), seed: hash(`chiffre|${date}`), hashFn: hash });
      process.stdout.write(`\rjuste-prix: ${Object.keys(questions).length} questions   `);
    } catch (e) { failed++; console.log(`\njuste-prix: ${date} impossible (${e.message || e})`); }
  }
  const json = JSON.stringify({ v: QUESTION_VERSION, generated: today, questions });
  await writeFile(file, json);
  console.log(`\rjuste-prix: ${Object.keys(questions).length} questions écrites dans data/juste-prix.json (${failed} échec(s), ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
