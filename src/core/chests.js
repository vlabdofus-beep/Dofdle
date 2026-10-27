// Coffres et collection du Bestiaire (stockage local, sans compte).
// Gains : 1 coffre par mode réussi, 3 pour la journée complète, et des paliers de série :
// tous les 5 jours d'affilée, autant de coffres que de jours (5, puis 10, puis 15…),
// pour la série de chaque mode comme pour celle des journées complètes.
import { loadStats, currentStreak, loadHistory, fullDayStreaks } from './storage.js';
import { addDays, dayNumber, LAUNCH_DATE } from './daily.js';
import { RARITIES, rarity } from '../data/cards.js';
import { STEP } from '../ui/streak.js';
import { readSigned, writeSigned } from './seal.js';

const KEY = 'dofusle:v1:bestiaire';
export const WELCOME_CAP = 20; // ancien cadeau d'accueil plafonné (déduit du rattrapage)
const CATCHUP_VERSION = 1;

const GIFT_KEY = 'gift:30:2026-10-27'; // compensation offerte à tous à l'arrivée du garde-fou
const GIFT = 30;

function load() {
  let s = null;
  const { raw, state } = readSigned(KEY);
  // Sauvegarde modifiée à la main : ignorée (secureChests la remet à zéro au démarrage)
  try { s = state === 'tampered' ? null : JSON.parse(raw || 'null'); } catch { s = null; }
  // Données modifiables à la main : on vérifie la forme avant de s'en servir
  if (!s || typeof s !== 'object') s = {};
  return {
    chests: Number.isFinite(s.chests) && s.chests >= 0 ? Math.floor(s.chests) : 0,
    shards: Number.isFinite(s.shards) && s.shards >= 0 ? Math.floor(s.shards) : 0,
    cards: s.cards && typeof s.cards === 'object' ? s.cards : {},
    granted: Array.isArray(s.granted) ? s.granted.slice(-5000) : [],
    welcomed: s.welcomed === true,
    catchup: Number.isFinite(s.catchup) ? s.catchup : 0,
    opened: Number.isFinite(s.opened) ? s.opened : 0,
  };
}
function save(s) {
  writeSigned(KEY, JSON.stringify(s));
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
  // La série des statistiques est recoupée avec l'historique (les deux sont signés)
  const streak = Math.min(currentStreak(loadStats(mode), date), historyRun(mode, date));
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

/** Jours d'affilée où le mode a été réussi, en remontant depuis `date`. */
function historyRun(mode, date) {
  const hist = winsByDay([mode]);
  let n = 0, d = date;
  while (hist[d] && hist[d][mode] != null && n < 5000) { n++; d = addDays(d, -1); }
  return n;
}

/**
 * Victoires par jour : l'historique, complété par les séries des statistiques (une série de
 * n jours finissant à la dernière victoire prouve les n jours, même s'ils manquent à l'historique).
 */
function winsByDay(modes) {
  const hist = JSON.parse(JSON.stringify(loadHistory()));
  for (const m of modes) {
    const st = loadStats(m);
    if (!st.lastWin || !Number.isFinite(st.streak)) continue;
    for (let i = 0, d = st.lastWin; i < Math.min(st.streak, 5000) && d >= LAUNCH_DATE; i++, d = addDays(d, -1)) {
      hist[d] = { ...(hist[d] || {}) };
      if (hist[d][m] == null) hist[d][m] = 1;
    }
  }
  return hist;
}

/** Tout ce que l'historique permet d'avoir gagné (règles actuelles) : total et clés du registre. */
function entitlement(modes, today) {
  const hist = winsByDay(modes);
  const dates = Object.keys(hist).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= LAUNCH_DATE && d <= today).sort();
  const keys = [];
  let total = 0;
  const run = {};
  let fullRun = 0;
  for (const d of dates) {
    const day = hist[d] || {};
    const prev = hist[addDays(d, -1)] || {};
    for (const m of Object.keys(day)) {
      keys.push(`win:${m}:${d}`); total += 1;
      run[m] = prev[m] != null ? (run[m] || 0) + 1 : 1;
      if (run[m] % STEP === 0) { keys.push(`egg:${m}:${d}`, `egg:${m}:${d}:+`); total += run[m]; }
    }
    if (modes.length && modes.every((m) => day[m] != null)) {
      keys.push(`day:${d}`); total += 3;
      fullRun = modes.every((m) => prev[m] != null) ? fullRun + 1 : 1;
      if (fullRun % STEP === 0) { keys.push(`egg:jour:${d}`, `egg:jour:${d}:+`); total += fullRun; }
    } else fullRun = 0;
  }
  return { total, keys };
}

/**
 * Maximum théorique de coffres reçus depuis le lancement : un joueur parfait qui a réussi
 * les six défis chaque jour (1 par défi, 3 par journée complète, et chaque palier de 5 jours
 * pour les six séries de mode et celle des journées complètes), plus les cadeaux.
 */
export function maxChests(modesCount, today) {
  const days = Math.max(0, dayNumber(today));
  let max = days * (modesCount + 3);
  for (let k = STEP; k <= days; k += STEP) max += k * (modesCount + 1);
  return max + GIFT + WELCOME_CAP;
}

/**
 * Au démarrage : garde-fou sur la sauvegarde du Bestiaire, puis compensation de 30 coffres.
 * - modifiée à la main : coffres, éclats et cartes remis à zéro ;
 * - ancienne sauvegarde non signée : les coffres sont plafonnés à ce que l'historique permet ;
 * - plus de coffres reçus que le maximum théorique depuis le lancement : remise à zéro ;
 * renvoie { reset, gift }.
 */
export function secureChests(modes = [], today = '') {
  const { raw, state } = readSigned(KEY);
  const ent = entitlement(modes, today);
  let reset = false;
  let s;
  if (state === 'tampered') {
    reset = true;
    s = { chests: 0, shards: 0, cards: {}, granted: [...ent.keys, GIFT_KEY], welcomed: true, catchup: CATCHUP_VERSION, opened: 0 };
  } else {
    s = load();
    if (raw && state === 'legacy') s.chests = Math.min(s.chests, Math.max(0, ent.total + WELCOME_CAP - s.opened));
  }
  let gift = 0;
  if (!s.granted.includes(GIFT_KEY)) { s.granted.push(GIFT_KEY); s.chests += GIFT; gift = GIFT; }
  // Rattrapage permanent : tout ce que les victoires et séries donnent droit d'avoir reçu
  // (coffres à ouvrir + coffres déjà ouverts) est complété s'il en manque
  let credit = 0;
  if (!reset) {
    const due = ent.total + GIFT;
    const received = s.chests + s.opened;
    if (received < due) { credit = due - received; s.chests += credit; }
    const has = new Set(s.granted);
    for (const k of ent.keys) if (!has.has(k)) s.granted.push(k);
    s.welcomed = true;
    s.catchup = CATCHUP_VERSION;
  }
  // Plus de coffres reçus (ouverts + à ouvrir) ou de cartes que le maximum théorique : remise à zéro
  const cardsHeld = Object.values(s.cards).reduce((a, n) => a + (Number.isFinite(n) ? n : 0), 0);
  const max = maxChests(modes.length || 6, today);
  if (!reset && (s.chests + s.opened > max || s.opened > max || cardsHeld > s.opened + Math.floor((s.opened * 100) / 10))) {
    reset = true;
    s = { chests: 0, shards: 0, cards: {}, granted: [...ent.keys, GIFT_KEY], welcomed: true, catchup: CATCHUP_VERSION, opened: 0 };
  }
  save(s);
  return { reset, gift, credit };
}

/**
 * Rattrapage : toutes les récompenses des victoires passées, sans plafond, une seule fois.
 * Rejoue l'historique : 1 coffre par défi, 3 par journée complète, et à chaque palier de
 * 5 jours de série (par mode et en journées complètes) autant de coffres que de jours.
 * Les gains déjà touchés (clés du registre) ne sont pas redonnés ; les paliers payés
 * 2 coffres avec l'ancienne règle sont complétés ; l'ancien cadeau d'accueil (20 au plus) est déduit.
 */
export function catchUpChests(modes = [], today = '') {
  const s = load();
  if (s.catchup >= CATCHUP_VERSION) return 0;
  const hist = loadHistory();
  const dates = Object.keys(hist).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today).sort();
  const has = new Set(s.granted);
  let total = 0;
  let wins = 0;
  const give = (key, n) => { if (has.has(key)) return; has.add(key); s.granted.push(key); total += n; };
  const run = {};
  let fullRun = 0;
  for (const d of dates) {
    const day = hist[d] || {};
    const prev = hist[addDays(d, -1)] || {};
    for (const m of Object.keys(day)) {
      if (!has.has(`win:${m}:${d}`)) wins++;
      give(`win:${m}:${d}`, 1);
      run[m] = prev[m] != null ? (run[m] || 0) + 1 : 1;
      if (run[m] % STEP === 0) milestone(`egg:${m}:${d}`, run[m]);
    }
    const full = modes.length && modes.every((m) => day[m] != null);
    if (full) {
      give(`day:${d}`, 3);
      const prevFull = modes.every((m) => prev[m] != null);
      fullRun = prevFull ? fullRun + 1 : 1;
      if (fullRun % STEP === 0) milestone(`egg:jour:${d}`, fullRun);
    } else fullRun = 0;
  }
  function milestone(key, n) {
    // Palier déjà payé 2 coffres (ancienne règle) : on complète
    if (has.has(key)) { if (n > 2) give(`${key}:+`, n - 2); return; }
    give(key, n);
  }
  // Ancien cadeau d'accueil : il couvrait déjà une partie des victoires passées
  if (s.welcomed) total = Math.max(0, total - Math.min(WELCOME_CAP, wins));
  s.welcomed = true;
  s.catchup = CATCHUP_VERSION;
  s.chests += total;
  save(s);
  return total;
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
