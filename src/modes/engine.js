// Moteur commun des modes "à la Loldle" (Monstre, Sort, Objet, Cri) :
// chargement des données, tirage du jour, saisie, grille de
// feedback, victoire, partage et statistiques. Chaque mode fournit sa config.
import { h, clear, img, formatDuration, toast, isTouch } from '../ui/dom.js';
import { createAutocomplete } from '../ui/autocomplete.js';
import { loadDataset } from '../core/cache.js';
import { todayKey, dayNumber, pickDaily, msUntilNextDaily, addDays } from '../core/daily.js';
import { loadGame, saveGame, recordWin, loadStats, currentStreak } from '../core/storage.js';
import { winCard, celebrate } from '../ui/victory.js';

export { winCard };
import { nextMode, modeInfo, harvestedToday, MODE_ORDER, dofusImg } from '../core/modes.js';
import { ELEMENTS } from '../data/elements.js';
import { shareResult } from '../ui/share.js';
import { showStats } from '../ui/stats.js';

export const STATUS_EMOJI = { ok: '🟩', partial: '🟧', ko: '🟥' };
const ELEMENT_EXTRA = { soin: { label: 'Soin', icon: 'assets/game/elements/soin.png' } };

/** Rendu par défaut d'une valeur de cellule. */
export function cellContent(cell) {
  if (Array.isArray(cell.value)) {
    if (!cell.value.length) return h('span.cell-text.muted', 'Aucun');
    return h('span.cell-els', cell.value.map((e) => {
      const el = ELEMENTS[e] || ELEMENT_EXTRA[e];
      return el ? img(el.icon, el.label, 'el-icon') : h('span', e);
    }), cell.value.length === 1 ? h('span.cell-sr', (ELEMENTS[cell.value[0]] || ELEMENT_EXTRA[cell.value[0]])?.label) : null);
  }
  return h('span.cell-stack',
    cell.icon ? img(cell.icon, '', 'cell-icon') : null,
    cell.swatches?.length ? h('span.swatches', cell.swatches.map((hex) => h('i.swatch', { style: { background: hex } }))) : null,
    h('span.cell-text', cell.value),
    cell.sub ? h('span.cell-sub', cell.sub) : null);
}

// Symbole de statut : l'information ne passe pas que par la couleur (daltonisme)
const STATUS_MARK = { ok: '✓', partial: '≈', ko: '✕' };

export function renderCell(cell, delay = 0) {
  const label = { ok: 'correct', partial: 'partiellement correct', ko: 'incorrect' }[cell.status];
  const dir = cell.arrow === 'up' ? 'plus haut' : 'plus bas';
  const arrowLabel = cell.arrow ? `${cell.far ? 'beaucoup ' : ''}${dir}` : '';
  return h(`div.cell.${cell.status}`, { style: { animationDelay: `${delay}ms` }, title: label + (arrowLabel ? `, ${arrowLabel}` : ''), 'aria-label': label + (arrowLabel ? `, ${arrowLabel}` : '') },
    h('span.cell-mark', { 'aria-hidden': 'true' }, STATUS_MARK[cell.status]),
    h('span.cell-main',
      cellContent(cell),
      cell.arrow ? h(`span.cell-arrow.${cell.arrow}${cell.far ? '.far' : ''}`, { 'aria-hidden': 'true' }) : null));
}

/** Ligne « réponse d'hier », commune à tous les modes. */
export function yesterdayLine(label, value) {
  return h('p.yesterday', `${label} `, h('strong', value), '.');
}

/** Texte de la série en cours d'un mode. */
export function streakText(id, date) {
  const n = currentStreak(loadStats(id), date);
  return n ? `${n} jour${n > 1 ? 's' : ''} de suite` : 'Pas encore de série';
}

/** En-tête commun (titre du mode, numéro du défi du jour, série en cours). */
export function modeHead(cfg, date) {
  const n = currentStreak(loadStats(cfg.id), date);
  return h('div.mode-head',
    h('div.mode-title', img(cfg.icon, '', 'mode-icon'), h('div',
      h('h2', cfg.label),
      h('p.mode-intro', cfg.intro))),
    h('div.mode-badges',
      h('span.day-badge', `Défi du jour n° ${dayNumber(date)}`),
      h('span.streak-badge', { class: n ? 'on' : undefined, 'data-mode': cfg.id, title: 'Défis du jour réussis d\'affilée dans ce mode' },
        h('span.streak-flame', { 'aria-hidden': 'true' }), h('span.streak-text', streakText(cfg.id, date)))));
}

/**
 * @param {HTMLElement} root
 * @param {object} cfg configuration du mode
 * @param {object} opts
 */
export async function runGuessMode(root, cfg, opts = {}) {
  clear(root);
  const loader = h('div.loader', h('div.loader-label', 'Chargement des données DofusDB…'), h('div.loader-bar', h('div.loader-fill')));
  root.append(loader);
  const fill = loader.querySelector('.loader-fill');
  const label = loader.querySelector('.loader-label');
  const onProgress = (ratio, step) => {
    fill.style.width = `${Math.round(ratio * 100)}%`;
    label.textContent = `Chargement depuis DofusDB : ${step}… ${Math.round(ratio * 100)}%`;
  };

  let data;
  try {
    data = cfg.load ? await cfg.load(onProgress) : await loadDataset(cfg.dataset, onProgress);
  } catch (e) {
    clear(root).append(h('div.panel.error',
      h('h3', 'Impossible de charger les données'),
      h('p', 'DofusDB ne répond pas pour le moment. Vérifie ta connexion puis réessaie.'),
      h('p.muted', String(e.message || e)),
      h('button.btn', { onclick: () => runGuessMode(root, cfg, opts) }, 'Réessayer')));
    return;
  }

  const { entries, pool } = cfg.prepare(data);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const date = todayKey();
  const pick = (d) => (cfg.pickDaily ? cfg.pickDaily(pool, d) : pickDaily(pool, cfg.salt, d));
  const target = pick(date);
  const isWin = (entry) => (cfg.isWin ? cfg.isWin(entry, target, data) : entry.id === target.id);

  const game = loadGame(cfg.id, date);
  // Données mises à jour : on ignore les propositions devenues invalides
  game.guesses = game.guesses.filter((id) => byId.has(id));
  const save = () => saveGame(cfg.id, game);

  // Données calculées à la demande (ex. couleur des monstres) pour la cible et les essais déjà joués
  if (cfg.ensure) {
    label.textContent = 'Préparation du défi…';
    await cfg.ensure([target, ...game.guesses.map((id) => byId.get(id))]);
  }

  clear(root);
  const ctx = { cfg, data, target, game, byId, save };
  root.append(modeHead(cfg, date));

  // --- Indice / visuel propre au mode
  const clue = cfg.clue ? cfg.clue(ctx) : null;
  if (clue) root.append(clue.el);

  // --- Saisie
  const counter = h('div.counter');
  const ac = createAutocomplete({
    // Monstres retirés du jeu : absents des suggestions, sauf s'ils sont la réponse d'un ancien tirage
    items: entries.filter((e) => !e.hidden || isWin(e)),
    placeholder: cfg.placeholder,
    exclude: () => new Set(game.guesses),
    onSelect: (it) => guess(it.id),
  });
  root.append(h('div.panel.input-panel', ac.el, counter));

  // --- Grille
  const grid = h('div.grid', { role: 'table', 'aria-label': 'Propositions' });
  const headRow = h('div.grid-row.grid-head', { role: 'row' },
    h('div.cell.head.name-col', cfg.nameLabel || 'Nom'),
    // En-têtes cliquables : l'aide s'affiche aussi au toucher (pas de survol sur mobile)
    cfg.columns.map((c) => (c.help
      ? h('button.cell.head.has-help', { type: 'button', role: 'columnheader', title: c.help, 'aria-label': `${c.label} : ${c.help}`, onclick: () => toast(`${c.label} : ${c.help}`, 4200) }, c.label)
      : h('div.cell.head', { role: 'columnheader' }, c.label))));
  grid.style.setProperty('--cols', cfg.columns.length);
  const rows = h('div.grid-rows');
  grid.append(headRow, rows);
  const gridWrap = h('div.grid-wrap', grid);
  // Indice de défilement horizontal (mobile) : dégradé + flèche tant qu'il reste des colonnes à droite
  const gridShell = h('div.grid-shell', gridWrap);
  const updateScrollHint = () => {
    const can = gridWrap.scrollWidth > gridWrap.clientWidth + 4;
    gridShell.classList.toggle('can-scroll', can);
    gridShell.classList.toggle('at-end', !can || gridWrap.scrollLeft + gridWrap.clientWidth >= gridWrap.scrollWidth - 4);
  };
  gridWrap.addEventListener('scroll', updateScrollHint, { passive: true });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(updateScrollHint).observe(gridWrap);
  const result = h('div.result');
  const yesterday = pick(addDays(date, -1));
  root.append(result, gridShell, legend(cfg),
    yesterday ? yesterdayLine(cfg.yesterdayLabel || 'La réponse d\'hier était', yesterday.n) : null);

  function rowFor(id, animate) {
    const e = byId.get(id);
    const cells = cfg.compare(e.ref, target.ref, data);
    const won = isWin(e);
    return h(`div.grid-row${won ? '.win' : ''}${animate ? '.new' : ''}`, { role: 'row' },
      h(`div.cell.name-col${won ? '.ok' : ''}${cfg.rowImages === false ? '.no-img' : ''}`,
        cfg.rowImages !== false && e.img ? img(e.img, '', 'row-img') : null, h('span.row-name', e.n)),
      cells.map((c, i) => renderCell(c, animate ? (i + 1) * 140 : 0)));
  }

  function refresh(animateFirst = false) {
    clear(rows);
    [...game.guesses].reverse().forEach((id, i) => rows.append(rowFor(id, animateFirst && i === 0)));
    gridWrap.classList.toggle('empty', !game.guesses.length);
    // Grille et légende n'apparaissent qu'à la première proposition
    root.classList.toggle('no-guess', !game.guesses.length);
    requestAnimationFrame(updateScrollHint);
    counter.textContent = game.guesses.length ? `${game.guesses.length} essai${game.guesses.length > 1 ? 's' : ''}` : 'Tape un nom pour commencer';
    clue?.update(game);
    ac.disable(game.won);
    renderResult();
  }

  let busy = false;
  async function guess(id) {
    if (busy || game.won || game.guesses.includes(id)) return;
    if (cfg.ensure) {
      busy = true; ac.disable(true);
      try { await cfg.ensure([byId.get(id)]); } finally { busy = false; ac.disable(false); }
    }
    game.guesses.push(id);
    if (isWin(byId.get(id))) {
      game.won = true;
      recordWin(cfg.id, date, game.guesses.length);
    }
    save();
    refresh(true);
    // Mobile : la nouvelle ligne reste visible une fois le clavier fermé
    if (!game.won && isTouch()) setTimeout(() => rows.firstElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 250);
    // La ligne gagnante se dévoile et s'illumine, puis on descend jusqu'à la section de victoire
    if (game.won) setTimeout(() => celebrate(cfg, result), 1900);
  }

  function renderResult() {
    clear(result);
    if (!game.won) return;
    result.append(winCard({
      cfg, date,
      tries: game.guesses.length,
      reveal: cfg.reveal(target, data, game.guesses.map((id) => byId.get(id))),
      onShare: () => shareResult(buildShare(), 'Résultat copié !'),
    }));
  }

  function buildShare() {
    const lines = game.guesses.map((id) => {
      const e = byId.get(id);
      const cells = cfg.compare(e.ref, target.ref, data);
      return (isWin(e) ? '🟩' : '🟥') + cells.map((c) => STATUS_EMOJI[c.status]).join('');
    });
    const shown = lines.length > 8 ? [...lines.slice(0, 7), `… +${lines.length - 8}`, lines[lines.length - 1]] : lines;
    return [
      `Dofusle #${dayNumber(date)} — ${cfg.label} ${cfg.emoji}`,
      `Trouvé en ${game.guesses.length} essai${game.guesses.length > 1 ? 's' : ''} · série ${currentStreak(loadStats(cfg.id), date)} 🔥`,
      ...shown,
      location.href.split('#')[0] + `#${cfg.id}`,
    ].join('\n');
  }

  refresh();
  if (!game.won && !isTouch()) ac.focus();
}

function legend(cfg) {
  // Libellés courts ; le détail de « proche » reste au survol et dans l'aide de chaque colonne
  return h('div.legend',
    h('span', h('i.sw.ok', '✓'), 'Correct'),
    cfg.noPartial ? null : h('span', { title: cfg.partialHelp || '' }, h('i.sw.partial', '≈'), 'Proche'),
    h('span', h('i.sw.ko', '✕'), 'Faux'),
    cfg.noPartial ? null : h('span', h('i.legend-arrow'), 'Plus haut / plus bas'));
}
