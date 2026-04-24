# Mon Simulateur Vélo — Collserola

Simulateur 2D d'un voyage à vélo autour de Barcelone et du massif de Collserola
(Tibidabo, Vallvidrera, Coll de l'Erola), inspiré des trackers de mission
spatiaux.

## Lien conceptuel avec Artemis II

L'interface emprunte le vocabulaire et les codes visuels des centres de
contrôle de mission — notamment Artemis II :

- **MET** (*Mission Elapsed Time*) : temps écoulé depuis le départ, affiché
  au format `T+ DDD:HH:MM:SS`.
- **HUD vert terminal** (`#00ff88`) inspiré des consoles historiques.
- **Phases de mission** : `MISE EN SELLE`, `ASCENSION`, `CROISIÈRE`,
  `DESCENTE`, `ARRIVÉE`.
- **Équipage** (*crew*) listé comme une équipe d'astronautes.
- **Événements** marqués sur la timeline comme des jalons de vol.

## Setup

```bash
npm install     # installe les dépendances
npm run dev     # lance le serveur en mode watch (tsx)
npm run build   # compile TypeScript vers dist/
npm test        # exécute les tests Vitest
npm start       # démarre le serveur compilé (dist/server.js)
```

Le serveur écoute sur le port **3100** par défaut (override via `PORT=...`).

## Structure du projet

```
mon-simulateur-velo/
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── data/
│   └── trajet.gpx              # trajectoire GPX source
├── src/                        # code serveur TypeScript
│   ├── orbital-math.ts         # haversine, interpolation, MET, projection
│   ├── gpx.ts                  # parsing du fichier GPX
│   ├── telemetry.ts            # série temporelle (vitesse, FC, phase)
│   ├── events.ts               # événements de mission
│   ├── crew.ts                 # équipage
│   └── server.ts               # Express + endpoints REST
├── public/                     # frontend statique
│   ├── index.html
│   ├── style.css
│   └── main.js                 # Two.js, HUD, timeline, caméras
└── tests/
    ├── orbital-math.test.ts
    └── trajectory.test.ts
```

## Conventions de rendu 2D

### Coordonnées

- Les points GPS (`lat`, `lon`) sont convertis en coordonnées écran par une
  projection equirectangulaire centrée sur le milieu de la zone (`gpsToScreen`
  dans `orbital-math.ts`).
- L'axe **x** croît vers l'est, l'axe **y** vers le bas (convention canvas).
- La trace complète est cadrée dans la stage Two.js avec une marge interne
  (`padding = 80 px`).

### Échelle

- L'interpolation produit exactement **500 points** régulièrement espacés en
  distance (pas en temps ni en coordonnées brutes).
- Le MET est calibré pour que la durée totale approche **T+333 minutes**
  (constante `TARGET_TOTAL_SEC` dans `telemetry.ts`).

### Couleurs

| Usage                        | Couleur     |
| ---------------------------- | ----------- |
| HUD / terminal / cycliste    | `#00ff88`   |
| Trace complète (non fait)    | `#e2e8f0` à 25 % |
| Portion parcourue            | `#00ff88`   |
| Panneau événements (fond)    | `#111827cc` |
| Panneau événements (bord)    | `#1e3a5f`   |
| Marqueur départ              | `#00ff88`   |
| Marqueur arrivée             | `#f87171`   |
| Marqueur ravitaillement      | `#fbbf24`   |
| Marqueur col                 | `#60a5fa`   |
| Marqueur photo               | `#c084fc`   |
| Marqueur mécanique           | `#fb923c`   |

## Données de mission

La trajectoire vient d'un fichier **GPX** standard placé dans `data/trajet.gpx`.
Seules les balises `<trkpt lat lon>` avec éventuellement `<ele>` sont lues.
La distance cumulée est recalculée à chaque chargement via la formule de
haversine sur le rayon moyen de la Terre (6 371 km).

## Format des événements

Les événements sont définis dans `src/events.ts` :

```ts
{
  id: 'col-tibidabo',
  type: 'col',            // depart | ravito | col | photo | mecanique | arrivee
  icon: '🏔️',             // émoji affiché dans le panneau
  label: 'Sommet du Tibidabo',
  description: 'Point culminant du parcours (512 m).',
  progress: 0.58          // position sur la trace (0 = départ, 1 = arrivée)
}
```

Les champs `distance`, `met`, `lat`, `lon`, `ele` sont résolus automatiquement
à partir de la télémétrie.

### Ajouter un événement

1. Ouvrir `src/events.ts`.
2. Ajouter une entrée au tableau `DEFAULT_EVENTS` avec un `id` unique, un
   `type`, un `icon`, un `label`, une `description`, et un `progress` ∈ [0, 1].
3. Redémarrer le serveur (`npm run dev` redémarre automatiquement).

## Remplacer le GPX

1. Placer un fichier GPX v1.1 dans `data/trajet.gpx` (remplace le fichier
   existant).
2. S'assurer qu'il contient au moins 2 points dans une `<trkseg>`.
3. Les altitudes `<ele>` sont optionnelles ; à défaut, l'altitude vaut 0.
4. Redémarrer le serveur.

Le simulateur recalibrera automatiquement :

- la distance totale (via haversine) ;
- le MET pour viser ~T+333 min ;
- la position des événements selon leur `progress`.

## Contribuer avec des données réelles

Lorsque des traces GPX issues de sorties réelles seront disponibles :

1. Les déposer dans `data/` avec un nom explicite, par exemple
   `data/2026-05-12-sortie-tibidabo.gpx`.
2. Mettre à jour `GPX_PATH` dans `src/server.ts` ou ajouter un endpoint
   paramétrable si plusieurs trajets doivent coexister.
3. Adapter les `progress` des événements dans `src/events.ts` au tracé réel.
4. Compléter `src/crew.ts` avec les `lienLinkedIn` des membres présents — ce
   champ est optionnel et **aucun scraping automatique n'est effectué**.
5. Lancer `npm test` pour vérifier que la distance totale reste dans la
   fourchette admise et que les points clés sont cohérents.

## API

| Méthode | Route                       | Description                                 |
| ------- | --------------------------- | ------------------------------------------- |
| GET     | `/api/trajectory`           | Trajectoire complète (500 échantillons)     |
| GET     | `/api/events`               | Tous les événements de mission              |
| GET     | `/api/events/upcoming?met=` | Événements à venir après un MET donné       |
| GET     | `/api/telemetry/current?met=` | Télémétrie interpolée à un MET            |
| GET     | `/api/telemetry/:met`       | Variante path-param de la ligne précédente  |
| GET     | `/api/crew`                 | Équipage du voyage                          |
| GET     | `/api/health`               | Health check                                |
