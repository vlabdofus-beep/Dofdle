// Mini-carte du Monde des Douze dessinée à partir des coordonnées des maps.
// Vue d'ensemble fixe (pas de zoom) : un clic propose les coordonnées visées.
import { h } from './dom.js';
import { hash } from '../core/daily.js';

const STATUS_COLOR = { ok: '#7cd04a', partial: '#f0a63a', ko: '#e0524a' };

/**
 * @param {object} opts
 *  - maps: [[mapId, x, y, subId, outdoor]]
 *  - areaOf(subId) -> { id, n }
 *  - onPick({posX, posY})
 */
export function createMinimap({ maps, areaOf, onPick, maxHeight = 520 }) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const cells = new Map();
  for (const [, x, y, sub] of maps) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    const k = `${x},${y}`;
    if (!cells.has(k)) cells.set(k, { x, y, area: areaOf(sub) });
  }
  const cols = maxX - minX + 1, rows = maxY - minY + 1;

  const canvas = h('canvas.minimap-canvas', { role: 'img', 'aria-label': 'Mini-carte du Monde des Douze : clique pour proposer des coordonnées' });
  const tip = h('div.minimap-tip', { hidden: true });
  const wrap = h('div.minimap', canvas, tip);
  let cell = 4, offX = 0, offY = 0, hover = null, marks = [];

  const areaColor = (a, light = 0) => {
    const hue = a ? hash(`area|${a.id}`) % 360 : 40;
    return `hsl(${hue} 32% ${34 + light}%)`;
  };

  function layout() {
    const w = wrap.clientWidth || 600;
    cell = Math.max(1.5, Math.min(w / cols, maxHeight / rows));
    const cw = Math.round(cols * cell), ch = Math.round(rows * cell);
    offX = 0; offY = 0;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gap = cell > 3 ? 0.5 : 0;
    for (const c of cells.values()) {
      ctx.fillStyle = areaColor(c.area);
      ctx.fillRect(offX + (c.x - minX) * cell, offY + (c.y - minY) * cell, cell - gap, cell - gap);
    }
    if (hover) {
      ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 1.5;
      ctx.strokeRect(offX + (hover.x - minX) * cell - 1, offY + (hover.y - minY) * cell - 1, cell + 2, cell + 2);
    }
    for (const m of marks) {
      const cx = offX + (m.posX - minX + 0.5) * cell, cy = offY + (m.posY - minY + 0.5) * cell;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(3.5, cell * 0.9), 0, Math.PI * 2);
      ctx.fillStyle = STATUS_COLOR[m.status]; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#120f0c'; ctx.stroke();
    }
  }

  function cellAt(ev) {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((ev.clientX - r.left - offX) / cell) + minX;
    const y = Math.floor((ev.clientY - r.top - offY) / cell) + minY;
    return cells.get(`${x},${y}`) || null;
  }

  canvas.addEventListener('mousemove', (ev) => {
    const c = cellAt(ev);
    if (c !== hover) { hover = c; draw(); }
    if (c) {
      tip.hidden = false;
      tip.textContent = `[${c.x}, ${c.y}]${c.area ? ` · ${c.area.n}` : ''}`;
      const r = wrap.getBoundingClientRect();
      tip.style.left = `${Math.min(ev.clientX - r.left + 12, r.width - 160)}px`;
      tip.style.top = `${ev.clientY - r.top + 12}px`;
    } else tip.hidden = true;
  });
  canvas.addEventListener('mouseleave', () => { hover = null; tip.hidden = true; draw(); });
  canvas.addEventListener('click', (ev) => {
    const c = cellAt(ev);
    if (c) onPick({ posX: c.x, posY: c.y });
  });
  // Pas de zoom : on neutralise le pincement/ctrl+molette sur la mini-carte
  canvas.addEventListener('wheel', (ev) => { if (ev.ctrlKey) ev.preventDefault(); }, { passive: false });
  wrap.style.touchAction = 'pan-y';

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => layout()) : null;
  ro?.observe(wrap);
  requestAnimationFrame(layout);

  return {
    el: wrap,
    setMarks(list) { marks = list; draw(); },
    disable(flag) { wrap.classList.toggle('disabled', flag); },
  };
}
