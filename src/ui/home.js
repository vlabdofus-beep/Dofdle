// Écran d'accueil : choix du mode, avec l'état du défi du jour de chacun.
import { h, clear, formatDuration } from './dom.js';
import { todayKey, dayNumber, msUntilNextDaily } from '../core/daily.js';
import { loadGame, loadStats, currentStreak, fullDayStreaks } from '../core/storage.js';
import { modeInfo, dofusImg } from '../core/modes.js';

const TAGLINES = {
  monstre: 'Devine le monstre grâce à sa famille, son niveau, sa zone et ses faiblesses.',
  sort: 'Reconnais le sort de classe caché derrière son icône floutée ou zoomée.',
  carte: 'Situe la map mystère sur la carte du Monde des Douze.',
  objet: 'Retrouve l\'équipement à partir de ses effets ou de son icône.',
  cri: 'Écoute le cri et retrouve le monstre qui le pousse.',
  'juste-prix': 'Trouve le nombre exact d\'une question improbable sur le jeu.',
};

function status(id, date) {
  const g = loadGame(id, date);
  const n = g.guesses.length;
  if (g.won) return { key: 'won', text: `Récolté en ${n} essai${n > 1 ? 's' : ''}` };
  if (n) return { key: 'progress', text: `En cours : ${n} essai${n > 1 ? 's' : ''}` };
  return { key: 'todo', text: 'À jouer' };
}

/** Récapitulatif des statistiques de tous les modes (bouton trophée de l'accueil). */
export function statsSummary(modes) {
  const date = todayKey();
  return h('table.stats-table',
    h('thead', h('tr', h('th', 'Mode'), h('th', 'Défis réussis'), h('th', 'Série'), h('th', 'Meilleure série'))),
    h('tbody', modes.map((m) => {
      const s = loadStats(m.id);
      return h('tr', h('td', m.label), h('td', String(s.wins)), h('td', String(currentStreak(s, date))), h('td', String(s.best)));
    })));
}

export function renderHome(root, modes, { onShareDay, onInstall } = {}) {
  clear(root);
  const date = todayKey();
  const states = modes.map((m) => ({ m, st: status(m.id, date) }));
  const done = states.filter((x) => x.st.key === 'won').length;
  const next = states.find((x) => x.st.key !== 'won');

  const countdown = h('strong.countdown');
  const tick = () => { countdown.textContent = formatDuration(msUntilNextDaily()); };
  tick();
  const timer = setInterval(() => { if (!countdown.isConnected) clearInterval(timer); else tick(); }, 1000);

  root.append(
    h('section.home-hero',
      h('h1.home-title', `Défis du jour n° ${dayNumber(date)}`),
      h('p.home-sub', 'Six défis, six Dofus à récolter. Les mêmes pour tout le monde, renouvelés chaque nuit à minuit.'),
      h('div.home-progress',
        h('span', done === modes.length ? 'Les six Dofus du jour sont récoltés !' : `${done} Dofus sur ${modes.length} récoltés`),
        (() => { const s = fullDayStreaks(date, modes.length).current; return s ? h('span.home-fullstreak', h('span.streak-flame', { 'aria-hidden': 'true' }), `${s} journée${s > 1 ? 's' : ''} complète${s > 1 ? 's' : ''} d'affilée`) : null; })(),
        h('span.muted', 'Nouveaux défis dans ', countdown)),
      h('div.home-actions',
        next ? h('a.btn.primary.home-cta', { href: `#${next.m.id}`, 'data-mode': next.m.id }, done ? `Continuer : ${next.m.label}` : `Commencer par ${next.m.label}`)
          : h('button.btn.primary.home-cta', { type: 'button', onclick: onShareDay }, 'Partager ma journée'),
        next && done ? h('button.btn', { type: 'button', onclick: onShareDay }, 'Partager ma journée') : null,
        onInstall ? h('button.btn', { type: 'button', onclick: onInstall }, 'Installer l\'application') : null)),
    h('div.home-grid', states.map(({ m, st }, i) => {
      const streak = currentStreak(loadStats(m.id), date);
      return h(`a.home-card.${st.key}`, { href: `#${m.id}`, 'data-mode': m.id, style: `--i:${i}` },
        h('span.dofus-slot.home-dofus', { 'data-mode': m.id },
          h('img.dofus', { src: dofusImg(m.id), alt: '', width: 64, height: 64 }),
          h('img.mode-badge', { src: m.icon, alt: '' })),
        h('span.home-card-body',
          h('span.home-card-title', m.label),
          h('span.home-card-dofus', `Dofus ${modeInfo(m.id).dofus}`),
          h('span.home-card-text', TAGLINES[m.id] || m.intro)),
        h('span.home-card-foot',
          h(`span.home-status.${st.key}`, st.text),
          streak ? h('span.home-streak', h('span.streak-flame', { 'aria-hidden': 'true' }), `${streak} j`) : null));
    })));
}
