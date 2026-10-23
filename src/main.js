// Point d'entrée : navigation entre les modes (hash), aide, stats.
import { h, clear, toast } from './ui/dom.js';
import { openModal } from './ui/modal.js';
import { showStats } from './ui/stats.js';
import { clearCache } from './core/cache.js';
import { harvestedToday, modeInfo } from './core/modes.js';
import { todayKey } from './core/daily.js';
import { runGuessMode } from './modes/engine.js';
import { monsterMode } from './modes/monster.js';
import { spellMode } from './modes/spell.js';
import { itemMode } from './modes/item.js';
import { mapMode, runMapMode } from './modes/map.js';
import { criMode } from './modes/cri.js';
import { chiffreMode, runChiffreMode } from './modes/chiffre.js';

// Pour ajouter un mode (ex. Bellaphones) : créer sa config + son dataset et l'ajouter ici.
const MODES = [
  { ...monsterMode, run: (root, o) => runGuessMode(root, monsterMode, o) },
  { ...spellMode, run: (root, o) => runGuessMode(root, spellMode, o) },
  { ...mapMode, run: (root, o) => runMapMode(root, o) },
  { ...itemMode, run: (root, o) => runGuessMode(root, itemMode, o) },
  { ...criMode, run: (root, o) => runGuessMode(root, criMode, o) },
  { ...chiffreMode, run: (root, o) => runChiffreMode(root, o) },
];

const app = document.getElementById('app');
const nav = document.getElementById('modes');

function currentMode() {
  const ALIASES = { chiffre: 'juste-prix' }; // anciens liens
  const raw = location.hash.replace('#', '').split('/')[0];
  const id = ALIASES[raw] || raw;
  return MODES.find((m) => m.id === id) || MODES[0];
}

// Mois du calendrier du Krosmoz (Javian = janvier … Descendre = décembre)
const KROSMOZ_MONTHS = ['Javian', 'Flovor', 'Martalo', 'Aperirel', 'Maisial', 'Juinssidor', 'Joullier', 'Fraouctor', 'Septange', 'Octolliard', 'Novamaire', 'Descendre'];
const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function renderDate() {
  const [y, m, d] = todayKey().split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  document.getElementById('krosmoz-date').textContent = `${WEEKDAYS[wd]} ${d} ${KROSMOZ_MONTHS[m - 1]}`;
}

function renderNav(active) {
  const done = new Set(harvestedToday());
  clear(nav);
  for (const m of MODES) {
    const won = done.has(m.id);
    const current = m.id === active.id;
    nav.append(h('a.mode-tab', {
      href: `#${m.id}`,
      class: [current ? 'active' : '', won ? 'won' : ''].join(' ').trim() || undefined,
      'aria-current': current ? 'page' : undefined,
      title: `${m.label} : Dofus ${modeInfo(m.id).dofus}${won ? ', récolté aujourd\'hui' : ''}`,
    },
    h('span.egg', { 'data-mode': m.id }, h('img', { src: m.icon, alt: '' })),
    h('span.mode-label', m.label)));
  }
  const n = done.size;
  document.getElementById('rack-count').textContent = n === MODES.length
    ? 'Les six Dofus du jour sont récoltés.'
    : n ? `${n} Dofus sur ${MODES.length} récoltés aujourd'hui` : 'Réussis un défi pour récolter son Dofus';
}

function route() {
  const mode = currentMode();
  renderNav(mode);
  renderDate();
  document.body.dataset.mode = mode.id;
  document.title = `Dofusle — ${mode.label}`;
  mode.run(app, {});
}

window.addEventListener('hashchange', route);
window.addEventListener('dofusle:progress', () => renderNav(currentMode()));

document.getElementById('btn-help').addEventListener('click', () => {
  const mode = currentMode();
  openModal('Comment jouer',
    h('p', 'Chaque jour à minuit (heure de Paris), un nouveau défi par mode — le même pour tout le monde.'),
    h('ul.help-list',
      h('li', h('strong', 'Monstre : '), 'propose des monstres. Chaque colonne (famille, niveau, PV, zone, rang, faiblesse, couleur) se colore selon la ressemblance avec le monstre secret.'),
      h('li', h('strong', 'Sort : '), 'une icône de sort de classe, floutée ou zoomée. Elle se dévoile à chaque essai ; des indices (PA, portée, élément, classe) se débloquent et se révèlent d\'un clic.'),
      h('li', h('strong', 'Carte : '), 'un bout de map. Clique sur la mini-carte, tape des coordonnées [X, Y] ou une zone : on t\'indique la distance en nombre de maps.'),
      h('li', h('strong', 'Objet : '), 'retrouve un équipement à partir de ses effets ou de son icône floutée.'),
      h('li', h('strong', 'Cri : '), 'écoute le cri d\'un monstre (tiré des fichiers du jeu) et retrouve à qui il appartient.'),
      h('li', h('strong', 'Juste prix : '), 'une question chiffrée improbable (maps d\'une région, recettes d\'un métier, PV d\'un boss…). Trouve le nombre exact grâce aux indications plus / moins.')),
    h('p.muted', 'Les indices ne s\'affichent jamais tout seuls : une fois débloqués, clique dessus pour les révéler.'),
    h('div.legend.static',
      h('span', h('i.sw.ok'), 'Correct'),
      h('span', h('i.sw.partial'), 'Partiel / proche'),
      h('span', h('i.sw.ko'), 'Faux'),
      h('span', '▲▼ la bonne valeur est plus haute / plus basse')),
    h('p', 'Une fois le défi du jour réussi, partage ton résultat et passe au défi suivant.'),
    mode.help ? h('p.muted', mode.help) : null);
});

document.getElementById('btn-stats').addEventListener('click', () => showStats(currentMode()));
document.getElementById('btn-cache').addEventListener('click', async () => {
  await clearCache();
  toast('Cache vidé — rechargement des données…');
  setTimeout(() => location.reload(), 600);
});

route();
