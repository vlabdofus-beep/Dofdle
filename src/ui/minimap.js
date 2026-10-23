// Mini-carte du Monde des Douze dessinée à partir des coordonnées des maps.
// Zoom (molette, pincement, boutons +/−), déplacement par glisser,
// un clic (sans glisser) propose les coordonnées visées.
import { h } from './dom.js';
import { hash } from '../core/daily.js';

const STATUS_COLOR = { ok: '#7cd04a', partial: '#f0a63a', ko: '#e0524a' };
const MAX_ZOOM = 14;
const DRAG_THRESHOLD = 6; // px : au-delà, c'est un déplacement et pas un clic

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
  const zoomBtn = (label, title, fn) => h('button.minimap-btn', { type: 'button', title, 'aria-label': title, onclick: fn }, label);
  const controls = h('div.minimap-controls',
    zoomBtn('+', 'Zoomer', () => zoomAt(1.6, vw / 2, vh / 2)),
    zoomBtn('−', 'Dézoomer', () => zoomAt(1 / 1.6, vw / 2, vh / 2)),
    zoomBtn('⟲', 'Vue d\'ensemble', () => { zoom = 1; tx = 0; ty = 0; draw(); }));
  const wrap = h('div.minimap', canvas, tip, controls);

  let base = 4;            // taille d'une case à zoom 1
  let vw = 0, vh = 0;      // taille du canvas (px CSS)
  let zoom = 1, tx = 0, ty = 0; // vue : écran = monde * zoom + t
  let hover = null, marks = [], disabled = false;

  const areaColor = (a) => `hsl(${a ? hash(`area|${a.id}`) % 360 : 40} 32% 34%)`;
  const cellSize = () => base * zoom;

  function clampView() {
    const cw = cols * cellSize(), ch = rows * cellSize();
    tx = cw <= vw ? (vw - cw) / 2 : Math.min(0, Math.max(vw - cw, tx));
    ty = ch <= vh ? (vh - ch) / 2 : Math.min(0, Math.max(vh - ch, ty));
  }

  function layout() {
    const w = wrap.clientWidth || 600;
    const prev = cellSize();
    base = Math.max(1.5, Math.min(w / cols, maxHeight / rows));
    // Conserve le centre de la vue en cas de redimensionnement
    if (vw && prev) { const s = cellSize() / prev; tx = vw / 2 - (vw / 2 - tx) * s; ty = vh / 2 - (vh / 2 - ty) * s; }
    vw = Math.round(cols * base); vh = Math.round(rows * base);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    canvas.style.width = `${vw}px`; canvas.style.height = `${vh}px`;
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  let frame = 0;
  function draw() {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; paint(); });
  }

  function paint() {
    clampView();
    const ctx = canvas.getContext('2d');
    const cell = cellSize();
    ctx.clearRect(0, 0, vw, vh);
    const gap = cell > 3 ? Math.min(1.5, cell * 0.08) : 0;
    const sx = (x) => tx + (x - minX) * cell, sy = (y) => ty + (y - minY) * cell;
    for (const c of cells.values()) {
      const px = sx(c.x), py = sy(c.y);
      if (px > vw || py > vh || px + cell < 0 || py + cell < 0) continue;
      ctx.fillStyle = areaColor(c.area);
      ctx.fillRect(px, py, cell - gap, cell - gap);
    }
    // Coordonnées écrites dans les cases quand on est assez zoomé
    if (cell >= 26) {
      ctx.fillStyle = 'rgba(255, 246, 216, .55)';
      ctx.font = `${Math.min(13, cell / 3.2)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const c of cells.values()) {
        const px = sx(c.x), py = sy(c.y);
        if (px > vw || py > vh || px + cell < 0 || py + cell < 0) continue;
        ctx.fillText(`${c.x},${c.y}`, px + cell / 2, py + cell / 2);
      }
    }
    if (hover) {
      ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 2;
      ctx.strokeRect(sx(hover.x) - 1, sy(hover.y) - 1, cell + 2 - gap, cell + 2 - gap);
    }
    for (const m of marks) {
      const cx = sx(m.posX) + cell / 2, cy = sy(m.posY) + cell / 2;
      ctx.beginPath(); ctx.arc(cx, cy, Math.min(Math.max(3.5, cell * 0.9), cell * 0.38 + 3), 0, Math.PI * 2);
      ctx.fillStyle = STATUS_COLOR[m.status]; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#120f0c'; ctx.stroke();
    }
    wrap.classList.toggle('zoomed', zoom > 1.01);
  }

  function zoomAt(factor, px, py) {
    const next = Math.min(MAX_ZOOM, Math.max(1, zoom * factor));
    const s = next / zoom;
    tx = px - (px - tx) * s; ty = py - (py - ty) * s;
    zoom = next;
    draw();
  }

  const local = (ev) => { const r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
  function cellAtPoint(p) {
    const cell = cellSize();
    const x = Math.floor((p.x - tx) / cell) + minX;
    const y = Math.floor((p.y - ty) / cell) + minY;
    return cells.get(`${x},${y}`) || null;
  }

  function showTip(c, p) {
    if (!c) { tip.hidden = true; return; }
    tip.hidden = false;
    tip.textContent = `[${c.x}, ${c.y}]${c.area ? ` · ${c.area.n}` : ''}`;
    tip.style.left = `${canvas.offsetLeft + Math.min(p.x + 14, vw - 170)}px`;
    tip.style.top = `${canvas.offsetTop + Math.min(p.y + 14, vh - 30)}px`;
  }

  // --- Molette : zoom centré sur le curseur
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const p = local(ev);
    zoomAt(Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0018)), p.x, p.y);
  }, { passive: false });

  // --- Pointeurs : glisser = déplacer, pincer = zoomer, tap/clic = proposer
  const pointers = new Map();
  let gesture = null; // { moved, start, last, pinch: {dist, zoom, mid} }

  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    canvas.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, local(ev));
    if (pointers.size === 1) gesture = { moved: false, start: local(ev), last: local(ev) };
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = { moved: true, pinch: { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } } };
    }
  });

  canvas.addEventListener('pointermove', (ev) => {
    const p = local(ev);
    if (!pointers.has(ev.pointerId)) {
      // Survol simple (souris)
      const c = cellAtPoint(p);
      if (c !== hover) { hover = c; draw(); }
      showTip(c, p);
      return;
    }
    pointers.set(ev.pointerId, p);
    if (!gesture) return;
    if (gesture.pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      tx += mid.x - gesture.pinch.mid.x; ty += mid.y - gesture.pinch.mid.y;
      zoomAt(dist / gesture.pinch.dist, mid.x, mid.y);
      gesture.pinch = { dist, mid };
      return;
    }
    if (!gesture.moved && Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > DRAG_THRESHOLD) {
      gesture.moved = true;
      wrap.classList.add('dragging');
      tip.hidden = true;
    }
    if (gesture.moved) {
      tx += p.x - gesture.last.x; ty += p.y - gesture.last.y;
      draw();
    }
    gesture.last = p;
  });

  function endPointer(ev, cancelled) {
    if (!pointers.has(ev.pointerId)) return;
    pointers.delete(ev.pointerId);
    if (pointers.size > 0) {
      // Fin d'un pincement : on repart sur un glisser avec le doigt restant, sans clic
      const [rest] = [...pointers.values()];
      gesture = { moved: true, start: rest, last: rest };
      return;
    }
    const g = gesture;
    gesture = null;
    wrap.classList.remove('dragging');
    if (cancelled || !g || g.moved || disabled) return;
    const c = cellAtPoint(local(ev));
    if (c) onPick({ posX: c.x, posY: c.y });
  }
  canvas.addEventListener('pointerup', (ev) => endPointer(ev, false));
  canvas.addEventListener('pointercancel', (ev) => endPointer(ev, true));
  canvas.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'mouse' && !pointers.size) { hover = null; tip.hidden = true; draw(); }
  });
  canvas.addEventListener('dblclick', (ev) => ev.preventDefault());

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => layout()) : null;
  ro?.observe(wrap);
  requestAnimationFrame(layout);

  return {
    el: wrap,
    setMarks(list) { marks = list; draw(); },
    disable(flag) { disabled = flag; wrap.classList.toggle('disabled', flag); },
  };
}
