// Mode Juste prix : une question chiffrée improbable sur Dofus, réponse exacte à trouver.
// Feedback : plus / moins, orange si on est à 10 % près.
import { h, clear, toast } from '../ui/dom.js';
import { createHints } from '../ui/hints.js';
import { createApi } from '../core/api.js';
import { todayKey, dayNumber, hash, rng } from '../core/daily.js';
import { loadGame, saveGame, recordWin, loadStats, currentStreak } from '../core/storage.js';
import { buildQuestion, THEMES, formatNumber } from '../data/chiffres.js';
import { shareResult } from '../ui/share.js';
import { STATUS_EMOJI, modeHead, winCard } from './engine.js';

const QUESTION_KEY = 'dofusle:v1:chiffre-question';
const QUESTION_VERSION = 2; // à incrémenter si les modèles changent la réponse d'un jour

export const chiffreMode = {
  id: 'juste-prix',
  label: 'Juste prix',
  emoji: '🔢',
  icon: 'assets/game/ui/mode-chiffre.png',
  intro: 'Une question chiffrée improbable sur le jeu. Trouve le nombre exact : on t\'indique si c\'est plus ou moins.',
  help: 'Mode Juste prix : chaque jour un thème différent (géographie, bestiaire, objets, artisanat, quêtes, succès, donjons…). Orange : tu es à 10 % près.',
};

/** Question du jour : calculée une fois via l'API puis mise en cache localement. */
async function dailyQuestion(date) {
  try {
    const cached = JSON.parse(localStorage.getItem(QUESTION_KEY) || 'null');
    if (cached && cached.date === date && cached.v === QUESTION_VERSION) return cached.q;
  } catch { /* stockage indisponible */ }
  const api = createApi({ concurrency: 4 });
  const q = await buildQuestion(api, { day: dayNumber(date), seed: hash(`chiffre|${date}`), hashFn: hash });
  try { localStorage.setItem(QUESTION_KEY, JSON.stringify({ date, v: QUESTION_VERSION, q })); } catch { /* idem */ }
  return q;
}

const statusOf = (v, answer) => {
  if (v === answer) return 'ok';
  return Math.abs(v - answer) <= Math.max(1, answer * 0.1) ? 'partial' : 'ko';
};

/** Fourchette déterministe autour de la réponse (la réponse n'est jamais au centre exact). */
function bracket(answer, seed) {
  const r = rng(seed);
  const lo = Math.max(0, Math.floor(answer * (0.45 + r() * 0.35)));
  const hi = Math.max(lo + 2, Math.ceil(answer * (1.25 + r() * 0.5)));
  return [Math.min(lo, answer - 1 < 0 ? 0 : answer - 1), Math.max(hi, answer + 1)];
}

export async function runChiffreMode(root, opts = {}) {
  clear(root);
  const date = todayKey();
  const loader = h('div.loader', h('div.loader-label', 'Préparation de la question…'), h('div.loader-bar', h('div.loader-fill', { style: { width: '60%' } })));
  root.append(loader);

  let question;
  try {
    question = await dailyQuestion(date);
  } catch (e) {
    clear(root).append(h('div.panel.error', h('h3', 'Impossible de préparer la question'), h('p.muted', String(e.message || e)),
      h('button.btn', { onclick: () => runChiffreMode(root, opts) }, 'Réessayer')));
    return;
  }

  const { answer } = question;
  const theme = THEMES[question.theme] || { label: 'Divers', emoji: '🔢' };
  const game = loadGame(chiffreMode.id, date);
  const save = () => saveGame(chiffreMode.id, game);
  const [lo, hi] = bracket(answer, hash(`chiffre-fourchette|${date}`));
  const digits = String(answer).length;

  clear(root);
  root.append(modeHead(chiffreMode, date));

  const hints = createHints({ game, save }, [
    { key: 'fourchette', at: 4, title: 'Fourchette', render: () => h('p', `Entre ${formatNumber(lo)} et ${formatNumber(hi)}`) },
    { key: 'chiffres', at: 8, title: 'Forme du nombre', render: () => h('p', `${digits} chiffre${digits > 1 ? 's' : ''}, commence par ${String(answer)[0]}`) },
  ], { className: 'compact' });

  const input = h('input.guess-input.number-input', {
    type: 'text', inputmode: 'numeric', autocomplete: 'off', enterkeyhint: 'send',
    placeholder: 'Ta réponse (un nombre entier)', 'aria-label': 'Ta réponse',
  });
  const submit = h('button.btn.primary', { type: 'submit' }, 'Proposer');
  const form = h('form.number-form', input, submit);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const raw = input.value.replace(/[\s  .]/g, '');
    if (!/^\d{1,9}$/.test(raw)) { toast('Entre un nombre entier'); return; }
    const v = Number(raw);
    if (game.guesses.some((g) => g.v === v)) { toast('Déjà proposé !'); return; }
    input.value = '';
    push(v);
  });

  const counter = h('div.counter');
  const result = h('div.result');
  const list = h('div.map-rows.number-rows');

  root.append(
    h('div.panel.clue.number-clue',
      h('div.clue-meta',
        h('span.theme-chip', `${theme.emoji} ${theme.label}`),
        h('h3.number-question', question.text),
        h('p.muted', 'Les indices se débloquent au fil des essais : clique pour les révéler.'),
        hints.el)),
    h('div.panel.input-panel', form, counter),
    result, list,
    h('div.legend', h('span', h('i.sw.ok'), 'Exact'), h('span', h('i.sw.partial'), 'À 10 % près'), h('span', h('i.sw.ko'), 'Plus loin'), h('span', '▲▼ la réponse est plus haute / plus basse')));

  function push(v) {
    if (game.won) return;
    game.guesses.push({ v });
    if (v === answer) {
      game.won = true;
      recordWin(chiffreMode.id, date, game.guesses.length);
    }
    save();
    refresh();
    if (game.won) setTimeout(() => result.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
  }

  function refresh() {
    const n = game.guesses.length;
    counter.textContent = n ? `${n} essai${n > 1 ? 's' : ''}` : 'Astuce : vise large au début, puis resserre.';
    hints.update(game);
    input.disabled = submit.disabled = game.won;
    list.replaceChildren(...[...game.guesses].reverse().map((g) => {
      const st = statusOf(g.v, answer);
      const dir = st === 'ok' ? '✓' : answer > g.v ? '▲' : '▼';
      const label = st === 'ok' ? 'Exact !' : answer > g.v ? 'C\'est plus' : 'C\'est moins';
      return h(`div.map-row.${st}`, h('span', formatNumber(g.v)), h('span.dist', label), h('span.dir', dir));
    }));
    clear(result);
    if (game.won) {
      result.append(winCard({
        cfg: chiffreMode, date, tries: n,
        reveal: h('div.reveal.number-reveal',
          h('div.number-answer', formatNumber(answer)),
          h('div', h('p', question.text), question.note ? h('p.small.muted', question.note) : null,
            h('p.small.muted', 'Source : données du jeu via DofusDB.'))),
        onShare: () => shareResult(buildShare(), 'Résultat copié !'),
      }));
    } else if (!game.guesses.length) input.focus();
  }

  function buildShare() {
    const rows = game.guesses.map((g) => {
      const st = statusOf(g.v, answer);
      return `${STATUS_EMOJI[st]}${st === 'ok' ? '' : answer > g.v ? '⬆️' : '⬇️'}`;
    });
    const line = rows.length > 12 ? [...rows.slice(0, 11), '…', rows[rows.length - 1]] : rows;
    return [`Dofusle #${dayNumber(date)} — Juste prix ${chiffreMode.emoji} (${theme.label})`,
      `Trouvé en ${game.guesses.length} essai${game.guesses.length > 1 ? 's' : ''} · série ${currentStreak(loadStats(chiffreMode.id), date)} 🔥`,
      line.join(' '), location.href.split('#')[0] + `#${chiffreMode.id}`].join('\n');
  }

  refresh();
}
