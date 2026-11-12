// Mode Silhouettes (remplace le Cri, garde son identifiant, ses séries et le Dofus Ivoire) :
// deux monstres fondus en une seule silhouette, à retrouver tous les deux.
// Les monstres qui partagent la même apparence (même squelette) sont acceptés.
import { h, clear, img, isTouch, announce } from '../ui/dom.js';
import { play } from '../ui/sound.js';
import { createHints } from '../ui/hints.js';
import { createAutocomplete } from '../ui/autocomplete.js';
import { loadDataset } from '../core/cache.js';
import { normalize } from '../core/text.js';
import { todayKey, dayNumber, rankDaily, rng, hash, addDays } from '../core/daily.js';
import { loadGame, saveGame, recordWin, loadStats, currentStreak } from '../core/storage.js';
import { monstersDataset, monsterEntries, monsterFilters, monsterImg } from '../data/monsters.js';
import { shareResult } from '../ui/share.js';
import { celebrate } from '../ui/victory.js';
import { modeHead, winCard, yesterdayLine, unveil } from './engine.js';
import { monsterReveal } from './monster.js';

export const SILHOUETTES_FROM = '2026-11-12'; // premier jour du mode (avant : le Cri)
const COUNT = 2;
const TINT = '#dccaa0';                       // ivoire, la couleur du Dofus du mode
const EXCLUDED_SR = new Set([13, 20, 27, 28]); // alignement, archis, quête, invocations
const SPREAD_FROM = 3;   // l'écartement commence à la 3e erreur…
const SPREAD_STEP = 2.5; // …et s'accentue un peu à chaque erreur (en % de la taille d'une forme)
const SPREAD_MAX = 12;
const MIN_OWN = 0.3;     // part de chaque forme qui ne doit pas être recouverte par l'autre
const MIN_FUSE = 0.15;   // recouvrement minimal, pour que les deux formes n'en fassent qu'une
const ALPHA = 160;       // seuil d'opacité : ombres au sol et halos des images ignorés

export const silhouettesMode = {
  id: 'cri',
  label: 'Silhouettes',
  emoji: '👥',
  icon: 'assets/game/ui/mode-silhouettes.png',
  intro: 'Deux monstres se cachent dans une seule silhouette. Retrouve-les tous les deux.',
};

/** Monstres pouvant être tirés : monstres et boss, sans archis, quête, alignement ni invocations. */
const drawable = (entries, data) => entries.filter((e) => !e.hidden && (e.ref.k === 'normal' || e.ref.k === 'boss')
  && !EXCLUDED_SR.has(data.races[e.ref.r]?.sr));

/** Les deux monstres du jour, d'apparences différentes. */
export function dailyPair(pool, date) {
  const out = [], used = new Set();
  for (const e of rankDaily(pool, 'silhouettes', date)) {
    if (!e.ref.b || used.has(e.ref.b)) continue;
    used.add(e.ref.b); out.push(e);
    if (out.length === COUNT) break;
  }
  return out;
}

// ---------- Images : recadrage sur la forme, puis placement des deux formes ----------

async function cropped(m) {
  const bmp = await createImageBitmap(await (await fetch(monsterImg(m))).blob());
  const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
  g.drawImage(bmp, 0, 0);
  const a = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (a[(y * c.width + x) * 4 + 3] > ALPHA) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error('image vide');
  const w = x1 - x0 + 1, hh = y1 - y0 + 1;
  const out = document.createElement('canvas'); out.width = w; out.height = hh;
  out.getContext('2d').drawImage(bmp, x0, y0, w, hh, 0, 0, w, hh);
  return { canvas: out, src: out.toDataURL(), w, h: hh };
}

// Masque d'une forme posée comme à l'écran (boîte de 100 px, image contenue, décalage en %)
const S = 100, W = 300;
function mask(crop, dx, dy) {
  const c = new OffscreenCanvas(W, W), g = c.getContext('2d');
  const k = Math.min(S / crop.w, S / crop.h), w = crop.w * k, hh = crop.h * k;
  g.drawImage(crop.canvas, (W - S) / 2 + dx + (S - w) / 2, (W - S) / 2 + dy + (S - hh) / 2, w, hh);
  const a = g.getImageData(0, 0, W, W).data, m = new Uint8Array(W * W);
  for (let i = 0; i < m.length; i++) m[i] = a[i * 4 + 3] > ALPHA ? 1 : 0;
  return m;
}

/** Décalages du jour (les mêmes pour tout le monde) : fondus, sans qu'une forme avale l'autre. */
function placement(crops, date) {
  const r = rng(hash(`silhouettes-place|${date}`));
  let best = null;
  for (let t = 0; t < 16; t++) {
    const dx = 6 + r() * (16 + t), dy = r() * 12 - 6;
    if (!crops) return [[-dx, -dy], [dx, dy]];
    const A = mask(crops[0], -dx, -dy), B = mask(crops[1], dx, dy);
    let a = 0, b = 0, both = 0;
    for (let i = 0; i < A.length; i++) { a += A[i]; b += B[i]; both += A[i] & B[i]; }
    const own = Math.min((a - both) / a, (b - both) / b), fuse = both / Math.min(a, b);
    const score = own >= MIN_OWN && fuse >= MIN_FUSE ? 2 + own : Math.min(own, fuse * 2);
    if (!best || score > best.score) best = { score, off: [[-dx, -dy], [dx, dy]] };
    if (score >= 2) break;
  }
  return best.off;
}

// ---------- Partie ----------

export async function runSilhouettesMode(root, opts = {}) {
  const cfg = silhouettesMode;
  clear(root);
  const loader = h('div.loader', h('div.loader-label', 'Chargement des données DofusDB…'), h('div.loader-bar', h('div.loader-fill')));
  root.append(loader);
  const fill = loader.querySelector('.loader-fill');
  const label = loader.querySelector('.loader-label');

  let data;
  try {
    data = await loadDataset(monstersDataset, (ratio, step) => {
      fill.style.width = `${Math.round(ratio * 100)}%`;
      label.textContent = `Chargement depuis DofusDB : ${step}… ${Math.round(ratio * 100)}%`;
    });
  } catch (e) {
    clear(root).append(h('div.panel.error', h('h3', 'Impossible de charger les données'),
      h('p', 'DofusDB ne répond pas pour le moment. Vérifie ta connexion puis réessaie.'), h('p.muted', String(e.message || e)),
      h('button.btn', { onclick: () => runSilhouettesMode(root, opts) }, 'Réessayer')));
    return;
  }

  const date = todayKey();
  const entries = monsterEntries(data, normalize);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const pool = drawable(entries, data);
  const targets = dailyPair(pool, date);

  const game = loadGame(cfg.id, date);
  const save = () => saveGame(cfg.id, game);
  // Partie du Cri commencée le jour du changement : gagnée, on la garde ; sinon on repart de zéro
  if (game.guesses.some((id) => !byId.has(id))) {
    if (game.won) { clear(root).append(modeHead(cfg, date), legacyDone()); return; }
    game.guesses = []; game.hints = []; save();
  }

  label.textContent = 'Préparation de la silhouette…'; fill.style.width = '100%';
  let crops = null;
  try { crops = await Promise.all(targets.map((t) => cropped(t.ref))); } catch { crops = null; }
  const offsets = placement(crops, date);

  const matchOf = (e) => targets.findIndex((t) => t.ref.b === e.ref.b);
  const foundSet = () => new Set(game.guesses.map((id) => matchOf(byId.get(id))).filter((i) => i >= 0));
  const misses = () => game.guesses.filter((id) => matchOf(byId.get(id)) < 0).length;

  clear(root);
  root.append(modeHead(cfg, date));

  // --- Silhouette
  const shapes = targets.map((t, i) => h('div.sil-shape',
    h('img', { src: crops ? crops[i].src : monsterImg(t.ref), alt: '', draggable: 'false' })));
  const frame = h('div.clue-visual.sil-frame', { role: 'img', 'aria-label': 'Silhouette mêlant deux monstres' }, shapes);
  const slots = targets.map(() => h('div.sil-slot'));
  const hints = createHints({ game, save }, [
    { key: 'famille', at: 6, title: 'Une famille', render: () => h('p', data.races[targets[0].ref.r]?.n || '?') },
    { key: 'zone', at: 9, title: 'Une zone', render: () => h('p', data.subareas[targets[1].ref.z]?.n || '?') },
  ], { className: 'compact' });
  // Filtre SVG : couleur unie et bords nets (les deux formes se fondent en une)
  const filter = h('div.sil-defs', { 'aria-hidden': 'true' });
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(TINT.slice(i, i + 2), 16) / 255);
  filter.innerHTML = `<svg width="0" height="0"><filter id="sil-tint" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 12 -7.8"/></filter></svg>`;

  // --- Saisie
  const ac = createAutocomplete({
    items: entries.filter((e) => !e.hidden && e.ref.k !== 'archi'),
    ...monsterFilters(data, entries),
    noun: ['monstre', 'monstres'],
    placeholder: 'Nom d\'un monstre ou d\'un boss…',
    exclude: () => new Set(game.guesses),
    onSelect: (it) => guess(it.id),
  });
  const counter = h('div.counter');
  const inputPanel = h('div.panel.input-panel', ac.el, counter);
  const result = h('div.result');
  const tries = h('div.sil-tries');
  const yDate = addDays(date, -1);
  const yPair = yDate >= SILHOUETTES_FROM ? dailyPair(pool, yDate) : null;

  root.append(filter,
    h('div.panel.sil-clue', frame, h('div.sil-side', h('div.sil-slots', slots), hints.el)),
    inputPanel, result, tries);
  if (yPair?.length) root.append(yesterdayLine('Hier, la silhouette cachait', yPair.map((e) => e.n).join(' et ')));

  function layout() {
    const extra = Math.min(SPREAD_MAX, Math.max(0, misses() - SPREAD_FROM + 1) * SPREAD_STEP);
    const found = foundSet();
    shapes.forEach((el, i) => {
      const [dx, dy] = offsets[i], len = Math.hypot(dx, dy) || 1;
      el.style.transform = `translate(${dx + (dx / len) * extra}%, ${dy + (dy / len) * extra}%)`;
      el.classList.toggle('found', found.has(i) && !game.won);
    });
    frame.classList.toggle('done', game.won);
  }

  function refresh() {
    const found = foundSet();
    const n = game.guesses.length;
    root.classList.toggle('no-guess', !n);
    layout();
    slots.forEach((s, i) => {
      const t = targets[i];
      s.classList.toggle('found', found.has(i));
      s.replaceChildren(...(found.has(i)
        ? [img(monsterImg(t.ref), '', 'sil-slot-img'), h('span.sil-slot-name', t.n)]
        : [h('span.sil-slot-q', '?'), h('span.sil-slot-name.muted', 'À trouver')]));
    });
    counter.textContent = n ? `${found.size} / ${COUNT} trouvé${found.size > 1 ? 's' : ''}, ${n} essai${n > 1 ? 's' : ''}` : '';
    hints.update(game);
    ac.disable(game.won); ac.sync();
    inputPanel.classList.toggle('done', game.won);
    tries.replaceChildren(...[...game.guesses].reverse().map((id) => {
      const e = byId.get(id), ok = matchOf(e) >= 0;
      return h(`span.sil-try.${ok ? 'ok' : 'ko'}`, img(e.img, '', 'sil-try-img'), e.n);
    }));
    clear(result);
    if (game.won) {
      result.append(winCard({
        cfg, date, tries: n,
        reveal: h('div.sil-reveal', targets.map((t) => monsterReveal(t.ref, data))),
        onShare: () => shareResult(buildShare(), 'Résultat copié !'),
      }));
    }
  }

  function guess(id) {
    if (game.won || game.guesses.includes(id)) return;
    const e = byId.get(id), i = matchOf(e);
    const already = foundSet().has(i);
    game.guesses.push(id);
    if (foundSet().size === COUNT) {
      game.won = true;
      recordWin(cfg.id, date, game.guesses.length);
    }
    save();
    refresh();
    if (game.won) {
      announce(`${e.n} : bonne réponse ! Les deux monstres sont trouvés en ${game.guesses.length} essais.`);
      unveil(root);
      setTimeout(() => play('harvest'), 900);
      setTimeout(() => celebrate(cfg, result), 1400);
    } else if (i >= 0 && !already) {
      announce(`${e.n} : bonne réponse, il en reste un.`);
      play('good');
    } else {
      const m = misses();
      announce(`${e.n} : ce n'est aucun des deux.${m === SPREAD_FROM ? ' La silhouette commence à se séparer.' : ''}`);
      play('guess');
    }
    if (!game.won && isTouch()) setTimeout(() => frame.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 250);
  }

  function buildShare() {
    const marks = game.guesses.map((id) => (matchOf(byId.get(id)) >= 0 ? '🟩' : '🟥'));
    const line = marks.length > 14 ? [...marks.slice(0, 12), '…', marks[marks.length - 1]] : marks;
    return [`Dofusle #${dayNumber(date)} — ${cfg.label} ${cfg.emoji}`,
      `Trouvés en ${game.guesses.length} essai${game.guesses.length > 1 ? 's' : ''} · série ${currentStreak(loadStats(cfg.id), date)} 🔥`,
      line.join(''), location.href.split('#')[0] + `#${cfg.id}`].join('\n');
  }

  refresh();
  if (!game.won && !isTouch()) ac.focus();
}

function legacyDone() {
  return h('div.panel.sil-legacy',
    h('h3', 'Défi du jour déjà réussi'),
    h('p', 'Tu as trouvé le Cri du jour : ta série continue. Le Cri laisse sa place aux Silhouettes, ton premier défi t\'attend dès minuit.'));
}
