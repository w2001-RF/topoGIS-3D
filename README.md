# TopoGIS 3D

Outil de relevé et d'analyse topographique : GPS, bâtiments OpenStreetMap, parcelles, mesures, relief, courbes de niveau et profil altimétrique.
L'application tient dans un seul fichier, `index.html`. Aucun serveur, aucune compilation, aucune clé API obligatoire.

## Arborescence

```
topoGIS-3D/
├── index.html                    # toute l'application (HTML + CSS + JavaScript)
├── .nojekyll                     # désactive Jekyll sur GitHub Pages
├── .github/workflows/pages.yml   # déploiement automatique (facultatif)
├── server/relay.mjs              # serveur de collaboration facultatif (Node.js, sans dépendance)
└── README.md
```

## Lancer en local

```
python -m http.server 8000
```

Ouvrez ensuite <http://localhost:8000>. Le fichier peut aussi être ouvert directement (`file://`) :
le serveur de tuiles OpenStreetMap standard refuse alors les requêtes sans en-tête Referer, et l'application utilise
automatiquement le fond OpenStreetMap France. La géolocalisation, elle, exige HTTPS ou `localhost`.

## Héberger sur GitHub Pages

Le fichier n'utilise que des chemins relatifs et des CDN en HTTPS : il fonctionne tel quel dans un sous-dossier
(`https://<utilisateur>.github.io/<depot>/`). La géolocalisation fonctionne car GitHub Pages sert en HTTPS,
et le fond OpenStreetMap standard fonctionne car le navigateur envoie un Referer.

**Option A, sans workflow**
1. Créez un dépôt et envoyez `index.html` (et `.nojekyll`) sur la branche `main`.
2. Dans *Settings > Pages*, choisissez *Deploy from a branch*, branche `main`, dossier `/ (root)`.

**Option B, avec le workflow fourni**
1. Envoyez tout le contenu du dossier sur la branche `main`.
2. Dans *Settings > Pages*, choisissez *Source : GitHub Actions*. Chaque envoi redéploie le site.

Remarques :
- Le stockage local (`localStorage`) est propre à l'origine `https://<utilisateur>.github.io`. Les clés utilisées commencent toutes par `topogis3d.`.
- N'ajoutez jamais de clé API non restreinte dans un dépôt public.

## Relief, courbes de niveau et profil altimétrique

Source par défaut : AWS Terrain Tiles (format Terrarium), gratuite et sans clé. Les altitudes qui en sont tirées sont **estimées** et indicatives.
Les altitudes relevées par le GPS de l'appareil sont **mesurées**. L'interface affiche l'origine de chaque valeur
(*Mesurée*, *Estimée*, *Saisie*, *Calculée*). Sans source disponible, aucune altitude n'est affichée ni inventée.

Pour utiliser un fournisseur qui exige une clé (par exemple MapTiler) :
1. Collez la clé dans la constante `DEM_API_KEY`, tout en haut du script de `index.html`.
2. Dans `CONFIG.dem`, remplacez `tiles` et `encoding` par les lignes commentées « Alternative avec clé ».
3. Restreignez la clé par domaine chez le fournisseur, car elle sera visible dans le fichier publié.

## Plan CAO (génie civil)

La section « Plan CAO » du panneau permet de manipuler le plan d'un terrain comme dans un logiciel de DAO.

- **Repère** : les objets sont stockés et calculés en coordonnées planes UTM (mètres, WGS84, zone déduite du premier objet), puis reconvertis en longitude/latitude pour l'affichage. Un rectangle dessiné est donc aligné sur la grille UTM, et peut sembler légèrement incliné sur la carte (convergence des méridiens).
- **Dessin** : ligne, polyligne, polygone, rectangle, cercle, point, texte, cote alignée.
- **Édition** : sélection (clic, fenêtre/capture), poignées de sommets, déplacer, copier, pivoter, échelle, miroir, décaler, exploser, effacer, annuler/rétablir (Ctrl+Z / Ctrl+Y).
- **Aides** : accrochages (extrémité, milieu, centre, intersection, proche), mode orthogonal (F8), calques (couleur, visibilité, verrou), ligne de commande avec alias français et anglais.
- **Saisie** : `E;N` (absolu), `@dx;dy` (relatif), `@distance<azimut` (polaire, azimut depuis le Nord), ou une distance seule vers le curseur.
- **Mesure** : distance (plane et géodésique, azimut en degrés et en gon), aire/périmètre, coordonnées.
- **Génie civil** : lotissement en lots de surfaces égales, reculs (uniformes ou avant/côtés/fond), déblai/remblai sur le MNT, profil en long d'une polyligne, coupe transversale (export CSV).
- **Échanges** : export/import DXF (R12 ASCII, unité mètre), plan PNG avec cartouche, export GeoJSON, sauvegarde locale avec le projet.

Commandes utiles : `ligne`, `pl`, `rec`, `c`, `dim`, `t`, `m`, `co`, `ro`, `sc`, `mi`, `o <distance>`, `exploser`, `lots <n>`, `retrait <d>`, `deblai`, `profil`, `coupe`, `dxf`, `png`, `aide`.

Limites : les volumes et profils reposent sur des altitudes **estimées** par un MNT mondial (précision verticale de plusieurs mètres) et ne remplacent pas un levé. L'import DXF ne gère ni les blocs, ni les splines, ni les hachures, et les DXF binaires. À l'export DXF, les accents sont retirés des noms de calques et des textes.

## Aide, tutoriels et exemples

Le bouton **?** en haut du panneau ouvre le centre d'aide :
- **13 tutoriels guidés** (interface, projet d'exemple, GPS, parcelle, mesure, bâtiments, relief, plan CAO, édition, lotissement, terrassement, échanges, collaboration). Chaque étape met le contrôle en évidence, donne un exemple, peut exécuter l'action (« le faire pour moi ») et se valide seule quand l'utilisateur la réalise. La progression est mémorisée.
- **Exemples** : projet fictif prêt à l'emploi (parcelle d'environ 4 000 m² à Kénitra, fiche et plan CAO), fichiers CSV, GeoJSON et DXF à importer, et scénarios pas à pas.
- **Aide-mémoire** des commandes CAO, de la saisie de coordonnées et des raccourcis clavier, et une **FAQ**.

Chaque section du panneau propose aussi un lien « Tutoriel ». Une carte de bienvenue s'affiche à la première visite.

## Performances et indicateurs

- La carte est rendue par la carte graphique (WebGL). Au démarrage, l'application détecte la carte graphique, le nombre de cœurs et la mémoire, puis choisit un profil (élevé, moyen ou économe) qui règle la densité de pixels, les caches et la finesse des calculs. Si la carte saccade, elle s'allège seule. Un **mode économie** est disponible dans « Import / export ».
- Les calculs lourds (décodage du MNT, courbes de niveau, lecture des DXF) tournent dans des **Web Workers**. Si les workers sont indisponibles, ils passent sur le fil principal, découpés en petites tranches.
- Le plan CAO utilise un index spatial et des caches géométriques. L'accrochage reste rapide avec des milliers d'objets, et la mémoire d'annulation est plafonnée.
- Chaque tâche longue s'affiche en haut à gauche de la carte, avec sa progression, le temps écoulé et un bouton **Annuler**. En cas d'échec ou de **délai dépassé**, un message explicite s'affiche avec **Réessayer** quand c'est possible.

## Collaboration en temps réel

La section **Collaboration** permet à plusieurs personnes de travailler sur le même projet. Le plan CAO, la parcelle, la fiche topographique, les imports, les points et les mesures sont synchronisés, et le curseur nommé de chaque participant s'affiche sur la carte.

| Mode | Fonctionnement | Serveur nécessaire |
|---|---|---|
| Pair-à-pair (code de session) | WebRTC direct entre navigateurs ; le service public PeerJS sert seulement à la mise en relation. Si l'hôte part, un invité reprend l'hébergement. | Non (service PeerJS public) |
| Pair-à-pair manuel | L'hôte envoie un code d'invitation, l'invité renvoie un code de réponse (messagerie, courriel). Aucun service tiers ; STUN public facultatif. | Non |
| Hybride | Pair-à-pair, plus un serveur de données qui conserve le projet, accueille les retardataires et sert de relais si la liaison directe échoue. | Oui |
| Centralisé | Tout passe par le serveur (WebSocket). Si le WebSocket est coupé, la synchronisation passe par des appels HTTP périodiques. | Oui |
| Onglets | Plusieurs onglets ou fenêtres du même appareil (BroadcastChannel), pour essayer ou faire une démonstration. | Non |

**Fusion des modifications** : chaque élément (objet CAO, calque, parcelle, champ de la fiche, import, point) porte une horodatation logique hybride. La modification la plus récente gagne, élément par élément. Deux personnes peuvent donc modifier des objets différents en même temps sans conflit. Un participant qui rejoint garde ses objets CAO et ses imports ; la parcelle et la fiche de la session sont conservées. Le lien d'invitation contient le code, le mode et l'adresse du serveur, jamais le jeton.

### Serveur de données de référence

```bash
node server/relay.mjs                        # http://localhost:8787 (sert aussi l'application)
PORT=9000 TOPOGIS_TOKEN=secret node server/relay.mjs
```

Le serveur ne dépend d'aucun paquet (Node.js 18 ou plus). Il enregistre chaque session dans `server/data/<CODE>.json`. Variables : `PORT`, `HOST`, `TOPOGIS_TOKEN` (jeton exigé), `TOPOGIS_DATA` (dossier des données), `TOPOGIS_CORS` (origine autorisée).

Protocole, à implémenter par tout autre serveur ou base de données :
- `GET /api/health` → `{ ok: true, name, version }`
- `WS /ws?room=CODE&peer=ID[&token=…]` : messages JSON `{ t: 'hello'|'ops'|'snap'|'pres'|'ping'|'bye', room, from, mid, … }`. À la connexion, le serveur envoie `snap` avec tous les éléments, puis relaie les messages aux autres clients de la session.
- `GET /api/rooms/CODE` → `{ seq, items: [{ k, v, ts, p }] }`
- `GET /api/rooms/CODE/ops?since=n` → `{ seq, ops }` ou `{ reset: true }`
- `POST /api/rooms/CODE/ops` avec `{ from, ops: [{ k, v, ts, p }] }` → fusion (la plus récente gagne) et relais.

Si la page est publiée en HTTPS (GitHub Pages), le serveur doit l'être aussi : passez par un proxy inverse avec certificat.

## Limites

Les données cartographiques et les bâtiments sont indicatifs. Ils doivent être vérifiés par un levé terrain ou par des données officielles
avant toute utilisation juridique, cadastrale ou administrative.

Données : © contributeurs OpenStreetMap (ODbL), AWS Terrain Tiles. Bibliothèques : MapLibre GL JS, Turf.js.
