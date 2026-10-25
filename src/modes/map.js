// Mode Carte : retrouver une map à partir d'un extrait de son image.
// Propositions : clic sur la mini-carte, coordonnées [X, Y] ou nom de zone.
// Feedback : distance en nombre de maps (Manhattan).
import { h, clear, img, toast, isTouch } from '../ui/dom.js';
import { createAutocomplete } from '../ui/autocomplete.js';
import { createHints } from '../ui/hints.js';
import { createMinimap } from '../ui/minimap.js';
import { loadDataset } from '../core/cache.js';
import { todayKey, dayNumber, hash, rng, addDays } from '../core/daily.js';
import { loadGame, saveGame, recordWin, loadStats, currentStreak } from '../core/storage.js';
import { mapsDataset, indexMaps, pickMap, mapDistance, parseCoords } from '../data/maps.js';
import { shareResult } from '../ui/share.js';
import { STATUS_EMOJI, modeHead, winCard, yesterdayLine } from './engine.js';
import { celebrate } from '../ui/victory.js';

const NEAR = 5; // maps : en dessous, la proposition est "proche" (orange)

export const mapMode = {
  id: 'carte',
  label: 'Carte',
  emoji: '🗺️',
  icon: 'assets/game/ui/mode-carte.png',
  intro: 'Où se trouve cette map ? Clique sur la mini-carte, tape des coordonnées [X, Y] ou une zone : on t\'indique à combien de maps tu es.',
  help: 'Mode Carte : la distance est comptée en nombre de maps (|ΔX| + |ΔY|). Une zone correcte ne suffit pas : il faut les coordonnées exactes.',
};

export async function runMapMode(root, opts = {}) {
  clear(root);
  const loader = h('div.loader', h('div.loader-label', 'Chargement de la carte du monde…'), h('div.loader-bar', h('div.loader-fill')));
  root.append(loader);
  const date = todayKey();

  let data;
  try {
    data = await loadDataset(mapsDataset, (ratio, step) => {
      loader.querySelector('.loader-fill').style.width = `${Math.round(ratio * 100)}%`;
      loader.querySelector('.loader-label').textContent = `Chargement depuis DofusDB : ${step}… ${Math.round(ratio * 100)}%`;
    });
  } catch (e) {
    clear(root).append(h('div.panel.error', h('h3', 'Impossible de charger la carte'), h('p.muted', String(e.message || e)),
      h('button.btn', { onclick: () => runMapMode(root, opts) }, 'Réessayer')));
    return;
  }

  const index = indexMaps(data);
  const target = pickMap(data, index, 'carte', date);
  const subById = new Map(data.subareas.map((s) => [s.id, s]));
  const areaOf = (subId) => { const s = subById.get(subId); return s ? { id: s.a, n: data.areas[s.a]?.n } : null; };
  const game = loadGame('carte', date);
  const save = () => saveGame('carte', game);
  const r = rng(hash(`carte-visuel|${date}`));
  const origin = `${Math.round(25 + r() * 50)}% ${Math.round(25 + r() * 50)}%`;

  clear(root);
  root.append(modeHead(mapMode, date));

  // --- Extrait de la map mystère
  const picture = img(target.img['1'], 'Extrait de la map mystère');
  picture.style.transformOrigin = origin;
  const zoomLabel = h('span.map-zoom');
  const hints = createHints({ game, save }, [
    { key: 'region', at: 3, title: 'Région', render: () => h('p', data.areas[target.sub.a]?.n || '?') },
    { key: 'zone', at: 6, title: 'Sous-zone', render: () => h('p', target.sub.n) },
    { key: 'x', at: 9, title: 'Abscisse', render: () => h('p', `X = ${target.posX}`) },
  ]);

  // --- Saisie : mini-carte + texte
  const minimap = createMinimap({
    maps: data.maps,
    areaOf,
    onPick: (c) => guessXY(c),
  });
  const counter = h('div.counter');
  const entries = data.subareas.map((s) => ({ id: s.id, n: s.n, sub: data.areas[s.a]?.n || '' }));
  const ac = createAutocomplete({
    items: entries,
    placeholder: 'Coordonnées (ex. -2,5) ou nom de zone',
    shortPlaceholder: 'X,Y ou nom de zone',
    browse: false, // le champ sert aussi aux coordonnées : pas de liste au simple clic
    exclude: () => new Set(game.guesses.filter((g) => g.zone).map((g) => g.zone)),
    onSelect: (it) => guessZone(it.id),
    onFreeText: (text) => {
      const c = parseCoords(text);
      if (!c) { toast('Format attendu : X,Y (ex. -2,5) ou un nom de zone'); return false; }
      guessXY(c);
      return true;
    },
  });
  const result = h('div.result');
  const list = h('div.map-rows');
  const inputArea = h('div.map-area-input', h('div.panel.input-panel', ac.el, counter));

  root.append(
    // Ordinateur : extrait, indices, saisie et propositions à gauche, mini-carte à droite.
    // Mobile : la mini-carte passe juste après les indices, avant la saisie.
    h('div.map-layout',
      h('div.map-area-frame', h('div.map-frame', picture, zoomLabel)),
      h('div.map-area-hints', hints.el),
      h('div.map-area-mini', h('div.panel.minimap-panel', h('div.minimap-head', h('strong', 'Mini-carte'), h('span.muted', isTouch() ? 'Pince pour zoomer, touche une map pour proposer' : 'Molette pour zoomer, glisser pour te déplacer, clic pour proposer')), minimap.el)),
      inputArea,
      h('div.map-area-list', list,
        h('div.legend', h('span', h('i.sw.ok', '✓'), 'Bonne map'), h('span', h('i.sw.partial', '≈'), `À ${NEAR} maps ou moins / bonne zone`), h('span', h('i.sw.ko', '✕'), 'Loin')))),
    result,
    (() => { const y = pickMap(data, index, 'carte', addDays(date, -1)); return yesterdayLine('La map d\'hier se trouvait en', `[${y.posX}, ${y.posY}], ${y.sub.n}`); })());

  function status(g) {
    if (g.dist === 0 && !g.zone) return 'ok';
    if (g.dist <= NEAR || g.sameZone) return 'partial';
    return 'ko';
  }

  function guessZone(id) {
    const maps = index.bySub.get(id) || [];
    let best = 99;
    for (const [, x, y] of maps) best = Math.min(best, mapDistance({ posX: x, posY: y }, target));
    push({ zone: id, sameZone: id === target.sub.id, dist: best });
  }

  function guessXY(c) {
    if (game.won) return;
    if (game.guesses.some((g) => !g.zone && g.x === c.posX && g.y === c.posY)) { toast('Déjà proposé !'); return; }
    push({ x: c.posX, y: c.posY, dist: mapDistance(c, target) });
  }

  function push(g) {
    if (game.won) return;
    game.guesses.push(g);
    if (!g.zone && g.dist === 0) {
      game.won = true;
      recordWin('carte', date, game.guesses.length);
    }
    save();
    refresh();
    if (game.won) setTimeout(() => celebrate(mapMode, result), 500);
  }

  function refresh() {
    const n = game.guesses.length;
    root.classList.toggle('no-guess', !n);
    const scale = game.won ? 1 : Math.max(1, 3.2 - n * 0.3);
    picture.style.transform = `scale(${scale})`;
    zoomLabel.textContent = game.won ? 'Map complète' : `Zoom ×${scale.toFixed(1)}`;
    counter.textContent = n ? `${n} essai${n > 1 ? 's' : ''}` : 'La distance est comptée en nombre de maps (|ΔX| + |ΔY|)';
    hints.update(game);
    minimap.setMarks(game.guesses.filter((g) => !g.zone).map((g) => ({ posX: g.x, posY: g.y, status: status(g) })));
    minimap.disable(game.won);
    list.replaceChildren(...[...game.guesses].reverse().map((g) => {
      const st = status(g);
      const label = g.zone
        ? h('span', subById.get(g.zone)?.n || 'Zone', h('small', g.sameZone ? 'Bonne zone ! Trouve maintenant la map exacte.' : 'Distance depuis la map la plus proche de cette zone'))
        : h('span', `[${g.x}, ${g.y}]`, st === 'ok' ? h('small', 'Bonne map !') : null);
      const dist = g.dist === 0 ? (g.zone ? 'dans la zone' : '✓') : `${g.dist} map${g.dist > 1 ? 's' : ''}`;
      return h(`div.map-row.${st}`, label, h('span.dist', dist));
    }));
    ac.disable(game.won);
    inputArea.classList.toggle('done', game.won);
    clear(result);
    if (game.won) {
      result.append(winCard({
        cfg: mapMode, date, tries: n,
        reveal: h('div.reveal', img(target.img['0.5'], 'Map', 'reveal-map'),
          h('div', h('h3', `[${target.posX}, ${target.posY}]`), h('p', target.sub.n), h('p.muted', data.areas[target.sub.a]?.n || ''))),
        onShare: () => shareResult(buildShare(), 'Résultat copié !'),
      }));
    }
  }

  function buildShare() {
    const rows = game.guesses.map((g) => `${STATUS_EMOJI[status(g)]} ${g.dist === 0 && !g.zone ? '✓' : `${g.dist} map${g.dist > 1 ? 's' : ''}`}${g.zone ? ' (zone)' : ''}`);
    const shown = rows.length > 8 ? [...rows.slice(0, 7), '…', rows[rows.length - 1]] : rows;
    return [`Dofusle #${dayNumber(date)} — Carte ${mapMode.emoji}`,
      `Trouvée en ${game.guesses.length} essai${game.guesses.length > 1 ? 's' : ''} · série ${currentStreak(loadStats('carte'), date)} 🔥`,
      ...shown, location.href.split('#')[0] + '#carte'].join('\n');
  }

  refresh();
}
