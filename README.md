# Dofusle

Jeu quotidien « à la Loldle » dans l'univers de **Dofus**. Fan game **non officiel**, non affilié à Ankama Games.
Données et images : [DofusDB](https://dofusdb.fr) (usage non commercial).

Quatre modes, un défi par jour (minuit, heure de Paris), identique pour tout le monde, puis un mode illimité :

| Mode | Principe | Feedback |
|---|---|---|
| **Monstre** | Deviner le monstre du jour | Famille, niveau, zone, rang (boss / mini-boss / archimonstre / normal), faiblesse élémentaire, drop notable, couleur dominante ; indices : zone (5 essais), silhouette (11 essais) |
| **Sort** | Icône de sort de classe floutée ou zoomée | Classe, élément, coût PA, portée ; indices à 3/5/7 essais |
| **Carte** | Extrait de map zoomé | Distance en nombre de maps (Manhattan) + direction ; propositions en `X,Y` ou par nom de zone |
| **Objet** | Effets de l'équipement ou icône floutée | Type, niveau, élément dominant, panoplie |

Sans compte : parties, séries et statistiques sont dans le `localStorage` du navigateur.

## Lancer en local

Aucune dépendance, aucun build : c'est un site statique en modules ES.

```bash
npm run dev            # ou : npx serve .   /   python -m http.server
```

Puis ouvrir http://localhost:5173. (Un serveur HTTP est nécessaire : les modules ES ne se chargent pas en `file://`.)

## Déployer

C'est un site 100 % statique : aucune commande de build.

**Cloudflare Pages (recommandé)** : Workers & Pages → Create → Pages → *Connect to Git* → ce dépôt.
Framework preset : *None*, build command : vide, build output directory : `/`.
Chaque push sur `main` redéploie le site ; le fichier `_headers` règle le cache.
On peut ensuite brancher un sous-domaine (ex. `dofusle.mondomaine.fr`) dans *Custom domains*.

Vercel fonctionne aussi (preset *Other*, sans build) ; `vercel.json` règle le cache.

## Données : cache à 3 niveaux

`src/core/cache.js` charge chaque jeu de données dans cet ordre :

1. **Snapshot statique** `data/<clé>.json` s'il existe (recommandé en production) ;
2. **IndexedDB** du navigateur (valide 7 jours) ;
3. **API DofusDB en direct** (CORS ouvert), puis mise en cache.

Sans snapshot, le premier chargement d'un mode prend 1 à 3 s (~80 requêtes pour les monstres, ~70 pour les objets).
Pour épargner l'API DofusDB, générez les snapshots après chaque mise à jour de Dofus :

```bash
npm run data                 # tous les modes
node scripts/build-data.mjs monsters items   # seulement certains
```

| Fichier | Contenu | Taille (approx.) |
|---|---|---|
| `data/monsters.json` | ~1 500 monstres du bestiaire (hors quête), races, zones, drops, couleurs | ~330 Ko |
| `data/spells.json` | ~860 sorts des 19 classes (via `/spell-variants`) | ~300 Ko |
| `data/items.json` | ~3 000 équipements, panoplies, gabarits d'effets | ~500 Ko |
| `data/maps.json` | ~430 sous-zones du Monde des Douze et leurs ids de maps | ~150 Ko |

La couleur des monstres est calculée depuis leur image DofusDB (`src/data/colors.js`) : par le script de snapshot
(décodeur PNG maison, `scripts/png.mjs`), sinon dans le navigateur pour la cible et chaque proposition, avec cache local.

Les coordonnées des maps sont demandées à la volée (`/map-positions`) pour la map du jour et les zones proposées.
Seules les maps `worldMap = 1` avec `hasPriorityOnWorldmap = true` comptent (l'API contient ~1 800 doublons placés en `[0,0]`).

Si la version d'un snapshot (`v`) ne correspond plus au code, il est ignoré et l'app repasse par l'API : pensez à régénérer.

## Architecture

```
index.html              coquille de la page (en-tête, onglets, disclaimer)
css/style.css           thème « pierre sombre » de Dofus 3 (ardoise, liserés dorés, vert lime)
src/
  main.js               routeur (#monstre, #sort, #carte, #objet), aide, stats
  core/
    api.js              client DofusDB (pagination $limit/$skip, lots id[$in], 6 requêtes en parallèle, retry)
    cache.js            snapshot → IndexedDB → API
    daily.js            date de Paris, n° du défi, tirage déterministe
    storage.js          parties du jour, séries, distribution des essais
    text.js             normalisation des noms français (accents, apostrophes, œ), gabarits d'effets
  data/                 un fichier par jeu de données : build() + logique de comparaison, sans DOM
    monsters.js  spells.js  items.js  maps.js  elements.js
  modes/
    engine.js           moteur commun des modes à grille (saisie, feedback, victoire, partage)
    monster.js  spell.js  item.js   configs de mode
    map.js              mode Carte (saisie de coordonnées, distance, zoom)
  ui/                   dom, autocomplétion, modale, partage, stats
scripts/build-data.mjs  génération des snapshots (Node ≥ 18, réutilise src/data/*)
assets/game/            icônes extraites du client Dofus 3 (voir plus bas)
tools/unity-extract/    extracteur d'assets Unity (Python + Pillow)
```

Les modules de `src/data/` ne touchent pas au DOM : ils tournent aussi bien dans le navigateur que dans Node,
et pourront être repris tels quels lors d'un passage à React/Next.

### Tirage du jour

`pickDaily()` choisit l'élément qui minimise `hash(mode | date | id)`. Ajouter des données (nouveaux monstres
après une mise à jour) ne change le défi d'un jour que si le nouvel élément « gagne » ce jour-là : pas de décalage
global comme avec un simple `index = seed % longueur`.

### Ajouter un mode (ex. Bellaphones)

1. Créer `src/data/bellaphones.js` avec un dataset `{ key, version, build(api, onProgress) }` et une fonction `compare(guess, target, data)` renvoyant des cellules `{ key, status: 'ok' | 'partial' | 'ko', arrow?, value }`.
2. Créer `src/modes/bellaphone.js` : la config (`id`, `label`, `columns`, `prepare`, `compare`, `clue` optionnel, `reveal`).
3. L'ajouter au tableau `MODES` dans `src/main.js` et au script `scripts/build-data.mjs`.

Le moteur (`engine.js`) gère le reste : autocomplétion, grille, série, partage, mode illimité.

## Assets du jeu

`assets/game/` contient des icônes extraites du client Dofus 3 (`Dofus_Data/StreamingAssets`) : éléments
(`tx_strength`, `tx_intelligence`…), têtes des classes, icônes bestiaire / sorts / équipement / carte au trésor,
fond étoilé de l'écran titre. Pour en extraire d'autres :

```bash
pip install pillow
python tools/unity-extract/extract.py ./sortie "<Dofus>/Dofus_Data/StreamingAssets/aa/StandaloneWindows64/uiassets_assets_2x.bundle"
```

L'extracteur gère UnityFS + LZ4 et les textures BC7 / DXT / RGBA. Images de monstres, sorts, objets et maps : DofusDB.

## Licence et mentions

Projet de fan, gratuit, sans publicité. Dofus, ses noms, images et contenus sont la propriété d'Ankama Games.
Les données proviennent de DofusDB, dont la licence interdit l'usage commercial : ne monétisez pas ce projet.
