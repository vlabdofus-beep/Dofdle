// « Ta collection » : Dofus du jour, série de journées complètes, calendrier façon Almanax
// et statistiques de chaque mode. Tout vient du navigateur (aucun compte).
import { h } from './dom.js';
import { openModal } from './modal.js';
import { showStats } from './stats.js';
import { todayKey, addDays, LAUNCH_DATE } from '../core/daily.js';
import { loadHistory, loadStats, currentStreak, fullDayStreaks } from '../core/storage.js';
import { dofusImg, modeInfo } from '../core/modes.js';
import { KROSMOZ_MONTHS } from '../core/krosmoz.js';

const DAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Grille d'un mois : chaque jour coloré selon le nombre de Dofus récoltés. */
function calendar(year, month, modes, onNav) {
  const hist = loadHistory();
  const today = todayKey();
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7; // lundi en premier
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(h('span.cal-day.empty', { 'aria-hidden': 'true' }));
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const won = Object.keys(hist[key] || {}).filter((id) => modes.some((m) => m.id === id));
    const n = won.length;
    const future = key > today, before = key < LAUNCH_DATE;
    const cls = ['cal-day', future || before ? 'off' : '', key === today ? 'today' : '', n >= modes.length ? 'full' : ''].filter(Boolean).join('.');
    const label = future ? '' : `${n} Dofus sur ${modes.length}`;
    cells.push(h(`span.${cls}`, { style: `--fill:${n / modes.length}`, title: label ? `${d} ${KROSMOZ_MONTHS[month]} : ${label}` : undefined, 'aria-label': label ? `${d} : ${label}` : `${d}` },
      h('span.cal-num', String(d)),
      n && !future ? h('span.cal-count', n >= modes.length ? '✦' : String(n)) : null));
  }
  const [ty, tm] = today.split('-').map(Number);
  const isCurrent = year === ty && month === tm - 1;
  const [ly, lm] = LAUNCH_DATE.split('-').map(Number);
  const isFirst = year === ly && month === lm - 1;
  return h('div.calendar',
    h('div.cal-head',
      h('button.cal-nav', { type: 'button', 'aria-label': 'Mois précédent', disabled: isFirst, onclick: () => onNav(-1) }, '‹'),
      h('strong', `${KROSMOZ_MONTHS[month]} ${year}`),
      h('button.cal-nav', { type: 'button', 'aria-label': 'Mois suivant', disabled: isCurrent, onclick: () => onNav(1) }, '›')),
    h('div.cal-grid', DAY_INITIALS.map((l) => h('span.cal-wd', { 'aria-hidden': 'true' }, l)), cells),
    h('div.cal-legend', h('span', h('i.cal-sw.l1'), '1 à 5 Dofus'), h('span', h('i.cal-sw.full'), 'Les six')));
}

export function showCollection(modes) {
  const today = todayKey();
  const hist = loadHistory();
  const todayWon = hist[today] || {};
  const { current, best } = fullDayStreaks(today, modes.length);
  const daysPlayed = Object.keys(hist).filter((d) => Object.keys(hist[d]).length).length;
  const totalDofus = Object.values(hist).reduce((a, day) => a + Object.keys(day).length, 0);
  const box = (value, label) => h('div.stat', h('strong', String(value)), h('span', label));

  let [y, m] = today.split('-').map(Number); m -= 1;
  const calWrap = h('div');
  const drawCal = () => calWrap.replaceChildren(calendar(y, m, modes, (dir) => {
    m += dir; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    drawCal();
  }));
  drawCal();

  openModal('Ta collection',
    h('div.coll-today', modes.map((mode) => {
      const tries = todayWon[mode.id];
      return h(`a.coll-dofus${tries ? '.won' : ''}`, { href: `#${mode.id}`, 'data-mode': mode.id, title: tries ? `Récolté en ${tries} essai${tries > 1 ? 's' : ''}` : 'Pas encore récolté' },
        h('span.dofus-slot', { 'data-mode': mode.id }, h('img.dofus', { src: dofusImg(mode.id), alt: '', width: 56, height: 56 })),
        h('span.coll-name', modeInfo(mode.id).dofus),
        tries ? h('span.coll-tries', `${tries} essai${tries > 1 ? 's' : ''}`) : null);
    })),
    h('div.stat-row.four.coll-stats',
      box(current, 'série de journées complètes'),
      box(best, 'meilleure série 6/6'),
      box(daysPlayed, 'jours joués'),
      box(totalDofus, 'Dofus récoltés')),
    calWrap,
    h('h3', 'Par mode'),
    h('table.stats-table',
      h('thead', h('tr', h('th', 'Mode'), h('th', 'Réussis'), h('th', 'Série'), h('th', 'Record'), h('th', h('span.sr-only', 'Détails')))),
      h('tbody', modes.map((mode) => {
        const s = loadStats(mode.id);
        return h('tr', h('td', mode.label), h('td', String(s.wins)), h('td', String(currentStreak(s, today))), h('td', String(s.best)),
          h('td', h('button.link', { type: 'button', onclick: () => showStats(mode) }, 'Détails')));
      }))),
    h('p.muted.small', 'Tout est enregistré uniquement dans ce navigateur. Un jour « complet » = les six Dofus récoltés.'));
}
