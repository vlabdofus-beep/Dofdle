// Fenêtre de bienvenue, affichée une seule fois à la première visite.
import { h } from './dom.js';
import { openModal } from './modal.js';
import { getPref, setPref } from '../core/storage.js';

const exampleCell = (status, mark, value, arrow) => h(`span.cell.intro-cell.${status}`,
  h('span.cell-mark', { 'aria-hidden': 'true' }, mark),
  h('span.cell-main', h('span.cell-text', value), arrow ? h(`span.cell-arrow.${arrow}`, { 'aria-hidden': 'true' }) : null));

export function showIntro() {
  openModal('Bienvenue sur Dofusle',
    h('p', 'Chaque jour, six défis dans l\'univers de Dofus : un monstre, un sort, une map, un objet, un cri et un « juste prix ». Chaque défi réussi te fait récolter un Dofus.'),
    h('h3', 'Lire les réponses'),
    h('p.muted', 'Exemple : tu proposes un Bouftou alors que la réponse est un Tofu de niveau plus élevé.'),
    h('div.intro-row',
      exampleCell('ko', '✕', 'Bouftous'),
      exampleCell('partial', '≈', 'Amakna'),
      exampleCell('ko', '✕', '1–5', 'up'),
      exampleCell('ok', '✓', 'Normal')),
    h('ul.help-list',
      h('li', h('strong', '✓ vert : '), 'identique à la réponse.'),
      h('li', h('strong', '≈ orange : '), 'proche (même région, plages qui se chevauchent…).'),
      h('li', h('strong', '✕ rouge : '), 'faux. La flèche dit si la bonne valeur est plus haute ou plus basse.'),
      h('li', h('strong', 'Indices : '), 'ils se débloquent au fil des essais. Touche-les pour les révéler.')),
    h('p.muted.small', 'Astuce : sur téléphone, ajoute Dofusle à ton écran d\'accueil (menu Partager puis « Sur l\'écran d\'accueil » sur iPhone, ou « Installer l\'application » sur Android) pour y revenir chaque jour.'),
    { onClose: () => setPref('intro-seen', true) });
}

export function maybeShowIntro() {
  if (!getPref('intro-seen', false)) showIntro();
}
