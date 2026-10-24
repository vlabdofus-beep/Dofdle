// Fenêtre de victoire : phrase du jour, Dofus récolté, statistiques rapides et
// bouton vers le défi suivant. À la fermeture, le Dofus s'envole vers sa place
// dans la rangée des modes.
import { h } from './dom.js';
import { openModal, closeModal } from './modal.js';
import { hash, todayKey } from '../core/daily.js';
import { loadStats, currentStreak } from '../core/storage.js';
import { nextMode, modeInfo, dofusImg, harvestedToday, MODE_ORDER } from '../core/modes.js';
import { dailyPhrase } from '../data/phrases.js';

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Fait voler une copie du Dofus depuis `fromRect` jusqu'à son emplacement dans la rangée. */
async function flyToRack(mode, fromRect) {
  const done = () => window.dispatchEvent(new CustomEvent('dofusle:landed', { detail: { mode } }));
  let target = document.querySelector(`.mode-tab .dofus-slot[data-mode="${mode}"]`);
  if (!fromRect || !target || reducedMotion()) { done(); return; }
  let to = target.getBoundingClientRect();
  if (to.bottom < 0 || to.top > innerHeight) {
    // Rangée hors de l'écran : on remonte d'abord en haut de page
    scrollTo({ top: 0, behavior: 'smooth' });
    await wait(450);
    target = document.querySelector(`.mode-tab .dofus-slot[data-mode="${mode}"]`);
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
  ], { duration: 900, easing: 'cubic-bezier(.45, 0, .2, 1)' });
  await anim.finished.catch(() => {});
  ghost.remove();
  done();
}

/**
 * @param {object} o
 *  - cfg : configuration du mode (id, label)
 *  - tries : nombre d'essais
 *  - answer : texte de la bonne réponse
 *  - onShare : partage du résultat du mode
 */
export function showVictory({ cfg, tries, answer, onShare }) {
  const date = todayKey();
  const info = modeInfo(cfg.id);
  const stats = loadStats(cfg.id);
  const streak = currentStreak(stats, date);
  const count = harvestedToday(date).length;
  const next = nextMode(cfg.id);
  const allDone = count >= MODE_ORDER.length;
  const bucket = tries >= 10 ? '10+' : String(tries);
  const buckets = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'];
  const max = Math.max(1, ...buckets.map((b) => stats.dist[b] || 0));

  let leaveTo = null; // hash à ouvrir après l'envol du Dofus
  const dofus = h('img.victory-dofus', { src: dofusImg(cfg.id), alt: `Dofus ${info.dofus}`, width: 112, height: 112, 'data-mode': cfg.id });
  const go = (href) => (e) => { e.preventDefault(); leaveTo = href; closeModal(); };
  const box = (value, label) => h('div.stat', h('strong', String(value)), h('span', label));

  openModal('Défi réussi',
    h('div.victory', { 'data-mode': cfg.id },
      h('div.victory-hero', dofus,
        h('div',
          h('p.victory-title', `Dofus ${info.dofus} récolté !`),
          h('p.victory-phrase', dailyPhrase(date, cfg.id, hash)))),
      answer ? h('p.victory-answer', 'La réponse était ', h('strong', answer), '.') : null,
      h('div.stat-row',
        box(tries, tries > 1 ? 'essais' : 'essai'),
        box(streak, streak > 1 ? 'jours de suite' : 'jour de suite'),
        box(`${count}/${MODE_ORDER.length}`, 'Dofus du jour')),
      h('div.victory-dist', { 'aria-label': 'Répartition de tes essais dans ce mode' },
        buckets.map((b) => {
          const n = stats.dist[b] || 0;
          return h(`div.vd-col${b === bucket ? '.current' : ''}`, { title: `${b} essai${b === '1' ? '' : 's'} : ${n} fois` },
            h('span.vd-bar', { style: { height: `${Math.max(6, (n / max) * 100)}%` } }),
            h('span.vd-label', b));
        })),
      h('div.victory-actions',
        allDone
          ? h('a.btn.primary', { href: '#', onclick: go('#') }, 'Voir ma collection du jour')
          : h('a.btn.primary', { href: `#${next.id}`, onclick: go(`#${next.id}`) }, `Défi suivant : ${next.label}`),
        h('button.btn', { type: 'button', onclick: onShare }, 'Partager'),
        h('button.btn', { type: 'button', onclick: () => closeModal() }, 'Voir ma grille'))),
    {
      onClose: () => {
        const rect = dofus.isConnected ? dofus.getBoundingClientRect() : null;
        dofus.style.visibility = 'hidden';
        flyToRack(cfg.id, rect).then(() => { if (leaveTo !== null) location.hash = leaveTo; });
      },
    });
}
