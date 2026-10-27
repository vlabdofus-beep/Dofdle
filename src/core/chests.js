// Coffres et collection du Bestiaire (stockage local, sans compte).
// Gains : 1 coffre par mode réussi, 3 pour la journée complète, et des paliers de série :
// tous les 5 jours d'affilée, autant de coffres que de jours (5, puis 10, puis 15…),
// pour la série de chaque mode comme pour celle des journées complètes.
import { loadStats, currentStreak, loadHistory, fullDayStreaks } from './storage.js';
import { RARITIES, rarity } from '../data/cards.js';
import { STEP } from '../ui/streak.js';

const KEY = 'dofusle:v1:bestiaire';
export const WELCOME_CAP = 20; // coffres offerts aux joueurs déjà là (victoires passées)

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  // Données modifiables à la main : on vérifie la forme avant de s'en servir
  if (!s || typeof s !== 'object') s = {};
  return {
    chests: Number.isFinite(s.chests) && s.chests >= 0 ? Math.floor(s.chests) : 0,
    shards: Number.isFinite(s.shards) && s.shards >= 0 ? Math.floor(s.shards) : 0,
    cards: s.cards && typeof s.cards === 'object' ? s.cards : {},
    granted: Array.isArray(s.granted) ? s.granted.slice(-600) : [],
    welcomed: s.welcomed === true,
    opened: Number.isFinite(s.opened) ? s.opened : 0,
  };
}
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* stockage plein ou bloqué */ }
  window.dispatchEvent(new CustomEvent('dofusle:chests', { detail: { chests: s.chests } }));
}

export const collection = () => load();

/** Accorde un gain une seule fois (clé unique), renvoie le nombre de coffres ajoutés. */
function grant(s, key, n) {
  if (s.granted.includes(key)) return 0;
  s.granted.push(key);
  s.chests += n;
  return n;
}

/**
 * Gains liés à une victoire : le mode, la journée complète, les paliers de série.
 * Sans effet si déjà accordés (rechargement, sauvegardes répétées).
 */
export function rewardWin(mode, date, totalModes) {
  const s = load();
  const gained = [];
  if (grant(s, `win:${mode}:${date}`, 1)) gained.push({ n: 1, why: 'défi réussi' });
  const streak = currentStreak(loadStats(mode), date);
  if (streak > 0 && streak % STEP === 0 && grant(s, `egg:${mode}:${date}`, streak)) {
    gained.push({ n: streak, why: `${streak} jours de série` });
  }
  const today = loadHistory()[date] || {};
  if (Object.keys(today).length >= totalModes) {
    if (grant(s, `day:${date}`, 3)) gained.push({ n: 3, why: 'journée complète' });
    const full = fullDayStreaks(date, totalModes).current;
    if (full > 0 && full % STEP === 0 && grant(s, `egg:jour:${date}`, full)) {
      gained.push({ n: full, why: `${full} journées complètes d'affilée` });
    }
  }
  if (gained.length) save(s);
  return gained;
}

/** Joueurs déjà là à l'arrivée du Bestiaire : un coffre par victoire passée, plafonné. */
export function welcomeChests(modes = [], today = '') {
  const s = load();
  if (s.welcomed) return 0;
  const hist = loadHistory();
  const wins = Object.values(hist).reduce((a, day) => a + Object.keys(day || {}).length, 0);
  // Les victoires d'aujourd'hui sont incluses : elles ne redonneront pas de coffre
  for (const m of Object.keys(hist[today] || {})) if (!s.granted.includes(`win:${m}:${today}`)) s.granted.push(`win:${m}:${today}`);
  if (modes.length && Object.keys(hist[today] || {}).length >= modes.length) s.granted.push(`day:${today}`);
  const n = Math.min(WELCOME_CAP, wins);
  s.welcomed = true;
  s.chests += n;
  save(s);
  return n;
}

function randomUnit() {
  const a = new Uint32Array(1);
  (globalThis.crypto || window.crypto).getRandomValues(a);
  return a[0] / 2 ** 32;
}
function rollRarity() {
  const total = RARITIES.reduce((a, r) => a + r.weight, 0);
  let x = randomUnit() * total;
  for (const r of RARITIES) { if ((x -= r.weight) < 0) return r.id; }
  return 1;
}

function pickPool(pools) {
  const total = pools.reduce((a, p) => a + p.weight, 0);
  let x = randomUnit() * total;
  for (const p of pools) { if ((x -= p.weight) < 0) return p; }
  return pools[0];
}

/**
 * Ouvre `count` coffres (1 ou 10). Le résultat est enregistré AVANT d'être montré :
 * recharger la page ne permet pas de retirer. Ouverture par 10 : au moins une Rare.
 */
export function openChests(set, count) {
  const s = load();
  const n = Math.min(count, s.chests);
  if (!n) return null;
  const rar = [...Array(n)].map(rollRarity);
  if (n >= 10 && !rar.some((r) => r >= 3)) rar[rar.length - 1] = 3;
  const draws = rar.map((r) => {
    // Pré-tirage : équipements (50 %) ou le reste (50 %) ; repli sur toutes les cartes si vide
    const fam = set.pools ? pickPool(set.pools) : null;
    const pool = fam?.byRarity[r - 1]?.length ? fam.byRarity[r - 1] : set.byRarity[r - 1];
    const card = pool[Math.floor(randomUnit() * pool.length)];
    const owned = s.cards[card.id] || 0;
    s.cards[card.id] = owned + 1;
    const dup = owned > 0;
    if (dup) s.shards += rarity(r).shards;
    return { card, dup, shards: dup ? rarity(r).shards : 0 };
  });
  s.chests -= n;
  s.opened += n;
  save(s);
  return draws;
}

/** Crée une carte manquante avec des éclats. */
export function craftCard(card) {
  const s = load();
  const cost = rarity(card.rarity).cost;
  if (s.cards[card.id] || s.shards < cost) return false;
  s.shards -= cost;
  s.cards[card.id] = 1;
  save(s);
  return true;
}
