import { h } from './dom.js';
import { openModal } from './modal.js';
import { loadStats, currentStreak, endlessWins } from '../core/storage.js';
import { todayKey } from '../core/daily.js';

export function showStats(cfg) {
  const s = loadStats(cfg.id);
  const buckets = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'];
  const max = Math.max(1, ...buckets.map((b) => s.dist[b] || 0));
  const box = (value, label) => h('div.stat', h('strong', value), h('span', label));
  openModal(`Statistiques — ${cfg.label}`,
    h('div.stat-row',
      box(s.wins, 'défis réussis'),
      box(currentStreak(s, todayKey()), 'série actuelle'),
      box(s.best, 'meilleure série'),
      box(endlessWins(cfg.id), 'en illimité')),
    h('h3', 'Nombre d\'essais'),
    h('div.dist', buckets.map((b) => {
      const n = s.dist[b] || 0;
      return h('div.dist-row', h('span.dist-label', b), h('div.dist-bar', { style: { width: `${Math.max(6, (n / max) * 100)}%` } }, String(n)));
    })),
    h('p.muted.small', 'Les statistiques sont stockées uniquement dans ce navigateur.'));
}
