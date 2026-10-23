// Persistance locale (sans compte) : parties du jour, statistiques, séries.
import { addDays } from './daily.js';

const NS = 'dofusle:v1:';

function read(key, fallback) {
  try { const v = localStorage.getItem(NS + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
}

/** Partie du jour d'un mode : { date, guesses: [], won: bool, hints: [] } */
export function loadGame(mode, date) {
  const g = read(`game:${mode}`, null);
  return g && g.date === date ? { hints: [], ...g } : { date, guesses: [], won: false, hints: [] };
}
export function saveGame(mode, game) { write(`game:${mode}`, game); }

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

/** Enregistre la victoire d'un daily (une seule fois par jour). */
export function recordWin(mode, date, tries) {
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

/** Compteur global de parties illimitées gagnées (pour le plaisir). */
export function recordEndlessWin(mode) {
  const n = read(`endless:${mode}`, 0) + 1;
  write(`endless:${mode}`, n);
  return n;
}
export const endlessWins = (mode) => read(`endless:${mode}`, 0);

export function getPref(key, fallback) { return read(`pref:${key}`, fallback); }
export function setPref(key, value) { write(`pref:${key}`, value); }
