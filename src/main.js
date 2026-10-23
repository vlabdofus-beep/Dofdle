// Point d'entrée : navigation entre les modes (hash), aide, stats.
import { h, clear, toast } from './ui/dom.js';
import { openModal } from './ui/modal.js';
import { showStats } from './ui/stats.js';
import { clearCache } from './core/cache.js';
import { runGuessMode } from './modes/engine.js';
import { monsterMode } from './modes/monster.js';
import { spellMode } from './modes/spell.js';
import { itemMode } from './modes/item.js';
import { mapMode, runMapMode } from './modes/map.js';

// Pour ajouter un mode (ex. Bellaphones) : créer sa config + son dataset et l'ajouter ici.
const MODES = [
  { ...monsterMode, run: (root, o) => runGuessMode(root, monsterMode, o) },
  { ...spellMode, run: (root, o) => runGuessMode(root, spellMode, o) },
  { ...mapMode, run: (root, o) => runMapMode(root, o) },
  { ...itemMode, run: (root, o) => runGuessMode(root, itemMode, o) },
];

const app = document.getElementById('app');
const nav = document.getElementById('modes');

function currentMode() {
  const id = location.hash.replace('#', '').split('/')[0];
  return MODES.find((m) => m.id === id) || MODES[0];
}

function renderNav(active) {
  clear(nav);
  for (const m of MODES) {
    nav.append(h('a.mode-tab', { href: `#${m.id}`, class: m.id === active.id ? 'active' : undefined, 'aria-current': m.id === active.id ? 'page' : undefined },
      h('img', { src: m.icon, alt: '' }), h('span', m.label)));
  }
}

function route() {
  const mode = currentMode();
  renderNav(mode);
  document.title = `Dofusle — ${mode.label}`;
  mode.run(app, { endless: location.hash.endsWith('/illimite') });
}

window.addEventListener('hashchange', route);

document.getElementById('btn-help').addEventListener('click', () => {
  const mode = currentMode();
  openModal('Comment jouer',
    h('p', 'Chaque jour à minuit (heure de Paris), un nouveau défi par mode — le même pour tout le monde.'),
    h('ul.help-list',
      h('li', h('strong', 'Monstre : '), 'propose des monstres. Chaque colonne (famille, niveau, zone, rang, faiblesse, drop, couleur) se colore selon la ressemblance avec le monstre secret.'),
      h('li', h('strong', 'Sort : '), 'une icône de sort de classe, floutée ou zoomée. Elle se dévoile à chaque essai, avec des indices (PA, portée, élément, classe).'),
      h('li', h('strong', 'Carte : '), 'un bout de map. Propose des coordonnées [X, Y] ou une zone : on t\'indique la distance en nombre de maps et la direction.'),
      h('li', h('strong', 'Objet : '), 'retrouve un équipement à partir de ses effets ou de son icône floutée.')),
    h('div.legend.static',
      h('span', h('i.sw.ok'), 'Correct'),
      h('span', h('i.sw.partial'), 'Partiel / proche'),
      h('span', h('i.sw.ko'), 'Faux'),
      h('span', '▲▼ la bonne valeur est plus haute / plus basse')),
    h('p', 'Une fois le défi du jour réussi, partage ton résultat et enchaîne en mode ', h('strong', 'Illimité'), '.'),
    mode.help ? h('p.muted', mode.help) : null);
});

document.getElementById('btn-stats').addEventListener('click', () => showStats(currentMode()));
document.getElementById('btn-cache').addEventListener('click', async () => {
  await clearCache();
  toast('Cache vidé — rechargement des données…');
  setTimeout(() => location.reload(), 600);
});

route();
