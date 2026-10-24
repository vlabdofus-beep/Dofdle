// Écran d'accueil : la vitrine des six Dofus, disposés en deux arcs autour du
// résumé du jour. Ordinateur : étiquettes de part et d'autre, descriptions
// éclairées au survol / focus. Mobile : cercle compact + panneau du Dofus choisi.
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

// Emplacements sur les deux arcs : trois Dofus à gauche « ( », trois à droite « ) »
const SLOTS = [
  { side: 'left', x: 37, y: 15, a: -120 }, { side: 'left', x: 28, y: 50, a: 180 }, { side: 'left', x: 37, y: 85, a: 120 },
  { side: 'right', x: 63, y: 15, a: -60 }, { side: 'right', x: 72, y: 50, a: 0 }, { side: 'right', x: 63, y: 85, a: 60 },
];
// Mobile : les six Dofus sur un cercle (angle en degrés, rayon en %)
const orbit = (a) => {
  const r = 37, rad = (a * Math.PI) / 180;
  return `--mx:${(50 + r * Math.cos(rad)).toFixed(1)}%;--my:${(50 + r * Math.sin(rad)).toFixed(1)}%`;
};

const mobileQuery = typeof matchMedia === 'function' ? matchMedia('(max-width: 820px)') : { matches: false };

function status(id, date) {
  const g = loadGame(id, date);
  const n = g.guesses.length;
  if (g.won) return { key: 'won', text: `Récolté en ${n} essai${n > 1 ? 's' : ''}` };
  if (n) return { key: 'progress', text: `En cours : ${n} essai${n > 1 ? 's' : ''}` };
  return { key: 'todo', text: 'À jouer' };
}

export function renderHome(root, modes, { onShareDay } = {}) {
  clear(root);
  const date = todayKey();
  const states = modes.map((m) => ({ m, st: status(m.id, date), streak: currentStreak(loadStats(m.id), date) }));
  const done = states.filter((x) => x.st.key === 'won').length;
  const next = states.find((x) => x.st.key !== 'won');
  const full = fullDayStreaks(date, modes.length).current;

  const countdown = h('strong.countdown');
  const tick = () => { countdown.textContent = formatDuration(msUntilNextDaily()); };
  tick();
  const timer = setInterval(() => { if (!countdown.isConnected) clearInterval(timer); else tick(); }, 1000);

  // --- Centre de la vitrine : le résumé du jour
  const hub = h('div.ring-hub',
    h('h1.home-title', `Défis du jour n° ${dayNumber(date)}`),
    h('p.ring-progress', h('strong', `${done}`), ` / ${modes.length} Dofus récoltés`),
    full ? h('p.home-fullstreak', h('span.streak-flame', { 'aria-hidden': 'true' }), `${full} journée${full > 1 ? 's' : ''} complète${full > 1 ? 's' : ''} d'affilée`) : null,
    h('p.muted.ring-countdown', 'Nouveaux défis dans ', countdown),
    h('div.home-actions',
      next ? h('a.btn.primary.home-cta', { href: `#${next.m.id}`, 'data-mode': next.m.id }, done ? `Continuer : ${next.m.label}` : `Commencer par ${next.m.label}`)
        : h('button.btn.primary.home-cta', { type: 'button', onclick: onShareDay }, 'Partager ma journée'),
      next && done ? h('button.btn', { type: 'button', onclick: onShareDay }, 'Partager ma journée') : null));

  // --- Panneau mobile : description du Dofus sélectionné
  const panel = h('div.ring-panel', { 'aria-live': 'polite' });
  let selected = (next || states[0]).m.id;
  const showPanel = () => {
    const { m, st, streak } = states.find((x) => x.m.id === selected);
    panel.dataset.mode = m.id;
    panel.replaceChildren(
      h('div.ring-panel-head', h('span.home-card-title', m.label), h('span.home-card-dofus', `Dofus ${modeInfo(m.id).dofus}`)),
      h('p.home-card-text', TAGLINES[m.id] || m.intro),
      h('div.home-card-foot',
        h(`span.home-status.${st.key}`, st.text),
        streak ? h('span.home-streak', h('span.streak-flame', { 'aria-hidden': 'true' }), `${streak} j`) : null,
        h('a.btn.primary', { href: `#${m.id}`, 'data-mode': m.id }, st.key === 'won' ? 'Revoir' : 'Jouer')));
    ring.querySelectorAll('.ring-item').forEach((el) => el.classList.toggle('selected', el.dataset.mode === selected));
  };

  // --- Les six Dofus
  const ring = h('nav.ring', { 'aria-label': 'Les six défis du jour' },
    h('div.ring-orbit', h('div.ring-core', { 'aria-hidden': 'true' }, h('strong', String(done)), h('span', `/ ${modes.length}`)),
    states.map(({ m, st, streak }, i) => {
      const slot = SLOTS[i];
      const item = h(`a.ring-item.${slot.side}.${st.key}`, {
        href: `#${m.id}`, 'data-mode': m.id, style: `--x:${slot.x}%;--y:${slot.y}%;--i:${i};${orbit(slot.a)}`,
        'aria-label': `${m.label}, Dofus ${modeInfo(m.id).dofus} : ${st.text}`,
        onclick: (e) => {
          // Mobile : un premier toucher sélectionne le Dofus (pas de survol au toucher)
          if (mobileQuery.matches && selected !== m.id) { e.preventDefault(); selected = m.id; showPanel(); }
        },
      },
      h('span.dofus-slot.ring-dofus', { 'data-mode': m.id },
        h('img.dofus', { src: dofusImg(m.id), alt: '', width: 96, height: 96 }),
        h('img.mode-badge', { src: m.icon, alt: '' })),
      h('span.ring-label',
        h('span.ring-name', m.label),
        h('span.home-card-dofus', `Dofus ${modeInfo(m.id).dofus}`),
        h('span.ring-text', TAGLINES[m.id] || m.intro),
        h('span.ring-foot',
          h(`span.home-status.${st.key}`, st.text),
          streak ? h('span.home-streak', h('span.streak-flame', { 'aria-hidden': 'true' }), `${streak} j`) : null)));
      return item;
    })),
    hub);

  root.append(h('section.home-ring', ring, panel));
  showPanel();
}
