// Rendu d'une carte du Bestiaire (planche de naturaliste) et de son dos.
// Toutes les mesures sont en em : la même carte sert en grand et en vignette d'album.
import { h } from './dom.js';
import { rarity } from '../data/cards.js';

const levelText = ([a, b]) => (a === b ? `niveau ${a}` : `niveau ${a} à ${b}`);

/** Reflet de la feuille d'or / d'argent : suit le pointeur sur les cartes Rare et plus. */
function followLight(el) {
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--lx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--ly', `${((e.clientY - r.top) / r.height) * 100}%`);
  });
  el.addEventListener('pointerleave', () => { el.style.removeProperty('--lx'); el.style.removeProperty('--ly'); });
}

export function cardEl(card, { count = 1 } = {}) {
  const r = rarity(card.rarity);
  const [lo, hi] = card.level;
  const left = Math.min(100, (lo / 200) * 100);
  const width = Math.max(2, Math.min(100, (hi / 200) * 100) - left);
  const long = card.name.length > 22 ? '.long' : card.name.length > 16 ? '.mid' : '';
  const el = h(`article.bcard.r${card.rarity}`, { 'aria-label': `${card.name}, carte ${r.label.toLowerCase()}`, 'data-card': card.id },
    h('div.bc-top', h('span', `Planche n° ${card.num}`), h('span', card.family)),
    h(`div.bc-name${long}`, card.name),
    h('div.bc-rule', { 'aria-hidden': 'true' }),
    h('div.bc-art', h('img', { src: card.img, alt: '', loading: 'lazy', decoding: 'async' })),
    h('div.bc-scale', { 'aria-label': levelText(card.level) },
      h('div.bc-ruler', h('i', { style: `left:${left.toFixed(1)}%;width:${width.toFixed(1)}%` })),
      h('span', h('em', '1'), h('b', levelText(card.level)), h('em', '200'))),
    h('div.bc-foot',
      h('div.bc-hab', card.habitat, h('small', 'Habitat')),
      h('div.bc-sealbox', h('div.bc-seal', { 'aria-hidden': 'true' }), h('div.bc-rar', r.label))),
    count > 1 ? h('span.bc-count', { title: `${count} exemplaires` }, `×${count}`) : null);
  if (card.rarity >= 3) followLight(el);
  return el;
}

/** Dos de carte : couverture de cuir. `glow` : lueur de la rareté (ouverture des coffres). */
export function cardBack({ glow = 0, missing = null } = {}) {
  return h(`div.bcard.bc-back${glow ? `.glow${glow}` : ''}${missing ? '.missing' : ''}`, { 'aria-hidden': missing ? undefined : 'true' },
    missing ? h('img.bc-ghost', { src: missing.img, alt: '', loading: 'lazy', decoding: 'async' }) : h('div.bc-egg'),
    missing ? h('div.bc-num', `n° ${missing.num}`) : h('div.bc-word', 'Dofusle'),
    missing ? null : h('div.bc-sub', 'Bestiaire du Krosmoz'));
}
