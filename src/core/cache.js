// Chargement des jeux de données avec cache à trois niveaux :
//   1. snapshot statique  data/<clé>.json  (généré par scripts/build-data.mjs)
//   2. IndexedDB du navigateur (TTL 7 jours)
//   3. API DofusDB en direct (puis mise en cache)
// Les monstres/objets ne changent qu'aux mises à jour du jeu : inutile de
// solliciter l'API à chaque visite (et c'est plus respectueux de DofusDB).

import { createApi } from './api.js';

const DB_NAME = 'dofusle';
const STORE = 'datasets';
const TTL = 7 * 24 * 3600 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponible'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(undefined);
    });
  } catch { return undefined; }
}

async function idbSet(key, value) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve; tx.onerror = resolve;
    });
  } catch { /* cache best-effort */ }
}

export async function clearCache() {
  try {
    const db = await openDb();
    await new Promise((resolve) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).clear(); tx.oncomplete = resolve; tx.onerror = resolve; });
  } catch { /* rien */ }
}

const memory = new Map();

/**
 * @param {{key:string, version:number, build:(api, progress)=>Promise<any>}} dataset
 * @param {(ratio:number, label:string)=>void} onProgress
 */
export async function loadDataset(dataset, onProgress = () => {}) {
  const { key, version } = dataset;
  if (memory.has(key)) return memory.get(key);

  const p = (async () => {
    // 1. Snapshot statique
    try {
      const res = await fetch(`data/${key}.json`, { cache: 'no-cache' });
      if (res.ok) {
        const json = await res.json();
        if (json?.v === version) return json;
      }
    } catch { /* pas de snapshot */ }

    // 2. IndexedDB
    const cached = await idbGet(key);
    if (cached?.data?.v === version && Date.now() - cached.savedAt < TTL) return cached.data;

    // 3. API en direct
    const api = createApi();
    try {
      const data = await dataset.build(api, onProgress);
      await idbSet(key, { savedAt: Date.now(), data });
      return data;
    } catch (e) {
      // Hors-ligne / API en panne : on se rabat sur un cache périmé s'il existe
      if (cached?.data?.v === version) return cached.data;
      throw e;
    }
  })();
  memory.set(key, p);
  p.catch(() => memory.delete(key));
  return p;
}

/** Combine plusieurs barres de progression (étapes pondérées). */
export function stepper(onProgress, steps) {
  const total = steps.reduce((a, s) => a + s[1], 0);
  const api = {};
  steps.forEach(([name, w], i) => {
    const start = steps.slice(0, i).reduce((a, s) => a + s[1], 0);
    api[name] = (done, of) => onProgress((start + w * (of ? done / of : 1)) / total, name);
  });
  return api;
}
