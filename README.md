# Dofusle

Jeu quotidien « à la Loldle » dans l'univers de **Dofus**. Fan game **non officiel**, non affilié à Ankama Games.
Données et images : [DofusDB](https://dofusdb.fr) (usage non commercial).

Cinq modes, un défi par jour (minuit, heure de Paris), identique pour tout le monde, puis un mode illimité.
Les indices ne s'affichent jamais tout seuls : une fois débloqués, le joueur clique pour les révéler.
Une fois un défi réussi, un lien mène directement au mode suivant non terminé.

| Mode | Principe | Feedback / indices |
|---|---|---|
| **Monstre** | Deviner le monstre du jour (hors monstres de quête et invocations) | Famille (vert/rouge), niveau, PV, zone, rang, faiblesse élémentaire, couleur dominante ; indices : zone (5 essais), silhouette (11 essais) |
| **Sort** | Icône de sort de classe floutée ou zoomée (sans vignettes dans les propositions) | Classe, élément, coût PA, portée ; indices : PA & portée (3), élément (5), classe (7) |
| **Carte** | Extrait de map zoomé + mini-carte cliquable du Monde des Douze | Distance en nombre de maps (Manhattan) ; propositions par clic, `X,Y` ou nom de zone ; indices : région, sous-zone, abscisse |
| **Objet** | Effets de l'équipement ou icône floutée | Type, niveau, panoplie ; indices : effets (4, jours « icône »), panoplie (6) |
| **Juste prix** | Question chiffrée improbable générée depuis DofusDB (maps d'une région, recettes d'un métier, PV d'un boss, salles d'un donjon…) — 28 modèles répartis sur 8 thèmes | Plus / moins, orange à 10 % près ; indices : fourchette (4), forme du nombre (8). Un thème différent chaque jour, tous les thèmes passent avant qu'un thème revienne |
| **Cri** | Écouter le cri d'un monstre, extrait des fichiers audio de Dofus 3 | Famille ; les monstres partageant le même cri sont acceptés ; indices : niveau (5 essais), famille (10 essais) |

La question du mode Juste prix est calculée à la volée (1 à 4 requêtes `$limit=0` vers DofusDB) puis mise en cache pour la journée : aucun snapshot n'est nécessaire.

Sans compte : parties, séries et statistiques sont dans le `localStorage` du navigateur.

## Lancer en local

Aucune dépendance, aucun build : c'est un site statique en modules ES.

```bash
npm run dev            # ou : npx serve .   /   python -m http.server
```

Puis ouvrir http://localhost:5173. (Un serveur HTTP est nécessaire : les modules ES ne se chargent pas en `file://`.)

## Déployer

C'est un site 100 % statique : aucune commande de build.

**Cloudflare Workers (recommandé)** : le dépôt contient `wrangler.jsonc` (Worker statique nommé `dofdle`).
Dans Workers & Pages → Create → *Import a repository* → ce dépôt, build command vide, deploy command
`npx wrangler deploy`. Chaque push sur `main` redéploie le site. `.assetsignore` exclut les fichiers
non publics (scripts, outils, README) et `_headers` règle le cache. Un domaine perso s'ajoute dans
*Settings → Domains & Routes*.

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
| `data/maps.json` | ~430 sous-zones du Monde des Douze et ~6 200 maps (une par coordonnée, prioritaire si possible) | ~150 Ko |
| `data/cris.json` | 777 cris ↔ squelettes de monstres (fichier fourni, voir plus bas) | ~25 Ko |

La couleur des monstres est calculée depuis leur image DofusDB (`src/data/colors.js`) : par le script de snapshot
(décodeur PNG maison, `scripts/png.mjs`), sinon dans le navigateur pour la cible et chaque proposition, avec cache local.

Les coordonnées des maps (worldMap 1, `hasPriorityOnWorldmap = true`) servent à la fois au tirage, à la mini-carte
et aux distances : aucune requête supplémentaire pendant la partie. L'API contient aussi ~1 800 doublons placés en `[0,0]`, exclus par ce filtre.

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
    chiffres.js         modèles de questions du mode Juste prix + rotation des thèmes
  modes/
    engine.js           moteur commun des modes à grille (saisie, feedback, victoire, partage)
    monster.js  spell.js  item.js   configs de mode
    map.js              mode Carte (saisie de coordonnées, distance, zoom)
    chiffre.js          mode Juste prix (saisie numérique, plus/moins)
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

## Cris des monstres

`assets/cris/` contient 777 cris (MP3 mono 64 kb/s, lisible partout y compris sur iPhone) extraits des banques FMOD du client
(`Content/Audio/Banks/Desktop/<squelette>.bank`). Une banque par squelette (`look` DofusDB `{squelette|…}`) ;
pour chacune, on garde de préférence un échantillon `Voix_*_Attaque`, sinon `Mort`, `Hit`, puis `AnimAttaque`.
Les noms de fichiers sont hachés pour ne pas révéler le monstre. Pour régénérer :

```bash
git clone https://github.com/HearthSim/python-fsb5   # décodage FSB5 / Vorbis (libogg + libvorbis requis)
python tools/cris-extract/build_cris.py assets/cris   # adapter les chemins en tête des scripts
```

## Licence et mentions

Projet de fan, gratuit, sans publicité. Dofus, ses noms, images et contenus sont la propriété d'Ankama Games.
Les données proviennent de DofusDB, dont la licence interdit l'usage commercial : ne monétisez pas ce projet.
