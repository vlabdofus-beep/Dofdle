// Mode Cri : écouter le cri d'un monstre (extrait des fichiers audio de Dofus 3)
// et retrouver à qui il appartient. Les monstres qui partagent le même squelette
// (variantes, archimonstres…) partagent le même son : ils sont tous acceptés.
import { h } from '../ui/dom.js';
import { normalize } from '../core/text.js';
import { pickDaily, pickBossWeighted, BOSS_WEIGHT_FROM } from '../core/daily.js';
import { loadDataset } from '../core/cache.js';
import { createHints } from '../ui/hints.js';
import { monstersDataset, compareMonsters, monsterEntries } from '../data/monsters.js';
import { monsterReveal } from './monster.js';

const COLUMNS = ['race'];

async function loadCris() {
  const res = await fetch('data/cris.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Liste des cris introuvable (data/cris.json)');
  return res.json();
}

function audioPlayer(src) {
  const audio = new Audio(src);
  audio.preload = 'auto';
  const label = h('span', 'Écouter le cri');
  const btn = h('button.cry-play', { type: 'button', 'aria-label': 'Écouter le cri du monstre' }, h('span.cry-icon', '▶'), label);
  const bar = h('div.cry-bar', h('div.cry-progress'));
  const progress = bar.firstChild;
  btn.addEventListener('click', () => {
    if (!audio.paused) { audio.pause(); audio.currentTime = 0; return; }
    audio.currentTime = 0;
    audio.play().catch(() => { label.textContent = 'Lecture impossible'; });
  });
  audio.addEventListener('play', () => { btn.classList.add('playing'); btn.firstChild.textContent = '■'; label.textContent = 'Lecture…'; });
  const stop = () => { btn.classList.remove('playing'); btn.firstChild.textContent = '▶'; label.textContent = 'Réécouter'; progress.style.width = '0%'; };
  audio.addEventListener('ended', stop);
  audio.addEventListener('pause', stop);
  audio.addEventListener('timeupdate', () => { progress.style.width = `${(audio.currentTime / (audio.duration || 1)) * 100}%`; });
  return h('div.cry-player', btn, bar);
}

export const criMode = {
  id: 'cri',
  label: 'Cri',
  emoji: '🔊',
  icon: 'assets/game/ui/mode-cri.png',
  salt: 'cri',
  intro: 'Écoute le cri du monstre mystère et retrouve à qui il appartient. Les variantes qui partagent le même cri sont acceptées.',
  placeholder: 'Nom d\'un monstre…',
  nameLabel: 'Monstre',
  yesterdayLabel: 'Le cri d\'hier était celui de',
  noPartial: true, // la famille est juste ou fausse
  columns: [
    { key: 'race', label: 'Famille', help: 'Famille du monstre : vert si c\'est la même' },
  ],

  async load(onProgress) {
    const [monsters, cris] = await Promise.all([loadDataset(monstersDataset, onProgress), loadCris()]);
    return { ...monsters, cris: cris.cris };
  },

  prepare(data) {
    const entries = monsterEntries(data, normalize);
    const byBones = new Map();
    for (const e of entries) {
      if (!e.ref.b) continue;
      if (!byBones.has(e.ref.b)) byBones.set(e.ref.b, []);
      byBones.get(e.ref.b).push(e);
    }
    // Une cible = un cri ; sa "fiche" est le monstre non-archi le plus bas niveau qui l'utilise
    const pool = [];
    for (const cri of data.cris) {
      const owners = cri.b.flatMap((b) => byBones.get(b) || []);
      const main = owners.filter((e) => e.ref.k !== 'archi').sort((a, b) => a.ref.l[0] - b.ref.l[0])[0];
      if (!main) continue;
      pool.push({ id: `cri:${cri.f}`, n: main.n, ref: main.ref, cri, bones: new Set(cri.b), owners });
    }
    return { entries, pool };
  },

  /** Boss 20 %, monstres + archimonstres 80 % (avant le 25/10/2026 : ancien tirage). */
  pickDaily(pool, date) {
    if (date < BOSS_WEIGHT_FROM) return pickDaily(pool, 'cri', date);
    return pickBossWeighted(pool, 'cri', date, (e) => e.owners.some((o) => o.ref.k === 'boss'));
  },

  isWin: (entry, target) => target.bones.has(entry.ref.b),
  compare: (g, t, data) => compareMonsters(g, t, data, COLUMNS),

  clue(ctx) {
    const { target, data } = ctx;
    const [lmin, lmax] = target.ref.l;
    const hints = createHints(ctx, [
      { key: 'niveau', at: 5, title: 'Niveau', render: () => h('p', lmin === lmax ? `Niveau ${lmin}` : `Niveau ${lmin} à ${lmax}`) },
      { key: 'famille', at: 10, title: 'Famille', render: () => h('p', data.races[target.ref.r]?.n || '?') },
    ], { className: 'compact' });
    const el = h('div.panel.clue.cry-clue',
      h('div.clue-visual.cry-visual', h('img.cry-emblem', { src: 'assets/game/ui/mode-cri.png', alt: '' })),
      h('div.clue-meta',
        h('h3', 'Cri mystère'),
        audioPlayer(`assets/cris/${target.cri.f}`),
        h('p.muted', 'Les indices se débloquent au fil des essais : clique pour les révéler.'),
        hints.el));
    return { el, update: (g) => hints.update(g) };
  },

  reveal(target, data) {
    const others = [...new Set(target.owners.map((e) => e.n))].filter((n) => n !== target.n);
    return monsterReveal(target.ref, data, others.length
      ? h('p.small.muted', `Même cri : ${others.slice(0, 6).join(', ')}${others.length > 6 ? '…' : ''}`)
      : null);
  },
};
