// Seed quotidien : même cible pour tout le monde, basée sur la date à Paris.

export const LAUNCH_DATE = '2026-10-23'; // Dofusle #1

/** Date du jour (YYYY-MM-DD) dans le fuseau Europe/Paris. */
export function todayKey(d = new Date()) {
  // en-CA formate en YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Numéro du daily (#1 = jour de lancement). */
export function dayNumber(key = todayKey()) {
  const toUtc = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((toUtc(key) - toUtc(LAUNCH_DATE)) / 86400000) + 1;
}

/** Millisecondes jusqu'au prochain minuit à Paris. */
export function msUntilNextDaily(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const elapsed = (get('hour') * 3600 + get('minute') * 60 + get('second')) * 1000 + now.getMilliseconds();
  return 86400000 - elapsed;
}

/** Hash 32 bits (cyrb53 tronqué) — déterministe, rapide. */
export function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Choisit l'élément du jour en minimisant hash(salt|date|id).
 * Avantage : ajouter de nouvelles données (ex. Bellaphones) ne change le tirage
 * d'un jour que si le nouvel élément "gagne" ce jour-là — pas de décalage global.
 */
export function pickDaily(list, salt, key = todayKey(), getId = (x) => x.id) {
  return rankDaily(list, salt, key, getId)[0];
}

/** Liste triée par priorité de tirage (utile si le 1er candidat est invalide). */
export function rankDaily(list, salt, key = todayKey(), getId = (x) => x.id) {
  return list
    .map((x) => ({ x, h: hash(`${salt}|${key}|${getId(x)}`) }))
    .sort((a, b) => a.h - b.h)
    .map((o) => o.x);
}

/** PRNG déterministe (mulberry32). */
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed)) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
