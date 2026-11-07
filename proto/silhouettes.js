// Prototype du mode Silhouettes : 4 monstres mélangés, à retrouver tous.
const COLORS = ['#d9613a', '#34aaa6', '#93c02c', '#c58be0']; // pourpre, turquoise, émeraude, mauve
const EXCLUDED_SR = new Set([13, 20, 27, 28]); // alignement, archis, quête, invocations
const MIXED = [[-13, -9], [12, -11], [-10, 11], [13, 10]];  // décalages en % (mélange)
const SPREAD = [[-22, -20], [22, -20], [-22, 20], [22, 20]]; // indice : silhouettes écartées
const HINT_AT = { spread: 3, family: 6, zone: 9 };
const $ = (id) => document.getElementById(id);
const img = (m) => `https://api.dofusdb.fr/img/monsters/${m.g}.png`;
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

let D, pool, entries, state;

// filtres SVG : chaque silhouette prend une couleur unie (canal alpha conservé)
function makeFilters() {
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  $('filters').innerHTML = COLORS.map((c, i) => {
    const [r, g, b] = hex(c);
    return `<filter id="tint${i}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 .82 0"/></filter>`;
  }).join('') + `<filter id="shadow" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .02 0 0 0 0 .03 0 0 0 0 .04 0 0 0 .93 0"/></filter>`;
}

// recadre l'image sur sa forme (les PNG de DofusDB ont une large marge transparente)
async function cropped(m) {
  try {
    const bmp = await createImageBitmap(await (await fetch(img(m))).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const a = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (a[(y * c.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return { src: img(m), area: 0 };
    const w = x1 - x0 + 1, hh = y1 - y0 + 1;
    const out = document.createElement('canvas'); out.width = w; out.height = hh;
    out.getContext('2d').drawImage(bmp, x0, y0, w, hh, 0, 0, w, hh);
    return { src: out.toDataURL(), area: w * hh };
  } catch { return { src: img(m), area: -1 }; }
}

function pick4() {
  const used = new Set(), out = [];
  while (out.length < 4) {
    const m = pool[Math.floor(Math.random() * pool.length)];
    if (used.has(m.b)) continue;
    used.add(m.b); out.push(m);
  }
  return out;
}

async function start() {
  $('status').textContent = 'Mélange en cours…';
  let targets, crops;
  // on écarte les formes trop petites (moins de 22 px de côté une fois recadrées)
  for (let k = 0; k < 6; k++) {
    targets = pick4();
    crops = await Promise.all(targets.map(cropped));
    if (crops.every((c) => c.area < 0 || c.area > 22 * 22)) break;
  }
  state = { targets, found: [false, false, false, false], misses: 0, tries: [], done: false };
  const frame = $('frame'); frame.innerHTML = '';
  targets.forEach((m, i) => {
    const el = document.createElement('div');
    el.className = 'sil';
    el.style.transform = `translate(${MIXED[i][0]}%, ${MIXED[i][1]}%) rotate(${(Math.random() * 10 - 5).toFixed(1)}deg)`;
    const im = new Image(); im.src = crops[i].src; im.alt = ''; im.draggable = false;
    el.append(im); frame.append(el);
  });
  applyLook();
  const slots = $('slots'); slots.innerHTML = '';
  targets.forEach((m, i) => {
    const s = document.createElement('div');
    s.className = 'slot'; s.style.setProperty('--c', COLORS[i]);
    s.innerHTML = `<span class="ph">?</span><span class="nm">&nbsp;</span>`;
    slots.append(s);
  });
  $('tries').innerHTML = ''; $('hint').textContent = ''; $('win').innerHTML = '';
  $('q').disabled = false; $('q').value = ''; $('sugg').hidden = true;
  status();
}

function applyLook() {
  const black = $('frame').classList.contains('dark');
  [...$('frame').children].forEach((el, i) => { el.querySelector('img').style.filter = `url(#${black ? 'shadow' : 'tint' + i})`; });
  $('toggle').textContent = black ? 'Ombres colorées' : 'Ombres noires';
  $('frame').classList.toggle('tinted', !black);
}

function status() {
  const n = state.found.filter(Boolean).length;
  const left = Object.entries(HINT_AT).map(([k, v]) => v - state.misses).filter((v) => v > 0);
  $('status').textContent = `${n} / 4 trouvés, ${state.tries.length} essai${state.tries.length > 1 ? 's' : ''}` + (left.length && !state.done ? `, indice dans ${left[0]} erreur${left[0] > 1 ? 's' : ''}` : '');
}

function hints() {
  const rest = state.targets.map((m, i) => [m, i]).filter(([, i]) => !state.found[i]);
  const lines = [];
  if (state.misses >= HINT_AT.spread) {
    [...$('frame').children].forEach((el, i) => {
      el.style.transform = `translate(${SPREAD[i][0]}%, ${SPREAD[i][1]}%) scale(.78)`;
    });
    lines.push('Les silhouettes se sont écartées.');
  }
  if (rest.length && state.misses >= HINT_AT.family) {
    const [m, i] = rest[0];
    lines.push(`Famille de la silhouette ${['pourpre', 'turquoise', 'verte', 'mauve'][i]} : <b>${D.races[m.r]?.n ?? '?'}</b>`);
  }
  if (rest.length && state.misses >= HINT_AT.zone) {
    const [m, i] = rest[rest.length > 1 ? 1 : 0];
    lines.push(`Zone de la silhouette ${['pourpre', 'turquoise', 'verte', 'mauve'][i]} : <b>${D.areas[m.z] ?? '?'}</b>`);
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
  $('win').innerHTML = `<div class="sil-win"><h2>Les 4 sont démasqués</h2><div>en ${state.tries.length} essais, dont ${state.misses} erreur${state.misses > 1 ? 's' : ''}</div><button type="button" id="again">Nouveau mélange</button></div>`;
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
  makeFilters();
  D = await (await fetch('../data/monsters.json')).json();
  const ok = (m) => (m.k === 'normal' || m.k === 'boss') && !m.x && !EXCLUDED_SR.has(D.races[m.r]?.sr);
  const all = D.monsters.filter(ok);
  pool = all;
  entries = all.map((m) => ({ m, key: norm(m.n) }));
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
  $('toggle').onclick = () => { $('frame').classList.toggle('dark'); applyLook(); };
  start();
}
init();
