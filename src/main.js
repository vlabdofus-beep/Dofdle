// Point d'entrée : navigation entre les modes (hash), aide, stats.
import { h, clear, toast } from './ui/dom.js';
import { openModal, closeModal } from './ui/modal.js';
import { showStats } from './ui/stats.js';
import { clearCache } from './core/cache.js';
import { harvestedToday, modeInfo, dofusImg } from './core/modes.js';
import { todayKey, dayNumber, msUntilNextDaily } from './core/daily.js';
import { loadGame, loadStats, currentStreak } from './core/storage.js';
import { shareResult } from './ui/share.js';
import { renderHome, chestNotices, fitHome } from './ui/home.js';
import { showCollection } from './ui/collection.js';
import { maybeShowIntro, showIntro } from './ui/intro.js';
import { krosmozDate } from './core/krosmoz.js';
import { backfillHistory } from './core/storage.js';
import { streakText } from './modes/engine.js';
import { mobileBar } from './ui/victory.js';
import { streakEgg } from './ui/streak.js';
import { soundOn, setSound } from './ui/sound.js';
import { renderBestiary } from './ui/bestiary.js';
import { rewardWin, catchUpChests, collection } from './core/chests.js';
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

// Le défilement est géré par le jeu (haut de page à chaque changement de défi)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const app = document.getElementById('app');
const nav = document.getElementById('modes');

/** Mode affiché, ou null pour l'écran d'accueil (pas de hash ou hash inconnu). */
function currentMode() {
  const ALIASES = { chiffre: 'juste-prix' }; // anciens liens
  const raw = location.hash.replace('#', '').split('/')[0];
  const id = ALIASES[raw] || raw;
  return MODES.find((m) => m.id === id) || null;
}

function renderDate() {
  document.getElementById('krosmoz-date').textContent = krosmozDate(todayKey());
}

function renderNav(active, justWon = null) {
  const done = new Set(harvestedToday().filter((id) => !awaiting.has(id)));
  clear(nav);
  MODES.forEach((m, i) => {
    const won = done.has(m.id);
    const current = m.id === active?.id;
    nav.append(h('a.mode-tab', {
      href: `#${m.id}`,
      class: [current ? 'active' : '', won ? 'won' : '', m.id === justWon ? 'just-won' : ''].join(' ').trim() || undefined,
      'aria-current': current ? 'page' : undefined,
      title: `${m.label} : Dofus ${modeInfo(m.id).dofus}${won ? ', récolté aujourd\'hui' : ''}`,
    },
    h('span.dofus-slot', { 'data-mode': m.id },
      h('img.dofus', { src: dofusImg(m.id), alt: '', width: 64, height: 64 }),
      h('img.mode-badge', { src: m.icon, alt: '' })),
    h('span.mode-label', m.label)));
    nav.lastChild.style.setProperty('--i', String(i));
  });
  const n = done.size;
  const complete = n === MODES.length;
  const count = document.getElementById('rack-count');
  nav.parentElement.classList.toggle('complete', complete);
  if (complete) {
    count.replaceChildren('Les six Dofus du jour sont récoltés ! ',
      h('button.link.share-day', { type: 'button', onclick: shareDay }, 'Partager ma journée'));
  } else {
    count.textContent = n ? `${n} Dofus sur ${MODES.length} récoltés aujourd'hui` : '';
  }
}

/** Récapitulatif des six défis du jour, à coller sur Discord ou ailleurs. */
function shareDay() {
  const date = todayKey();
  const games = MODES.map((m) => ({ m, g: loadGame(m.id, date) }));
  const won = games.filter((x) => x.g.won);
  const lines = games.map(({ m, g }) => {
    const n = g.guesses.length;
    return `${m.emoji} ${m.label} : ${g.won ? `${n} essai${n > 1 ? 's' : ''}` : 'pas encore'}`;
  });
  const total = won.reduce((a, x) => a + x.g.guesses.length, 0);
  const head = won.length === MODES.length
    ? `Dofusle #${dayNumber(date)} : les six Dofus récoltés en ${total} essais`
    : `Dofusle #${dayNumber(date)} : ${won.length} Dofus sur ${MODES.length} récoltés`;
  shareResult([head, ...lines, location.href.split('#')[0]].join('\n'), 'Récapitulatif copié !');
}

/** Change de page ; fondu enchaîné quand le navigateur sait animer les changements de vue. */
function route() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce || !app.firstChild) { render(); return; }
  const t = document.startViewTransition(() => Promise.race([render(), new Promise((r) => setTimeout(r, 350))]));
  // Une navigation rapide interrompt la transition en cours : ce n'est pas une erreur
  for (const p of [t.ready, t.finished, t.updateCallbackDone]) p?.catch(() => {});
}

function render() {
  closeModal();
  awaiting.clear();
  const mode = currentMode();
  renderNav(mode);
  renderDate();
  const page = location.hash.replace('#', '').split('/')[0];
  document.body.dataset.mode = mode ? mode.id : page === 'bestiaire' || page === 'coffres' ? 'bestiaire' : 'accueil';
  app.classList.remove('no-guess');
  fitHome(); // remet l'échelle à 1 hors de l'accueil
  window.scrollTo(0, 0);
  if (!mode && page === 'coffres') {
    document.title = 'Dofusle, coffres à ouvrir';
    return renderBestiary(app, 'coffres');
  }
  if (!mode && page === 'bestiaire') {
    document.title = 'Dofusle, Bestiaire du Krosmoz';
    return renderBestiary(app, 'album');
  }
  if (!mode) {
    document.title = 'Dofusle, le défi quotidien de l\'univers Dofus';
    renderHome(app, MODES, { onShareDay: shareDay });
    maybeShowIntro();
    return Promise.resolve();
  }
  document.title = `Dofusle — ${mode.label}`;
  const running = Promise.resolve(mode.run(app, {})).catch(() => {});
  maybeShowIntro();
  return running;
}

window.addEventListener('hashchange', route);
// Victoire : sur mobile, le Dofus attend dans la section de victoire puis s'envole
// vers la barre du bas (dofusle:landed) où il se pose avec l'animation de récolte.
const awaiting = new Set();
window.addEventListener('dofusle:progress', (ev) => {
  const mode = currentMode();
  const won = ev.detail?.mode;
  // Coffres : 1 par défi, 3 pour la journée complète, N tous les 5 jours de série (une seule fois chacun)
  if (won) {
    const gained = rewardWin(won, todayKey(), MODES.length);
    if (gained.length && chestNotices()) {
      const n = gained.reduce((a, g) => a + g.n, 0);
      setTimeout(() => toast(`+${n} coffre${n > 1 ? 's' : ''} : ${gained.map((g) => g.why).join(', ')}`, 3600), 1800);
    }
  }
  const fresh = won && !nav.querySelector(`.mode-tab.won .dofus-slot[data-mode="${won}"]`);
  // Mobile : le Dofus s'envole vers la barre du bas ; ordinateur : il se pose tout de suite
  if (fresh && mobileBar()) awaiting.add(won);
  renderNav(mode, fresh && !mobileBar() ? won : null);
  if (!mode) return;
  // Met à jour la série affichée dans l'en-tête du mode
  const badge = document.querySelector(`.streak-badge[data-mode="${mode.id}"]`);
  if (badge) {
    badge.querySelector('.streak-text').textContent = streakText(mode.id, todayKey());
    const n = currentStreak(loadStats(mode.id), todayKey());
    const short = badge.querySelector('.streak-short');
    if (short) short.textContent = `${n} j`;
    badge.querySelector('.streak-egg')?.replaceWith(streakEgg(n));
    badge.classList.add('on');
    if (fresh && !mobileBar()) { badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
  }
});
window.addEventListener('dofusle:share-day', () => shareDay());
window.addEventListener('dofusle:landed', (ev) => {
  const won = ev.detail?.mode;
  const fresh = awaiting.delete(won);
  renderNav(currentMode(), fresh ? won : null);
  const badge = document.querySelector(`.streak-badge[data-mode="${won}"]`);
  if (fresh && badge) { badge.classList.remove('bump'); void badge.offsetWidth; badge.classList.add('bump'); }
});

document.getElementById('btn-help').addEventListener('click', () => {
  const mode = currentMode();
  openModal('Comment jouer',
    h('p', 'Chaque jour à minuit (heure de Paris), un nouveau défi par mode, le même pour tout le monde. Ta série fait évoluer ton œuf : un nouveau Dofus tous les 5 jours.'),
    h('p', h('button.link', { type: 'button', onclick: showIntro }, 'Revoir l\'exemple de lecture des réponses')),
    h('ul.help-list',
      h('li', h('strong', 'Monstre : '), 'propose des monstres. Chaque colonne (famille, niveau, PV, zone, rang, faiblesse, couleur) se colore selon la ressemblance avec le monstre secret.'),
      h('li', h('strong', 'Sort : '), 'une icône de sort de classe, floutée ou zoomée. Elle se dévoile à chaque essai ; des indices (PA, portée, élément, classe) se débloquent et se révèlent d\'un clic.'),
      h('li', h('strong', 'Carte : '), 'un bout de map. Clique sur la mini-carte, tape des coordonnées [X, Y] ou une zone : on t\'indique la distance en nombre de maps.'),
      h('li', h('strong', 'Objet : '), 'retrouve un équipement à partir de ses effets ou de son icône floutée.'),
      h('li', h('strong', 'Cri : '), 'écoute le cri d\'un monstre (tiré des fichiers du jeu) et retrouve à qui il appartient.'),
      h('li', h('strong', 'Juste prix : '), 'une question chiffrée improbable (maps d\'une région, recettes d\'un métier, PV d\'un boss…). Trouve le nombre exact grâce aux indications plus / moins.')),
    h('p.muted', 'Les indices ne s\'affichent jamais tout seuls : une fois débloqués, clique dessus pour les révéler.'),
    h('p.muted', 'Bestiaire : chaque défi réussi rapporte un coffre (3 pour la journée complète ; tous les 5 jours de série, autant de coffres que de jours : 5, 10, 15…). Ouvre-les dans le Bestiaire, par 1 ou par 10, pour collectionner les cartes des monstres et des Dofus.'),
    h('p.muted', 'Bloqué ? Au-dessus du champ, filtre la liste par région et niveau (Monstre, Cri) ou par classe et élément (Sort), et classe-la par niveau.'),
    h('div.legend.static',
      h('span', h('i.sw.ok', '✓'), 'Correct'),
      h('span', h('i.sw.partial', '≈'), 'Partiel / proche'),
      h('span', h('i.sw.ko', '✕'), 'Faux'),
      h('span', h('i.legend-arrow'), 'la bonne valeur est plus haute (flèche doublée : beaucoup plus haute)')),
    h('p', 'Une fois le défi du jour réussi, partage ton résultat et passe au défi suivant.'),
    mode?.help ? h('p.muted', mode.help) : null);
});

// Sons : désactivés par défaut, le choix est mémorisé
const soundBtn = document.getElementById('btn-sound');
const showSound = () => {
  const on = soundOn();
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.title = on ? 'Couper les sons' : 'Activer les sons';
  soundBtn.classList.toggle('on', on);
};
soundBtn.addEventListener('click', () => { setSound(!soundOn()); showSound(); toast(soundOn() ? 'Sons activés' : 'Sons coupés'); });
showSound();

// Trophée : la collection complète (série 6/6, calendrier, statistiques par mode)
document.getElementById('btn-stats').addEventListener('click', () => showCollection(MODES));
document.getElementById('btn-legal').addEventListener('click', () => openModal('Mentions',
  h('p', h('strong', 'Fan game non officiel. '), 'Dofusle n\'est ni affilié, ni approuvé, ni sponsorisé par Ankama Games. Dofus et tous les noms, images et contenus associés sont la propriété d\'Ankama Games.'),
  h('p', 'Données et images issues de ', h('a', { href: 'https://dofusdb.fr', target: '_blank', rel: 'noopener' }, 'DofusDB'), ', pour un usage non commercial.'),
  h('p', 'Pas de compte, pas de publicité, aucune donnée collectée : ta progression reste dans ton navigateur.')));
document.getElementById('btn-cache').addEventListener('click', async () => {
  await clearCache();
  toast('Cache vidé, rechargement des données…');
  setTimeout(() => location.reload(), 600);
});

backfillHistory(MODES.map((m) => m.id));

// Coffres : pastille sur l'icône du Bestiaire ; cadeau de bienvenue pour les joueurs déjà là
const chestBadge = document.getElementById('chest-badge');
const showChests = () => {
  const n = collection().chests;
  chestBadge.hidden = !n || !chestNotices();
  chestBadge.textContent = n > 99 ? '99+' : String(n);
  document.getElementById('btn-chests').setAttribute('aria-label', n ? `Bestiaire et coffres : ${n} coffre${n > 1 ? 's' : ''} à ouvrir` : 'Bestiaire et coffres');
};
window.addEventListener('dofusle:chests', showChests);
const welcome = catchUpChests(MODES.map((m) => m.id), todayKey());
showChests();
if (welcome && chestNotices()) setTimeout(() => toast(`Bestiaire du Krosmoz : ${welcome} coffre${welcome > 1 ? 's' : ''} pour tes victoires et tes séries passées.`, 5200), 1200);
route();

// Onglet resté ouvert après minuit : on passe automatiquement aux défis du nouveau jour
function scheduleRollover() {
  setTimeout(() => {
    toast('Nouveaux défis disponibles !', 4000);
    route();
    scheduleRollover();
  }, msUntilNextDaily() + 1500);
}
scheduleRollover();
