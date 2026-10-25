// Mode Cri : écouter le cri d'un monstre (extrait des fichiers audio de Dofus 3)
// et retrouver à qui il appartient. Les monstres qui partagent le même squelette
// (variantes, archimonstres…) partagent le même son : ils sont tous acceptés.
import { h } from '../ui/dom.js';
import { normalize } from '../core/text.js';
import { pickDaily, pickBossWeighted, BOSS_WEIGHT_FROM } from '../core/daily.js';
import { loadDataset } from '../core/cache.js';
import { createHints } from '../ui/hints.js';
import { monstersDataset, compareMonsters, monsterEntries, monsterFilters, SPECIAL_EXCLUDED_FROM } from '../data/monsters.js';
import { monsterReveal } from './monster.js';

const COLUMNS = ['race'];

async function loadCris() {
  const res = await fetch('data/cris.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Liste des cris introuvable (data/cris.json)');
  return res.json();
}

/**
 * Lecteur du cri. Pendant la lecture, l'onde du son se dessine en direct dans le cadre
 * doré (`visual`) : on voit que le cri joue, et sa forme fait partie de l'indice.
 */
function audioPlayer(src, visual) {
  const audio = new Audio(src);
  audio.preload = 'auto';
  const label = h('span', 'Écouter le cri');
  const btn = h('button.cry-play', { type: 'button', 'aria-label': 'Écouter le cri du monstre' }, h('span.cry-icon', '▶'), label);
  const progress = h('span.cry-progress', { 'aria-hidden': 'true' });
  btn.prepend(progress);

  const canvas = h('canvas.cry-wave', { width: 320, height: 320, 'aria-hidden': 'true' });
  visual?.append(canvas);
  let analyser = null, raf = 0, buf = null;
  const setupAnalyser = () => {
    if (analyser) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const source = ac.createMediaElementSource(audio);
      analyser = ac.createAnalyser();
      analyser.fftSize = 1024;
      buf = new Uint8Array(analyser.fftSize);
      source.connect(analyser).connect(ac.destination);
      audio.addEventListener('play', () => ac.state === 'suspended' && ac.resume());
    } catch { analyser = null; }
  };
  const draw = () => {
    const g = canvas.getContext('2d');
    const { width: w, height: hgt } = canvas;
    g.clearRect(0, 0, w, hgt);
    if (analyser) {
      analyser.getByteTimeDomainData(buf);
      const color = getComputedStyle(canvas).color || '#f0d28e';
      g.lineWidth = 3; g.strokeStyle = color; g.shadowColor = color; g.shadowBlur = 10;
      g.beginPath();
      for (let i = 0; i < buf.length; i++) {
        const x = (i / (buf.length - 1)) * w;
        const y = hgt / 2 + ((buf[i] - 128) / 128) * hgt * 0.42;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
    raf = requestAnimationFrame(draw);
  };

  btn.addEventListener('click', () => {
    if (!audio.paused) { audio.pause(); audio.currentTime = 0; return; }
    setupAnalyser();
    audio.currentTime = 0;
    audio.play().catch(() => { label.textContent = 'Lecture impossible'; });
  });
  audio.addEventListener('play', () => {
    btn.classList.add('playing'); visual?.classList.add('playing');
    btn.querySelector('.cry-icon').textContent = '■'; label.textContent = 'Lecture…';
    cancelAnimationFrame(raf); draw();
  });
  const stop = () => {
    btn.classList.remove('playing'); visual?.classList.remove('playing');
    btn.querySelector('.cry-icon').textContent = '▶'; label.textContent = 'Réécouter'; progress.style.width = '0%';
    cancelAnimationFrame(raf);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };
  audio.addEventListener('ended', stop);
  audio.addEventListener('pause', stop);
  audio.addEventListener('timeupdate', () => { progress.style.width = `${(audio.currentTime / (audio.duration || 1)) * 100}%`; });
  return h('div.cry-player', btn);
}

/** Une cible = un cri ; sa "fiche" est le monstre non-archi le plus bas niveau qui l'utilise. */
function criPool(data, entries) {
  const byBones = new Map();
  for (const e of entries) {
    if (!e.ref.b) continue;
    if (!byBones.has(e.ref.b)) byBones.set(e.ref.b, []);
    byBones.get(e.ref.b).push(e);
  }
  const pool = [];
  for (const cri of data.cris) {
    const owners = cri.b.flatMap((b) => byBones.get(b) || []);
    const main = owners.filter((e) => e.ref.k !== 'archi').sort((a, b) => a.ref.l[0] - b.ref.l[0])[0];
    if (!main) continue;
    pool.push({ id: `cri:${cri.f}`, n: main.n, ref: main.ref, cri, bones: new Set(cri.b), owners });
  }
  return pool;
}

export const criMode = {
  id: 'cri',
  label: 'Cri',
  emoji: '🔊',
  icon: 'assets/game/ui/mode-cri.png',
  salt: 'cri',
  intro: 'Écoute le cri du monstre mystère et retrouve à qui il appartient. Les variantes qui partagent le même cri sont acceptées.',
  placeholder: 'Nom d\'un monstre…',
  listNoun: ['monstre', 'monstres'],
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

  filters: (data, entries) => monsterFilters(data, entries),

  prepare(data) {
    const entries = monsterEntries(data, normalize);
    // pool.all : tirage historique ; pool.visible : sans monstres d'alignement ni de quête
    return { entries, pool: { all: criPool(data, entries), visible: criPool(data, entries.filter((e) => !e.hidden)) } };
  },

  /** Boss 20 %, monstres + archimonstres 80 % (avant le 25/10/2026 : ancien tirage). */
  pickDaily(pool, date) {
    if (date < BOSS_WEIGHT_FROM) return pickDaily(pool.all, 'cri', date);
    const eligible = date < SPECIAL_EXCLUDED_FROM ? pool.all : pool.visible;
    return pickBossWeighted(eligible, 'cri', date, (e) => e.owners.some((o) => o.ref.k === 'boss'));
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
    const visual = h('div.clue-visual.cry-visual', h('img.cry-emblem', { src: 'assets/game/ui/mode-cri.png', alt: '' }));
    const el = h('div.panel.clue.cry-clue',
      visual,
      h('div.clue-meta',
        h('h3', 'Cri mystère'),
        audioPlayer(`assets/cris/${target.cri.f}`, visual),
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
