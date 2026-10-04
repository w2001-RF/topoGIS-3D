# TopoGIS 3D

Outil de relevé et d'analyse topographique : GPS, bâtiments OpenStreetMap, parcelles, mesures, relief, courbes de niveau et profil altimétrique.
L'application tient dans un seul fichier, `index.html`. Aucun serveur, aucune compilation, aucune clé API obligatoire.

## Arborescence

```
topoGIS-3D/
├── index.html                    # toute l'application (HTML + CSS + JavaScript)
├── .nojekyll                     # désactive Jekyll sur GitHub Pages
├── .github/workflows/pages.yml   # déploiement automatique (facultatif)
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

## Limites

Les données cartographiques et les bâtiments sont indicatifs. Ils doivent être vérifiés par un levé terrain ou par des données officielles
avant toute utilisation juridique, cadastrale ou administrative.

Données : © contributeurs OpenStreetMap (ODbL), AWS Terrain Tiles. Bibliothèques : MapLibre GL JS, Turf.js.
