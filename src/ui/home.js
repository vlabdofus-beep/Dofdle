// Écran d'accueil : la vitrine des six Dofus, disposés en deux arcs autour du
// résumé du jour. Ordinateur : étiquettes de part et d'autre, descriptions
// éclairées au survol / focus. Mobile : cercle compact + panneau du Dofus choisi.
import { h, clear, formatDuration } from './dom.js';
import { todayKey, dayNumber, msUntilNextDaily } from '../core/daily.js';
import { loadGame, loadStats, currentStreak, fullDayStreaks, getPref, setPref } from '../core/storage.js';
import { collection } from '../core/chests.js';
import { NARKOFFRET } from '../data/cards.js';
import { modeInfo, dofusImg } from '../core/modes.js';
import { streakEgg } from './streak.js';


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
    h('p.ring-progress', { 'aria-label': `${done} Dofus récoltés sur ${modes.length}` },
      h('span.ring-count', h('strong', `${done}`), h('span', `/ ${modes.length}`)), h('small', `Dofus récolté${done > 1 ? 's' : ''} aujourd'hui`)),
    full ? h('p.home-fullstreak', streakEgg(full), `${full} journée${full > 1 ? 's' : ''} complète${full > 1 ? 's' : ''} d'affilée`) : null,
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
      h('p.home-card-text', modeInfo(m.id).tagline),
      h('div.home-card-foot',
        st.key !== 'todo' ? h(`span.home-status.${st.key}`, st.text) : null,
        streak ? h('span.home-streak', streakEgg(streak), `${streak} j`) : null,
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
        h('span.ring-text', modeInfo(m.id).tagline),
        h('span.ring-foot',
          h(`span.home-status.${st.key}`, st.text),
          streak ? h('span.home-streak', streakEgg(streak), `${streak} j`) : null)));
      return item;
    })),
    hub);

  root.append(h('section.home-ring', ring, panel));
  const band = bestiaryBand(() => { band.remove(); fitHome(); });
  if (band) root.append(band);
  showPanel();
  fitHome();
}

/**
 * Ordinateur : l'accueil tient toujours dans la hauteur de l'écran. On mesure la page à
 * l'échelle 1, puis on réduit la zone centrale juste assez pour supprimer le défilement.
 */
const desktopQuery = typeof matchMedia === 'function' ? matchMedia('(min-width: 821px)') : { matches: true };
let fitBound = false;
export function fitHome() {
  const app = document.getElementById('app');
  if (!app) return;
  const isHome = document.body.dataset.mode === 'accueil';
  if (!isHome || !desktopQuery.matches) { app.style.zoom = ''; document.documentElement.classList.remove('home-fit'); return; }
  app.style.zoom = '';
  const total = document.documentElement.scrollHeight;
  const appH = app.getBoundingClientRect().height;
  const rest = total - appH;
  const z = Math.max(0.55, Math.min(1, (innerHeight - rest - 2) / appH));
  app.style.zoom = z < 0.995 ? z.toFixed(3) : '';
  // Défilement bloqué seulement si tout tient vraiment
  document.documentElement.classList.toggle('home-fit', document.documentElement.scrollHeight <= innerHeight + 1);
  if (!fitBound) {
    fitBound = true;
    let t = 0;
    window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fitHome, 80); });
    document.fonts?.ready.then(() => fitHome());
  }
}

/** Coffres : notifications (pastille, annonces, bandeau d'accueil) activées par défaut. */
export const chestNotices = () => getPref('chestNotices', true) !== false;
export function setChestNotices(on) {
  setPref('chestNotices', !!on);
  window.dispatchEvent(new CustomEvent('dofusle:chests', { detail: { chests: collection().chests } }));
}

/** Bandeau du Bestiaire sous la vitrine : la collection, ses coffres, et de quoi le masquer. */
function bestiaryBand(onHide) {
  if (!chestNotices()) return null;
  const c = collection();
  const owned = Object.keys(c.cards).length;
  const total = getPref('bestiaryTotal', 0);
  const n = c.chests;
  return h('section.home-bestiary', { 'aria-label': 'Bestiaire du Krosmoz' },
    h('button.hb-hide', { type: 'button', title: 'Masquer le Bestiaire de l\'accueil et le compteur de coffres',
      onclick: () => { setChestNotices(false); onHide(); } }, 'Masquer'),
    h('div.hb-fan', { 'aria-hidden': 'true' }, h('img.hb-chest', { src: NARKOFFRET, alt: '' }), n ? h('span.hb-n', `×${n}`) : null),
    h('div.hb-text',
      h('h2', 'Bestiaire du Krosmoz'),
      h('p', 'Chaque défi réussi te rapporte des coffres. Ouvre-les pour collectionner les cartes des monstres, équipements, sorts, classes et Dofus.'),
      owned ? h('p.hb-count', total ? `${owned} cartes sur ${total}` : `${owned} carte${owned > 1 ? 's' : ''} dans ta collection`,
        total ? h('span.hb-bar', h('i', { style: `width:${Math.min(100, (owned / total) * 100).toFixed(1)}%` })) : null) : null),
    h('a.btn.primary.hb-cta', { href: n ? '#coffres' : '#bestiaire' },
      n ? `Ouvrir ${n > 1 ? `mes ${n} coffres` : 'mon coffre'}` : 'Voir ma collection'));
}
