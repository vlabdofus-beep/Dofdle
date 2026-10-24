// Victoire : la section de résultat de chaque mode (phrase du jour, statistiques
// rapides, mode suivant, Dofus du jour), l'enchaînement à la victoire (défilement
// jusqu'à la section, envol du Dofus) et la fenêtre de la journée complète (6/6).
import { h, formatDuration } from './dom.js';
import { openModal, closeModal } from './modal.js';
import { showStats } from './stats.js';
import { hash, todayKey, dayNumber, msUntilNextDaily } from '../core/daily.js';
import { loadGame, loadStats, currentStreak, fullDayStreaks } from '../core/storage.js';
import { nextMode, modeInfo, dofusImg, harvestedToday, MODE_ORDER } from '../core/modes.js';
import { dailyPhrase, dayPhrase } from '../data/phrases.js';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Sur mobile, la rangée des Dofus est une barre fixe en bas d'écran : toujours visible. */
export const mobileBar = () => typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function countdownEl() {
  const el = h('span.countdown');
  const tick = () => { el.textContent = formatDuration(msUntilNextDaily()); };
  tick();
  const timer = setInterval(() => { if (!el.isConnected) clearInterval(timer); else tick(); }, 1000);
  return el;
}

/** Fait voler une copie du Dofus depuis `fromRect` jusqu'à son emplacement dans la rangée. */
export async function flyToRack(mode, fromRect) {
  const done = () => window.dispatchEvent(new CustomEvent('dofusle:landed', { detail: { mode } }));
  const slot = () => document.querySelector(`.mode-tab .dofus-slot[data-mode="${mode}"]`);
  let target = slot();
  if (!fromRect || !target || reducedMotion()) { done(); return; }
  let to = target.getBoundingClientRect();
  if (to.bottom < 0 || to.top > innerHeight) {
    // Rangée hors de l'écran : on remonte d'abord en haut de page
    const y0 = fromRect.top + scrollY;
    scrollTo({ top: 0, behavior: 'smooth' });
    await wait(420);
    fromRect = { left: fromRect.left, width: fromRect.width, height: fromRect.height, top: y0 - scrollY };
    target = slot();
    if (!target) { done(); return; }
    to = target.getBoundingClientRect();
  }
  const ghost = h('img.dofus-ghost', { src: dofusImg(mode), alt: '' });
  Object.assign(ghost.style, { left: `${fromRect.left}px`, top: `${fromRect.top}px`, width: `${fromRect.width}px`, height: `${fromRect.height}px` });
  document.body.append(ghost);
  const dx = to.left + to.width / 2 - (fromRect.left + fromRect.width / 2);
  const dy = to.top + to.height / 2 - (fromRect.top + fromRect.height / 2);
  const scale = to.width / fromRect.width;
  const anim = ghost.animate([
    { transform: 'translate(0, 0) scale(1) rotate(0)', opacity: 1 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 60}px) scale(${(1 + scale) / 2 + 0.15}) rotate(-12deg)`, opacity: 1, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(0)`, opacity: 0.9 },
  ], { duration: 750, easing: 'cubic-bezier(.45, 0, .2, 1)' });
  await anim.finished.catch(() => {});
  ghost.remove();
  done();
}

function distribution(stats, tries) {
  const bucket = tries >= 10 ? '10+' : String(tries);
  const buckets = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'];
  const max = Math.max(1, ...buckets.map((b) => stats.dist[b] || 0));
  return h('div.victory-dist', { 'aria-label': 'Répartition de tes essais dans ce mode' },
    buckets.map((b) => {
      const n = stats.dist[b] || 0;
      return h(`div.vd-col${b === bucket ? '.current' : ''}`, { title: `${b} essai${b === '1' ? '' : 's'} : ${n} fois` },
        h('span.vd-bar', { style: { height: `${Math.max(6, (n / max) * 100)}%` } }),
        h('span.vd-label', b));
    }));
}

/** Les six Dofus du jour, cochés une fois récoltés. */
function dayRack(currentId, date) {
  const done = new Set(harvestedToday(date));
  return h('div.win-rack', { 'aria-label': `${done.size} Dofus sur ${MODE_ORDER.length} récoltés aujourd'hui` },
    MODE_ORDER.map((m, i) => h(`a.win-rack-item${done.has(m.id) ? '.won' : ''}${m.id === currentId ? '.current' : ''}`,
      { href: `#${m.id}`, title: `${m.label} : ${done.has(m.id) ? 'récolté' : 'à jouer'}`, style: `--i:${i}` },
      h('span.dofus-slot', { 'data-mode': m.id }, h('img.dofus', { src: dofusImg(m.id), alt: '', width: 44, height: 44 })),
      done.has(m.id) ? h('span.win-check', { 'aria-hidden': 'true' }, '✓') : null)));
}

/** Section de victoire commune à tous les modes. */
export function winCard({ cfg, date, tries, reveal, onShare }) {
  const info = modeInfo(cfg.id);
  const stats = loadStats(cfg.id);
  const streak = currentStreak(stats, date);
  const count = harvestedToday(date).length;
  const allDone = count >= MODE_ORDER.length;
  const next = nextMode(cfg.id);
  const nextInfo = modeInfo(next.id);
  const box = (value, label) => h('div.stat', h('strong', String(value)), h('span', label));

  const dofus = h('img.dofus-win', { src: dofusImg(cfg.id), alt: `Dofus ${info.dofus}`, width: 96, height: 96, 'data-mode': cfg.id });
  const goNext = (e) => {
    e.preventDefault();
    const href = `#${next.id}`;
    // Ordinateur : le Dofus rejoint la rangée avant de passer au défi suivant
    // (sur mobile, il s'y est déjà posé au moment de la victoire)
    if (mobileBar() || reducedMotion()) { location.hash = href; return; }
    const rect = dofus.getBoundingClientRect();
    dofus.style.visibility = 'hidden';
    flyToRack(cfg.id, rect).then(() => { location.hash = href; });
  };

  return h('section.panel.win-card', { 'aria-label': 'Défi réussi' },
    h('div.win-head', dofus,
      h('div',
        h('div.win-title', `Dofus ${info.dofus} récolté !`),
        h('p.win-phrase', dailyPhrase(date, cfg.id, hash)))),
    reveal,
    h('div.stat-row.win-stats',
      box(tries, tries > 1 ? 'essais' : 'essai'),
      box(streak, streak > 1 ? 'jours de suite' : 'jour de suite'),
      box(`${count}/${MODE_ORDER.length}`, 'Dofus du jour')),
    distribution(stats, tries),
    allDone
      ? h('button.next-mode-card.day-done', { type: 'button', onclick: () => showDayComplete() },
        h('span.next-mode-art', MODE_ORDER.slice(0, 3).map((m) => h('img', { src: dofusImg(m.id), alt: '' }))),
        h('span.next-mode-text', h('small', 'Journée complète'), h('strong', 'Les six Dofus sont récoltés'), h('span', 'Voir le récapitulatif de ta journée')),
        h('span.next-mode-arrow', { 'aria-hidden': 'true' }, '›'))
      : h('a.next-mode-card', { href: `#${next.id}`, 'data-mode': next.id, onclick: goNext },
        h('span.next-mode-art', h('span.dofus-slot', { 'data-mode': next.id },
          h('img.dofus', { src: dofusImg(next.id), alt: '', width: 56, height: 56 }),
          h('img.mode-badge', { src: nextInfo.badge, alt: '' }))),
        h('span.next-mode-text', h('small', 'Mode suivant'), h('strong', next.label), h('span', nextInfo.tagline)),
        h('span.next-mode-arrow', { 'aria-hidden': 'true' }, '›')),
    dayRack(cfg.id, date),
    h('div.win-actions',
      h('button.btn', { type: 'button', onclick: onShare }, 'Partager'),
      h('button.btn', { type: 'button', onclick: () => showStats(cfg) }, 'Statistiques')),
    h('p.next-daily', 'Nouveaux défis dans ', countdownEl()));
}

/**
 * Enchaînement au moment de la victoire : défilement jusqu'à la section,
 * envol du Dofus vers la barre (mobile), puis fenêtre de journée complète au 6/6.
 */
export function celebrate(cfg, result) {
  const card = result.querySelector('.win-card');
  if (!card) return;
  card.classList.add('fresh');
  card.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  const complete = harvestedToday().length >= MODE_ORDER.length;
  const after = complete ? () => setTimeout(showDayComplete, 500) : () => {};
  if (mobileBar()) {
    setTimeout(() => {
      const dofus = card.querySelector('.dofus-win');
      flyToRack(cfg.id, dofus?.isConnected ? dofus.getBoundingClientRect() : null).then(after);
    }, 900);
  } else {
    setTimeout(after, 900);
  }
}

/** Fenêtre de la journée complète : les six Dofus réunis. */
export function showDayComplete() {
  const date = todayKey();
  const games = MODE_ORDER.map((m) => ({ m, n: loadGame(m.id, date).guesses.length }));
  const total = games.reduce((a, x) => a + x.n, 0);
  const full = fullDayStreaks(date, MODE_ORDER.length).current;
  const box = (value, label) => h('div.stat', h('strong', String(value)), h('span', label));
  openModal(`Journée n° ${dayNumber(date)} complète`,
    h('div.day-complete',
      h('div.day-dofus', games.map(({ m }, i) => h('span.dofus-slot', { 'data-mode': m.id, style: `--i:${i}` },
        h('img.dofus', { src: dofusImg(m.id), alt: `Dofus ${m.dofus}`, width: 64, height: 64 })))),
      h('p.victory-phrase', dayPhrase(date, hash)),
      h('div.stat-row',
        box(total, 'essais au total'),
        box(full, full > 1 ? 'journées complètes d\'affilée' : 'journée complète d\'affilée'),
        box(`${MODE_ORDER.length}/${MODE_ORDER.length}`, 'Dofus du jour')),
      h('ul.day-detail', games.map(({ m, n }) => h('li', { 'data-mode': m.id },
        h('img', { src: dofusImg(m.id), alt: '' }), h('span', m.label), h('strong', `${n} essai${n > 1 ? 's' : ''}`)))),
      h('div.victory-actions',
        h('button.btn.primary', { type: 'button', onclick: () => window.dispatchEvent(new Event('dofusle:share-day')) }, 'Partager ma journée'),
        h('a.btn', { href: '#', onclick: (e) => { e.preventDefault(); closeModal(); location.hash = ''; } }, 'Retour à l\'accueil')),
      h('p.next-daily', 'Nouveaux défis dans ', countdownEl())));
}
