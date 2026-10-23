// Mode Sémantix : retrouver le mot secret grâce à la proximité sémantique
// (à la Cémantix), avec un modèle entraîné sur les textes du jeu Dofus.
// Données précalculées par tools/semantix : vocabulaire + similarités de chaque mot secret.
import { h, clear, toast } from '../ui/dom.js';
import { createHints } from '../ui/hints.js';
import { todayKey, dayNumber, hash } from '../core/daily.js';
import { loadGame, saveGame, recordWin, recordEndlessWin, loadStats, currentStreak } from '../core/storage.js';
import { shareResult } from '../ui/share.js';
import { modeHead, winCard } from './engine.js';

const BASE = 'data/semantix';
const TOP = 1000;

export const semantixMode = {
  id: 'semantix',
  label: 'Sémantix',
  emoji: '🧠',
  icon: 'assets/game/ui/mode-semantix.png',
  intro: 'Trouve le mot secret. Chaque mot proposé reçoit une température selon sa proximité de sens dans l\'univers de Dofus.',
  help: 'Sémantix : la proximité est apprise sur les textes du jeu (quêtes, dialogues, objets…). Les 1 000 mots les plus proches reçoivent un rang.',
};

let cache = null;
async function loadBase() {
  cache ||= Promise.all([
    fetch(`${BASE}/pool.json`).then((r) => { if (!r.ok) throw new Error('Données Sémantix introuvables'); return r.json(); }),
    fetch(`${BASE}/vocab.json`).then((r) => r.json()),
  ]).then(([pool, vocab]) => {
    const index = new Map(vocab.map((w, i) => [w, i]));
    const loose = new Map(); // sans accents ni tirets -> mots possibles
    for (const w of vocab) {
      const k = looseKey(w);
      if (!loose.has(k)) loose.set(k, []);
      loose.get(k).push(w);
    }
    return { pool, vocab, index, loose };
  });
  cache.catch(() => { cache = null; });
  return cache;
}

const clean = (s) => s.toLowerCase().trim().replace(/[’`]/g, '\'').replace(/\s+/g, ' ');
const looseKey = (s) => clean(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[-\s']/g, '');

/** Mot secret du jour : chaque cycle passe par tout le vocabulaire secret, sans répétition. */
function dailyId(pool, date) {
  const n = pool.length;
  const day = dayNumber(date);
  const cycle = Math.floor(day / n);
  const order = [...pool].sort((a, b) => hash(`semantix|${cycle}|${a}`) - hash(`semantix|${cycle}|${b}`));
  return order[((day % n) + n) % n];
}

const emojiFor = (rank, temp) => {
  if (rank === 0) return '🥳';
  if (rank && rank <= 10) return '😱';
  if (rank && rank <= 100) return '🔥';
  if (rank) return '🥵';
  if (temp >= 15) return '😎';
  if (temp >= 0) return '🥶';
  return '🧊';
};

export async function runSemantixMode(root, opts = {}) {
  clear(root);
  const endless = !!opts.endless;
  const date = todayKey();
  root.append(h('div.loader', h('div.loader-label', 'Chargement du dictionnaire…'), h('div.loader-bar', h('div.loader-fill', { style: { width: '50%' } }))));

  let base, sims, secretIdx, fileId;
  try {
    base = await loadBase();
    fileId = endless ? base.pool.pool[Math.floor(Math.random() * base.pool.pool.length)] : dailyId(base.pool.pool, date);
    const buf = await fetch(`${BASE}/${fileId}.bin`).then((r) => { if (!r.ok) throw new Error('Mot du jour introuvable'); return r.arrayBuffer(); });
    sims = new Int16Array(buf);
    if (sims.length !== base.vocab.length) throw new Error('Données Sémantix incohérentes (vocabulaire)');
  } catch (e) {
    clear(root).append(h('div.panel.error', h('h3', 'Impossible de charger Sémantix'), h('p.muted', String(e.message || e)),
      h('button.btn', { onclick: () => runSemantixMode(root, opts) }, 'Réessayer')));
    return;
  }

  // Classement : rang 0 = le mot secret, puis 1..999
  const sorted = Array.from(sims.keys()).sort((a, b) => sims[b] - sims[a]);
  secretIdx = sorted[0];
  const rankOf = new Map(sorted.slice(0, TOP).map((i, r) => [i, r]));
  const secret = base.vocab[secretIdx];
  const temp = (i) => sims[i] / 100;

  const gameKey = semantixMode.id;
  const game = endless ? { date, guesses: [], won: false, hints: [] } : loadGame(gameKey, date);
  const save = () => { if (!endless) saveGame(gameKey, game); };
  const rerun = (o) => runSemantixMode(root, o);

  clear(root);
  root.append(modeHead(semantixMode, date, endless, rerun));

  const hintWord = (rank) => base.vocab[sorted[rank]];
  const hints = createHints({ game, save }, [
    { key: 'proche', at: 15, title: 'Un mot tiède', render: () => h('p', `« ${hintWord(500)} » (rang 500)`) },
    { key: 'chaud', at: 30, title: 'Un mot chaud', render: () => h('p', `« ${hintWord(50)} » (rang 50)`) },
    { key: 'lettre', at: 50, title: 'Forme du mot', render: () => h('p', `${secret.length} lettres, commence par « ${secret[0].toUpperCase()} »`) },
  ], { className: 'compact' });

  const input = h('input.guess-input.semantix-input', {
    type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'send',
    placeholder: 'Un mot (ex. bouftou, épée, kamas…)', 'aria-label': 'Ton mot',
  });
  const submit = h('button.btn.primary', { type: 'submit' }, 'Envoyer');
  const form = h('form.number-form', input, submit);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const word = resolve(input.value);
    if (!word) return;
    input.value = '';
    if (game.guesses.includes(word)) { toast(`« ${word} » est déjà proposé`); highlight(word); return; }
    game.guesses.push(word);
    if (base.index.get(word) === secretIdx) {
      game.won = true;
      if (endless) recordEndlessWin(gameKey); else recordWin(gameKey, date, game.guesses.length);
    }
    save();
    refresh(word);
    if (game.won) setTimeout(() => result.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
  });

  function resolve(raw) {
    const w = clean(raw);
    if (!w) return null;
    if (/\s/.test(w)) { toast('Un seul mot à la fois'); return null; }
    if (base.index.has(w)) return w;
    const cands = base.loose.get(looseKey(w)) || [];
    if (cands.length === 1) return cands[0];
    if (cands.length > 1) { toast(`Précise les accents : ${cands.slice(0, 3).join(', ')}`); return null; }
    toast(`Je ne connais pas « ${w} »`);
    return null;
  }

  const counter = h('div.counter');
  const last = h('div.sx-last');
  const table = h('div.sx-table');
  const result = h('div.result');
  root.append(
    h('div.panel.clue.number-clue', h('div.clue-meta',
      h('p.muted', 'Propose des mots : plus ils sont proches du mot secret par le sens (dans l\'univers de Dofus), plus la température monte. Les 1 000 mots les plus proches ont un rang.'),
      hints.el)),
    h('div.panel.input-panel', form, counter),
    result, last, table,
    h('div.legend.sx-legend', h('span', '🧊 < 0 °C'), h('span', '🥶 froid'), h('span', '😎 tiède'), h('span', '🥵 top 1000'), h('span', '🔥 top 100'), h('span', '😱 top 10')));

  function row(word, isLast = false) {
    const i = base.index.get(word);
    const r = rankOf.get(i);
    const t = temp(i);
    const pct = r === undefined ? 0 : ((TOP - r) / TOP) * 100;
    return h(`div.sx-row${isLast ? '.last' : ''}${r === 0 ? '.found' : ''}`, { 'data-word': word },
      h('span.sx-n', String(game.guesses.indexOf(word) + 1)),
      h('span.sx-word', word),
      h('span.sx-temp', `${t.toFixed(2).replace('.', ',')} °C`),
      h('span.sx-emoji', emojiFor(r, t)),
      h('span.sx-rank', r === undefined ? '' : r === 0 ? 'Trouvé !' : `${TOP - r} ‰`),
      h('span.sx-bar', h('i', { style: { width: `${pct}%` } })));
  }

  function highlight(word) {
    const el = table.querySelector(`[data-word="${CSS.escape(word)}"]`);
    if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
  }

  function refresh(lastWord) {
    const n = game.guesses.length;
    counter.textContent = n ? `${n} essai${n > 1 ? 's' : ''}` : 'Astuce : commence large (« monstre », « arme », « magie »…) puis affine.';
    hints.update(game);
    input.disabled = submit.disabled = game.won;
    const lw = lastWord || game.guesses[n - 1];
    last.replaceChildren(...(lw && !game.won ? [row(lw, true)] : []));
    const byTemp = [...game.guesses].sort((a, b) => sims[base.index.get(b)] - sims[base.index.get(a)]);
    table.replaceChildren(
      ...(n ? [h('div.sx-head', h('span', '#'), h('span', 'Mot'), h('span', '°C'), h('span', ''), h('span', '‰'), h('span', ''))] : []),
      ...byTemp.map((w) => row(w)));
    clear(result);
    if (game.won) {
      const top = sorted.slice(1, 31).map((i) => base.vocab[i]);
      result.append(winCard({
        cfg: semantixMode, endless, date, tries: n,
        reveal: h('div.reveal.number-reveal',
          h('div.number-answer', secret),
          h('div', h('p', 'Les mots les plus proches :'), h('p.small.muted.sx-top', top.join(', ')))),
        onShare: () => shareResult(buildShare(), 'Résultat copié !'),
        onEndless: () => rerun({ endless: true }),
      }));
    } else if (!n) input.focus();
  }

  function buildShare() {
    const counts = {};
    for (const w of game.guesses) {
      const i = base.index.get(w);
      const e = emojiFor(rankOf.get(i), temp(i));
      counts[e] = (counts[e] || 0) + 1;
    }
    const line = ['🥳', '😱', '🔥', '🥵', '😎', '🥶', '🧊'].filter((e) => counts[e]).map((e) => `${e} ${counts[e]}`).join(' · ');
    return [`Dofusle #${dayNumber(date)} — Sémantix ${semantixMode.emoji}`,
      `Trouvé en ${game.guesses.length} essai${game.guesses.length > 1 ? 's' : ''} · série ${currentStreak(loadStats(gameKey), date)} 🔥`,
      line, location.href.split('#')[0] + `#${gameKey}`].join('\n');
  }

  refresh();
}
