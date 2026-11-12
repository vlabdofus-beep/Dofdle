// Prototype du mode Silhouettes : 2 monstres fondus en une seule silhouette, à retrouver tous les deux.
const COUNT = 2;
const TINT = '#dccaa0'; // ivoire, la couleur du Dofus du mode
const EXCLUDED_SR = new Set([13, 20, 27, 28]); // alignement, archis, quête, invocations
const SPREAD_FROM = 3;   // l'écartement commence à la 3e erreur…
const SPREAD_STEP = 2.5; // …puis s'accentue un peu à chaque erreur (en % de la taille d'une forme)
const SPREAD_MAX = 12;
const HINT_AT = { family: 6, zone: 9 };
const MIN_OWN = 0.3;     // part minimale de chaque forme qui ne doit pas être recouverte par l'autre
const MIN_FUSE = 0.15;   // recouvrement minimal, pour que les deux formes ne fassent qu'une
const $ = (id) => document.getElementById(id);
const img = (m) => `https://api.dofusdb.fr/img/monsters/${m.g}.png`;
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let D, pool, entries, state;

// filtre SVG : couleur unie, bords nets (les ombres portées et halos des images sont ignorés)
function makeFilter() {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(TINT.slice(i, i + 2), 16) / 255);
  $('filters').innerHTML = `<filter id="tint" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 12 -7.8"/></filter>`;
}

// recadre l'image sur sa forme (les PNG de DofusDB ont une large marge transparente)
async function cropped(m) {
  const bmp = await createImageBitmap(await (await fetch(img(m))).blob());
  const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
  g.drawImage(bmp, 0, 0);
  const a = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (a[(y * c.width + x) * 4 + 3] > 160) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error('image vide');
  const w = x1 - x0 + 1, hh = y1 - y0 + 1;
  const out = document.createElement('canvas'); out.width = w; out.height = hh;
  out.getContext('2d').drawImage(bmp, x0, y0, w, hh, 0, 0, w, hh);
  return { canvas: out, src: out.toDataURL(), w, h: hh };
}

// masque d'une forme posée comme à l'écran (boîte de 100 px, image contenue, décalage en %)
const S = 100, W = 300;
function mask(crop, dx, dy) {
  const c = new OffscreenCanvas(W, W), g = c.getContext('2d');
  const k = Math.min(S / crop.w, S / crop.h), w = crop.w * k, hh = crop.h * k;
  const bx = (W - S) / 2 + dx, by = (W - S) / 2 + dy;
  g.drawImage(crop.canvas, bx + (S - w) / 2, by + (S - hh) / 2, w, hh);
  const a = g.getImageData(0, 0, W, W).data, m = new Uint8Array(W * W);
  for (let i = 0; i < m.length; i++) m[i] = a[i * 4 + 3] > 160 ? 1 : 0;
  return m;
}

// cherche une position où les deux formes se fondent sans que l'une avale l'autre
function placement(crops) {
  let best = null;
  for (let t = 0; t < 14; t++) {
    const dx = 6 + Math.random() * 16, dy = Math.random() * 12 - 6;
    const A = mask(crops[0], -dx, -dy), B = mask(crops[1], dx, dy);
    let a = 0, b = 0, both = 0;
    for (let i = 0; i < A.length; i++) { a += A[i]; b += B[i]; both += A[i] & B[i]; }
    const ownA = (a - both) / a, ownB = (b - both) / b, fuse = both / Math.min(a, b);
    const score = Math.min(ownA, ownB) >= MIN_OWN && fuse >= MIN_FUSE ? 2 + Math.min(ownA, ownB) : Math.min(ownA, ownB, fuse * 2);
    if (!best || score > best.score) best = { score, off: [[-dx, -dy], [dx, dy]] };
    if (score >= 2) break;
  }
  return best;
}

function pick() {
  const used = new Set(), out = [];
  while (out.length < COUNT) {
    const m = pool[Math.floor(Math.random() * pool.length)];
    if (used.has(m.b)) continue;
    used.add(m.b); out.push(m);
  }
  return out;
}

async function start() {
  $('status').textContent = 'Préparation…';
  let targets, crops, place;
  for (let k = 0; k < 8; k++) {
    targets = pick();
    try { crops = await Promise.all(targets.map(cropped)); } catch { continue; }
    if (crops.some((c) => c.w * c.h < 22 * 22)) continue; // formes trop petites : illisibles
    place = placement(crops);
    if (place.score >= 2) break;
  }
  state = { targets, off: place.off, found: targets.map(() => false), misses: 0, tries: [], done: false };
  const frame = $('frame'); frame.innerHTML = '';
  targets.forEach((m, i) => {
    const el = document.createElement('div');
    el.className = 'sil';
    const im = new Image(); im.src = crops[i].src; im.alt = ''; im.draggable = false; im.style.filter = 'url(#tint)';
    el.append(im); frame.append(el);
  });
  layout();
  const slots = $('slots'); slots.innerHTML = '';
  targets.forEach(() => {
    const s = document.createElement('div');
    s.className = 'slot';
    s.innerHTML = `<span class="ph">?</span><span class="nm">&nbsp;</span>`;
    slots.append(s);
  });
  $('tries').innerHTML = ''; $('hint').textContent = ''; $('win').innerHTML = '';
  $('q').disabled = false; $('q').value = ''; $('sugg').hidden = true;
  status();
}

// positions : décalage de départ, plus un léger écartement après quelques erreurs
function layout() {
  const extra = Math.min(SPREAD_MAX, Math.max(0, state.misses - SPREAD_FROM + 1) * SPREAD_STEP);
  [...$('frame').children].forEach((el, i) => {
    const [dx, dy] = state.off[i], len = Math.hypot(dx, dy) || 1;
    el.style.transform = `translate(${dx + (dx / len) * extra}%, ${dy + (dy / len) * extra}%)`;
  });
}

function status() {
  const n = state.found.filter(Boolean).length;
  const next = [SPREAD_FROM, HINT_AT.family, HINT_AT.zone].map((v) => v - state.misses).find((v) => v > 0);
  $('status').textContent = `${n} / ${COUNT} trouvés, ${state.tries.length} essai${state.tries.length > 1 ? 's' : ''}`
    + (next && !state.done ? `, indice dans ${next} erreur${next > 1 ? 's' : ''}` : '');
}

function hints() {
  layout();
  const rest = state.targets.filter((_, i) => !state.found[i]);
  const lines = [];
  if (state.misses >= SPREAD_FROM && rest.length > 1) lines.push('La silhouette commence à se séparer.');
  if (rest.length && state.misses >= HINT_AT.family) lines.push(`Famille de l'un des monstres : <b>${D.races[rest[0].r]?.n ?? '?'}</b>`);
  if (rest.length && state.misses >= HINT_AT.zone) {
    const m = rest[rest.length - 1];
    lines.push(`Zone de ${rest.length > 1 ? "l'autre" : 'ce monstre'} : <b>${D.areas[m.z] ?? '?'}</b>`);
  }
  $('hint').innerHTML = lines.join('<br>');
}

function guess(m) {
  if (state.done || state.tries.some((t) => t.id === m.id)) return;
  const i = state.targets.findIndex((t, k) => !state.found[k] && t.b === m.b);
  const chip = document.createElement('span'); chip.textContent = m.n;
  state.tries.push(m);
  if (i >= 0) {
    state.found[i] = true; chip.className = 'ok';
    $('frame').children[i].classList.add('found');
    const s = $('slots').children[i], t = state.targets[i];
    s.classList.add('found');
    s.innerHTML = `<img src="${img(t)}" alt=""><span class="nm">${t.n}</span>`;
  } else state.misses++;
  $('tries').append(chip);
  hints(); status();
  if (state.found.every(Boolean)) win();
}

function win() {
  state.done = true; $('q').disabled = true; status();
  $('win').innerHTML = `<div class="sil-win"><h2>Les deux sont démasqués</h2><div>en ${state.tries.length} essais, dont ${state.misses} erreur${state.misses > 1 ? 's' : ''}</div><button type="button" id="again">Nouvelle silhouette</button></div>`;
  $('again').onclick = start;
}

let sel = 0, shown = [];
function suggest() {
  const q = norm($('q').value);
  const box = $('sugg');
  if (!q) { box.hidden = true; return; }
  const tried = new Set(state.tries.map((t) => t.id));
  shown = entries.filter((e) => !tried.has(e.m.id) && e.key.includes(q))
    .sort((a, b) => (b.key.startsWith(q) - a.key.startsWith(q)) || a.m.n.localeCompare(b.m.n)).slice(0, 8);
  sel = 0;
  box.innerHTML = '';
  shown.forEach((e, k) => {
    const b = document.createElement('button'); b.type = 'button'; if (!k) b.className = 'on';
    b.innerHTML = `<img src="${img(e.m)}" alt="" loading="lazy"><span>${e.m.n}<small>${D.races[e.m.r]?.n ?? ''}${e.m.k === 'boss' ? ' (boss)' : ''}</small></span>`;
    b.onmousedown = (ev) => { ev.preventDefault(); choose(e.m); };
    box.append(b);
  });
  box.hidden = !shown.length;
}
function choose(m) { $('q').value = ''; $('sugg').hidden = true; guess(m); $('q').focus(); }

async function init() {
  makeFilter();
  D = await (await fetch('../data/monsters.json')).json();
  const ok = (m) => (m.k === 'normal' || m.k === 'boss') && !m.x && !EXCLUDED_SR.has(D.races[m.r]?.sr);
  pool = D.monsters.filter(ok);
  entries = pool.map((m) => ({ m, key: norm(m.n) }));
  $('q').addEventListener('input', suggest);
  $('q').addEventListener('keydown', (ev) => {
    const items = [...$('sugg').children];
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault(); if (!items.length) return;
      items[sel]?.classList.remove('on'); sel = (sel + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[sel].classList.add('on');
    } else if (ev.key === 'Enter' && shown[sel]) { ev.preventDefault(); choose(shown[sel].m); }
    else if (ev.key === 'Escape') $('sugg').hidden = true;
  });
  $('reroll').onclick = start;
  start();
}
init();
