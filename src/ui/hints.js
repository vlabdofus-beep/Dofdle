// Indices cliquables : verrouillés jusqu'à N essais, puis révélés uniquement
// si le joueur clique. Les indices révélés sont mémorisés avec la partie.
// Rendu : une grille de tuiles de taille identique, quel que soit leur état.
import { h } from './dom.js';

/**
 * @param {object} ctx  contexte de partie ({ game, save })
 * @param {{key:string, at:number, title:string, render:()=>Node|string}[]} hints
 */
export function createHints(ctx, hints, { className = '' } = {}) {
  const el = h(`div.hints${className ? `.${className}` : ''}`);
  el.style.setProperty('--n', String(hints.length));
  const revealed = () => new Set(ctx.game.hints || []);
  let justOpened = null; // anime uniquement l'indice qu'on vient de révéler

  function reveal(key) {
    justOpened = key;
    ctx.game.hints = [...revealed(), key];
    ctx.save?.();
    update(ctx.game);
  }

  function update(game) {
    const open = revealed();
    const n = game.guesses.length;
    el.replaceChildren(...hints.map((hint) => {
      const left = hint.at - n;
      const unlocked = left <= 0 || game.won;
      if (open.has(hint.key)) {
        const anim = hint.key === justOpened;
        if (anim) justOpened = null;
        return h(`div.hint-tile.open${anim ? '.revealing' : ''}`, h('span.hint-title', hint.title), h('div.hint-body', hint.render()));
      }
      if (unlocked) {
        return h('button.hint-tile.ready', { type: 'button', onclick: () => reveal(hint.key), 'aria-label': `Révéler l'indice : ${hint.title}` },
          h('span.hint-title', hint.title),
          h('span.hint-state', 'Révéler'));
      }
      const pct = Math.min(100, Math.round((n / hint.at) * 100));
      return h('div.hint-tile.locked', { 'aria-label': `Indice ${hint.title} disponible dans ${left} essai${left > 1 ? 's' : ''}` },
        h('span.hint-title', hint.title),
        h('span.hint-state', `Dans ${left} essai${left > 1 ? 's' : ''}`),
        h('span.hint-progress', { 'aria-hidden': 'true' }, h('i', { style: { width: `${pct}%` } })));
    }));
  }
  return { el, update };
}
