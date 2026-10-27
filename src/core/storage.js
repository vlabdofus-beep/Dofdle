// Persistance locale (sans compte) : parties du jour, statistiques, séries.
import { addDays } from './daily.js';
import { readSigned, writeSigned } from './seal.js';

const NS = 'dofusle:v1:';
// Historique et statistiques servent à calculer les coffres : ils sont signés (garde-fou)
const SIGNED = (key) => key === 'history' || key.startsWith('stats:');

function read(key, fallback) {
  if (SIGNED(key)) {
    const { raw, state } = readSigned(NS + key);
    if (raw == null || state === 'tampered') return fallback; // modifié à la main : ignoré
    try {
      const v = JSON.parse(raw);
      if (state === 'legacy') writeSigned(NS + key, raw); // sauvegarde d'avant le garde-fou : on la signe
      return v;
    } catch { return fallback; }
  }
  try { const v = localStorage.getItem(NS + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function write(key, value) {
  if (SIGNED(key)) { writeSigned(NS + key, JSON.stringify(value)); return; }
  try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
}

/** Partie du jour d'un mode : { date, guesses: [], won: bool, hints: [] } */
export function loadGame(mode, date) {
  const g = read(`game:${mode}`, null);
  // Données modifiables par l'utilisateur : on vérifie leur forme avant de s'en servir
  if (!g || g.date !== date || !Array.isArray(g.guesses)) return { date, guesses: [], won: false, hints: [] };
  return { ...g, won: g.won === true, hints: Array.isArray(g.hints) ? g.hints : [] };
}
export function saveGame(mode, game) {
  write(`game:${mode}`, game);
  // Prévient la navigation (rangée de Dofus) qu'un défi a pu être réussi
  if (game.won && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dofusle:progress', { detail: { mode } }));
}

const emptyStats = () => ({ played: 0, wins: 0, streak: 0, best: 0, lastWin: null, lastPlayed: null, dist: {} });

export function loadStats(mode) {
  const s = { ...emptyStats(), ...read(`stats:${mode}`, {}) };
  return s;
}

/** Série affichée : remise à 0 si le dernier daily gagné date d'avant-hier ou plus. */
export function currentStreak(stats, today) {
  if (!stats.lastWin) return 0;
  return stats.lastWin === today || stats.lastWin === addDays(today, -1) ? stats.streak : 0;
}

/** Historique des défis réussis : { 'AAAA-MM-JJ': { monstre: 4, sort: 2, … } } (nombre d'essais). */
export function loadHistory() { return read('history', {}); }
function addHistory(mode, date, tries) {
  const hist = loadHistory();
  hist[date] = { ...(hist[date] || {}), [mode]: tries };
  write('history', hist);
}

/**
 * Complète l'historique avec les parties gagnées encore en mémoire (le jour même ou la veille),
 * pour les joueurs qui ont joué avant l'apparition de l'historique.
 */
export function backfillHistory(modeIds) {
  const hist = loadHistory();
  let changed = false;
  for (const id of modeIds) {
    const g = read(`game:${id}`, null);
    if (g?.won && g.date && !hist[g.date]?.[id]) {
      hist[g.date] = { ...(hist[g.date] || {}), [id]: g.guesses.length };
      changed = true;
    }
  }
  if (changed) write('history', hist);
}

/** Série de journées complètes (tous les Dofus du jour récoltés), et la meilleure. */
export function fullDayStreaks(today, total) {
  const hist = loadHistory();
  const full = (d) => Object.keys(hist[d] || {}).length >= total;
  let current = 0;
  for (let d = full(today) ? today : addDays(today, -1); full(d); d = addDays(d, -1)) current++;
  let best = 0, run = 0, prev = null;
  for (const d of Object.keys(hist).filter(full).sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current) };
}

/** Enregistre la victoire d'un daily (une seule fois par jour). */
export function recordWin(mode, date, tries) {
  addHistory(mode, date, tries);
  const s = loadStats(mode);
  if (s.lastPlayed === date) return s; // déjà compté
  s.played++;
  s.wins++;
  s.streak = s.lastWin === addDays(date, -1) ? s.streak + 1 : 1;
  s.best = Math.max(s.best, s.streak);
  s.lastWin = date;
  s.lastPlayed = date;
  const bucket = tries >= 10 ? '10+' : String(tries);
  s.dist[bucket] = (s.dist[bucket] || 0) + 1;
  write(`stats:${mode}`, s);
  return s;
}


export function getPref(key, fallback) { return read(`pref:${key}`, fallback); }
export function setPref(key, value) { write(`pref:${key}`, value); }
