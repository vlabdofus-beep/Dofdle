// Mode Carte : retrouver une map à partir d'un extrait de son image.
// Propositions : coordonnées [X, Y] ou nom de zone. Feedback : distance en
// nombre de maps (Manhattan) + direction.
import { h, clear, img, toast, formatDuration } from '../ui/dom.js';
import { createAutocomplete } from '../ui/autocomplete.js';
import { loadDataset } from '../core/cache.js';
import { createApi } from '../core/api.js';
import { todayKey, dayNumber, msUntilNextDaily, hash, rng } from '../core/daily.js';
import { loadGame, saveGame, recordWin, recordEndlessWin, loadStats, currentStreak } from '../core/storage.js';
import { mapsDataset, pickMap, fetchPositions, mapDistance, direction, parseCoords, isWorldMap } from '../data/maps.js';
import { shareResult } from '../ui/share.js';
import { showStats } from '../ui/stats.js';
import { STATUS_EMOJI } from './engine.js';

const NEAR = 5; // maps : en dessous, la proposition est "proche" (orange)

export const mapMode = {
  id: 'carte',
  label: 'Carte',
  emoji: '🗺️',
  icon: 'assets/game/ui/mode-carte.png',
  intro: 'Où se trouve cette map ? Propose des coordonnées [X, Y] ou une zone : on t\'indique à combien de maps tu es.',
  help: 'Mode Carte : la distance est comptée en nombre de maps (|ΔX| + |ΔY|). Une zone correcte ne suffit pas : il faut les coordonnées exactes.',
};

const api = createApi();

export async function runMapMode(root, opts = {}) {
  clear(root);
  const loader = h('div.loader', h('div.loader-label', 'Chargement des zones…'), h('div.loader-bar', h('div.loader-fill')));
  root.append(loader);
  const endless = !!opts.endless;
  const date = todayKey();

  let data, target;
  try {
    data = await loadDataset(mapsDataset, (ratio, step) => {
      loader.querySelector('.loader-fill').style.width = `${Math.round(ratio * 90)}%`;
      loader.querySelector('.loader-label').textContent = `Chargement depuis DofusDB : ${step}… ${Math.round(ratio * 100)}%`;
    });
    loader.querySelector('.loader-label').textContent = 'Choix de la map…';
    target = await pickMap(api, data, endless ? `carte-${Math.random()}` : 'carte', date);
  } catch (e) {
    clear(root).append(h('div.panel.error', h('h3', 'Impossible de charger la carte'), h('p.muted', String(e.message || e)),
      h('button.btn', { onclick: () => runMapMode(root, opts) }, 'Réessayer')));
    return;
  }

  const subById = new Map(data.subareas.map((s) => [s.id, s]));
  const game = endless ? { date, guesses: [], won: false } : loadGame('carte', date);
  const r = rng(endless ? Math.random() * 1e9 : hash(`carte-visuel|${date}`));
  const origin = `${Math.round(25 + r() * 50)}% ${Math.round(25 + r() * 50)}%`;

  clear(root);
  root.append(h('div.mode-head',
    h('div.mode-title', img(mapMode.icon, '', 'mode-icon'), h('div', h('h2', 'Carte'), h('p.mode-intro', mapMode.intro))),
    h('div.mode-switch',
      h('button', { class: !endless ? 'active' : undefined, onclick: () => runMapMode(root, { endless: false }) }, `Défi du jour #${dayNumber(date)}`),
      h('button', { class: endless ? 'active' : undefined, onclick: () => runMapMode(root, { endless: true }) }, 'Illimité'))));

  const picture = img(target.img['1'] || target.img['0.5'], 'Extrait de la map mystère');
  picture.style.transformOrigin = origin;
  const zoomLabel = h('span.map-zoom');
  const chips = h('div.chips', { style: { marginTop: '10px', justifyContent: 'center' } });
  root.append(h('div.map-frame', picture, zoomLabel), chips);

  const counter = h('div.counter');
  const entries = data.subareas.map((s) => ({ id: s.id, n: s.n, sub: data.areas[s.a]?.n || '' }));
  const ac = createAutocomplete({
    items: entries,
    placeholder: 'Coordonnées (ex. -2,5) ou nom de zone',
    exclude: () => new Set(game.guesses.filter((g) => g.zone).map((g) => g.zone)),
    onSelect: (it) => guessZone(it.id),
    onFreeText: (text) => {
      const c = parseCoords(text);
      if (!c) { toast('Format attendu : X,Y (ex. -2,5) ou un nom de zone'); return false; }
      guessXY(c);
      return true;
    },
  });
  root.append(h('div.panel.input-panel', ac.el, counter));
  const result = h('div.result');
  const list = h('div.map-rows');
  root.append(result, list,
    h('div.legend', h('span', h('i.sw.ok'), 'Bonne map'), h('span', h('i.sw.partial'), `À ${NEAR} maps ou moins / bonne zone`), h('span', h('i.sw.ko'), 'Loin')));

  function status(g) {
    if (g.dist === 0 && !g.zone) return 'ok';
    if (g.dist <= NEAR || g.sameZone) return 'partial';
    return 'ko';
  }

  async function guessZone(id) {
    const sub = subById.get(id);
    ac.disable(true);
    try {
      const pos = (await fetchPositions(api, sub.m.slice(0, 400))).filter(isWorldMap);
      let best = null;
      for (const p of pos) { const d = mapDistance(p, target); if (!best || d < best.d) best = { d, p }; }
      push({ zone: id, sameZone: id === target.sub.id, dist: best ? best.d : 99, dir: best ? direction(best.p, target) : '?' });
    } catch {
      toast('DofusDB ne répond pas, réessaie.');
    } finally { ac.disable(game.won); }
  }

  function guessXY(c) {
    if (game.guesses.some((g) => !g.zone && g.x === c.posX && g.y === c.posY)) { toast('Déjà proposé !'); return; }
    push({ x: c.posX, y: c.posY, dist: mapDistance(c, target), dir: direction(c, target) });
  }

  function push(g) {
    if (game.won) return;
    game.guesses.push(g);
    if (!g.zone && g.dist === 0) {
      game.won = true;
      if (endless) recordEndlessWin('carte'); else recordWin('carte', date, game.guesses.length);
    }
    if (!endless) saveGame('carte', game);
    refresh();
  }

  let timer;
  function refresh() {
    const n = game.guesses.length;
    const scale = game.won ? 1 : Math.max(1, 3.2 - n * 0.3);
    picture.style.transform = `scale(${scale})`;
    zoomLabel.textContent = game.won ? 'Map complète' : `Zoom ×${scale.toFixed(1)}`;
    counter.textContent = n ? `${n} essai${n > 1 ? 's' : ''}` : 'Astuce : la distance est en nombre de maps (|ΔX| + |ΔY|)';
    const hints = [
      { at: 3, label: 'Région', value: () => data.areas[target.sub.a]?.n },
      { at: 6, label: 'Sous-zone', value: () => target.sub.n },
      { at: 9, label: 'Abscisse', value: () => `X = ${target.posX}` },
    ];
    chips.replaceChildren(...hints.map((hi) => {
      const left = hi.at - n;
      return left > 0 && !game.won
        ? h('span.chip.locked', `${hi.label} — dans ${left} essai${left > 1 ? 's' : ''}`)
        : h('span.chip', `${hi.label} : ${hi.value()}`);
    }));
    list.replaceChildren(...[...game.guesses].reverse().map((g) => {
      const st = status(g);
      const label = g.zone
        ? h('span', subById.get(g.zone)?.n || 'Zone', h('small', g.sameZone ? 'Bonne zone ! Trouve maintenant la map exacte.' : `Map la plus proche de cette zone`))
        : h('span', `[${g.x}, ${g.y}]`, st === 'ok' ? h('small', 'Bonne map !') : null);
      return h(`div.map-row.${st}`, label, h('span.dist', g.dist === 0 ? (g.zone ? 'dans la zone' : '✓') : `${g.dist} map${g.dist > 1 ? 's' : ''}`), h('span.dir', { 'aria-label': 'direction' }, g.dist === 0 ? '' : g.dir));
    }));
    ac.disable(game.won);
    renderResult();
  }

  function renderResult() {
    clear(result); clearInterval(timer);
    if (!game.won) return;
    const n = game.guesses.length;
    const countdown = h('span.countdown');
    const tick = () => { countdown.textContent = formatDuration(msUntilNextDaily()); };
    tick(); timer = setInterval(tick, 1000);
    result.append(h('div.panel.win-card',
      h('div.win-title', '🎉 ', endless ? 'Bien joué !' : 'Map du jour trouvée !'),
      h('div.reveal', img(target.img['0.5'] || target.img['1'], 'Map', 'reveal-map'),
        h('div', h('h3', `[${target.posX}, ${target.posY}]`), h('p', target.sub.n), h('p.muted', data.areas[target.sub.a]?.n || ''))),
      h('p.win-tries', `Trouvée en ${n} essai${n > 1 ? 's' : ''}`, !endless ? ` · série actuelle : ${currentStreak(loadStats('carte'), date)} 🔥` : ''),
      h('div.win-actions',
        !endless ? h('button.btn.primary', { onclick: () => shareResult(buildShare(), 'Résultat copié !') }, 'Partager') : null,
        h('button.btn', { onclick: () => runMapMode(root, { endless: true }) }, endless ? 'Nouvelle partie' : 'Jouer en illimité'),
        !endless ? h('button.btn', { onclick: () => showStats(mapMode) }, 'Statistiques') : null),
      !endless ? h('p.next-daily', 'Prochain défi dans ', countdown) : null));
  }

  function buildShare() {
    const rows = game.guesses.map((g) => `${STATUS_EMOJI[status(g)]} ${g.dist === 0 && !g.zone ? '✓' : `${g.dist} ${g.dir}`}${g.zone ? ' (zone)' : ''}`);
    const shown = rows.length > 8 ? [...rows.slice(0, 7), '…', rows[rows.length - 1]] : rows;
    return [`Dofusle #${dayNumber(date)} — Carte ${mapMode.emoji}`,
      `Trouvée en ${game.guesses.length} essai${game.guesses.length > 1 ? 's' : ''} · série ${currentStreak(loadStats('carte'), date)} 🔥`,
      ...shown, location.href.split('#')[0] + '#carte'].join('\n');
  }

  refresh();
  if (!game.won) ac.focus();
}
