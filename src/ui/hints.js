// Indices cliquables : verrouillés jusqu'à N essais, puis révélés uniquement
// si le joueur clique. Les indices révélés sont mémorisés avec la partie.
import { h } from './dom.js';

/**
 * @param {object} ctx  contexte de partie ({ game, save })
 * @param {{key:string, at:number, title:string, render:()=>Node|string}[]} hints
 */
export function createHints(ctx, hints, { className = '' } = {}) {
  const el = h(`div.hints${className ? `.${className}` : ''}`);
  const revealed = () => new Set(ctx.game.hints || []);

  function reveal(key) {
    ctx.game.hints = [...revealed(), key];
    ctx.save?.();
    update(ctx.game);
  }

  function update(game) {
    const open = revealed();
    el.replaceChildren(...hints.map((hint) => {
      const left = hint.at - game.guesses.length;
      const unlocked = left <= 0 || game.won;
      const isOpen = open.has(hint.key);
      if (isOpen) {
        return h('div.hint-wrap.open',
          h('div.hint-card', h('span.hint-title', hint.title), h('div.hint-body', hint.render())));
      }
      return h('div.hint-wrap',
        h('button.hint', {
          type: 'button',
          disabled: !unlocked,
          onclick: () => reveal(hint.key),
          'aria-label': unlocked ? `Révéler l'indice : ${hint.title}` : `Indice ${hint.title} disponible dans ${left} essais`,
        },
        h('span.hint-title', hint.title),
        h('span.hint-state', unlocked ? 'Cliquer pour révéler' : `dans ${left} essai${left > 1 ? 's' : ''}`)));
    }));
  }
  return { el, update };
}
