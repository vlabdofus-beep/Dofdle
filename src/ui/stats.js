// Statistiques d'un mode : mêmes chiffres et même répartition que la section de victoire.
import { h } from './dom.js';
import { openModal } from './modal.js';
import { loadStats, currentStreak, loadGame } from '../core/storage.js';
import { todayKey } from '../core/daily.js';
import { distribution } from './victory.js';
import { streakEgg, streakTitle } from './streak.js';

export function showStats(cfg) {
  const s = loadStats(cfg.id);
  const today = loadGame(cfg.id, todayKey());
  const streak = currentStreak(s, todayKey());
  const box = (value, label) => h('div.stat', h('strong', String(value)), h('span', label));
  openModal(`${cfg.label} : tes statistiques`,
    h('div.mode-stats', { 'data-mode': cfg.id },
      h('div.stat-row.win-stats',
        box(s.wins, s.wins > 1 ? 'défis réussis' : 'défi réussi'),
        box(streak, streak > 1 ? 'jours de suite' : 'jour de suite'),
        box(s.best, 'meilleure série')),
      h('p.stats-egg', streakEgg(streak), h('span', streakTitle(streak))),
      h('h3', 'Nombre d\'essais pour trouver'),
      // La barre du jour est mise en avant quand le défi est déjà réussi
      distribution(s, today.won ? today.guesses.length : 0),
      h('p.muted.small', 'Tes statistiques restent dans ce navigateur.')));
}
