# Spec — Mode Séquence (analyses tactiques animées)

> Statut : **V1 implémentée** (branche `feat/sequence-mode`).
>
> Décisions (2026-10-20) : export vidéo **option A** (capture image par image + `mediabunny`
> pour le muxage MP4), style cinéma **façon vidéo A** (sombre, accent or). La **3D n'est pas
> attendue** : la vidéo A servait de référence pour le fonctionnel tactique, pas pour le rendu.
> Sources : cahier des charges fonctionnel fourni (§1–16 ci-dessous en reprennent les exigences) +
> 3 vidéos de référence au format vertical 9:16, analysées image par image (annexe A).

## 1. Objectif

Faire évoluer Tactica11 pour **créer des analyses tactiques animées** : représenter une
situation de jeu avec deux équipes et le ballon, la découper en **étapes successives**,
dessiner les déplacements et les passes, ajouter des annotations pédagogiques, lire
l'action animée, puis la préparer (et si possible l'exporter) pour TikTok, Reels, Shorts
et YouTube.

Aujourd'hui l'app sait montrer *deux* états (défense ↔ attaque, ou début/milieu/fin d'une
phase arrêtée) et les animer en boucle (`useAutoplay`). Le mode Séquence généralise ça à
**N étapes enchaînées**, avec un habillage allant du sobre au cinématographique.

## 2. Contraintes

- **Travailler dans l'app existante** : on conserve son fonctionnement, son identité visuelle
  et toutes les fonctionnalités actuelles. On ne reconstruit pas, on ne remplace pas ce qui marche.
- **Pas de nouvelle technologie imposée** : React + Framer Motion + CSS + `html-to-image`, 100 %
  navigateur, sans backend. Toute dépendance supplémentaire doit être validée explicitement
  (cf. §13, export vidéo).
- **Réutiliser l'existant** : composants de token, `PitchMarkings`, `DrawingLayer`, `BallToken`,
  rendu 3D du Studio, `useAutoplay`, undo/redo, stockage local, export `.json`.
- **Honnêteté** : aucune fonctionnalité (en particulier l'export vidéo) n'est présentée comme
  opérationnelle si elle ne l'est pas réellement. Une limitation est affichée et expliquée,
  jamais simulée.
- **Priorité ordinateur** (création précise à la souris / au clavier), tout en restant lisible
  sur iPad et sur les autres tailles d'écran déjà gérées.

## 3. Bilan de l'existant

| Exigence | Existe déjà | À faire |
|---|---|---|
| **Terrain** (§4) : gazon rayé, lignes, buts, surfaces, rond central, proportions | ✅ `PitchMarkings`, ratio 68:105, portrait/paysage, 3D dans le Studio | Zoom / déplacement de la vue ; rester lisible à forte densité |
| **Joueurs** (§5) : déplacement libre, numéro, nom, poste | ✅ nos 11 (titulaires, numéros, rôles), drag au ressort | Gardien visuellement distinct ; couleur de notre équipe ; sélection multiple + déplacement groupé ; retirer ou ajouter un joueur dans une séquence |
| **Adversaires** (§5) | ⚠️ 11 posés d'un coup sur le terrain principal (ajout/retrait unitaire seulement en phase arrêtée), couleur réglable | Ajout / retrait unitaire dans une séquence ; gardien distinct ; nom optionnel |
| **Formations** (§6) | ✅ 11 formations (dont les 4 demandées), placement auto puis libre | Rien (on part de la compo) |
| **Flèches** (§7) | ⚠️ flèche pleine, pointillée, main levée, zone — ajout, annuler la dernière, tout effacer | Types sémantiques (passe, course, appel, défensif…) ; **courbes** ; **sélection, déplacement, édition et suppression** d'une flèche ; ancrage aux joueurs |
| **Ballon** (§8) | ⚠️ `BallToken` seulement sur le demi-terrain des phases arrêtées | Ballon sur terrain entier ; collé au pied d'un joueur ; passes animées le long d'une trajectoire |
| **Séquences** (§9) | ⚠️ 2–3 états fixes (défense/attaque, début/milieu/fin) | N étapes : ajouter, dupliquer, supprimer, réordonner, durées |
| **Lecture** (§10) | ⚠️ Play/Pause en aller-retour + vitesses (`useAutoplay`) | Début, étape précédente/suivante, reprise, lecture linéaire de N étapes |
| **Timeline** (§11) | ❌ | À créer |
| **Annotations** (§12) | ⚠️ zones d'influence, zones dessinées | Titres, sous-titres, bulles de texte, cercles, lignes, pressing, espaces, apparition à une étape donnée |
| **Rendu cinéma** (§13) | ⚠️ 3D statique dans le Studio | Caméra (zoom/cadrage par étape), focus/atténuation, effets, preset sobre / cinéma |
| **Formats** (§14) | ⚠️ Studio portrait/paysage au ratio du terrain | 9:16, 16:9, 1:1 ; aperçu sans interface |
| **Export** (§15) | ⚠️ PNG (`html-to-image`) | PNG par étape ; vidéo (cf. §15) |
| **Sauvegarde** (§16) | ✅ `localStorage` multi-compos, `.json` projet, lien partagé | Ajouter les séquences au modèle et aux fichiers |
| **Mode présentation** | ✅ plein écran, tiroir repliable | Réutilisé pour l'aperçu |

## 4. Terrain

- Rendu actuel conservé (gazon rayé, toutes les lignes, proportions réelles). On peut améliorer
  le gazon (dégradé, texture subtile), sans changer l'identité visuelle.
- **Vue entière ou zone précise** : zoom (molette / pincement / boutons ±) et déplacement
  (glisser sur une zone vide, ou barre d'espace + glisser), bouton « Recadrer tout ».
  La vue d'édition est indépendante de la **caméra** de la séquence (§13) : on peut zoomer
  pour placer précisément sans changer le cadrage du rendu final.
- **Lisibilité à forte densité** : ordre de superposition fixe (terrain < zones < lignes et
  flèches < ballon < joueurs < étiquettes < sous-titres), étiquettes avec fond contrasté,
  option masquer noms / numéros.

## 5. Joueurs et équipes

- **Nous** : les 11 slots de la compo (titulaire, numéro, poste, nom). **Adversaires** :
  disques à label libre (numéro) + nom optionnel.
- Dans une séquence, on peut **ajouter / retirer** un joueur de chaque équipe (situation à
  7 contre 6, par exemple). Retirer ne touche pas à la compo source.
- **Couleur d'équipe** réglable pour les deux camps (nous : nouveau ; eux : existe déjà).
- **Gardien distinct** : couleur propre par équipe (vidéo C : jaune / vert fluo).
- **Sélection** : clic = un joueur, `⇧`/`⌘`+clic ou rectangle de sélection = plusieurs ;
  déplacement groupé. Retour visuel net (anneau de sélection).
- **Précision** : déplacement aux flèches du clavier (pas fin, `⇧` = pas large), magnétisme
  optionnel sur la grille positionnelle existante.

## 6. Formations

Rien à créer. Une séquence part **d'une phase de la compo** (base, attaque ou défense) : on
reprend la formation, les positions, les adversaires et les dessins de cette phase, puis tout
reste libre. Bouton « appliquer une formation » sur l'étape courante pour repositionner un
bloc d'un coup.

## 7. Déplacements et flèches

### 7.1 Types sémantiques
Chaque type a un **style par défaut distinct** (couleur + motif), modifiable :

| Type | Style par défaut |
|---|---|
| Passe | pointillé fin, couleur ballon (blanc), pointe pleine |
| Course avec ballon | trait plein ondulé |
| Course sans ballon / déplacement | trait plein |
| Appel en profondeur | trait plein épais, accent (or) |
| Déplacement défensif / pressing | trait plein rouge |
| Permutation | double flèche courbe entre deux joueurs |
| Mouvement collectif | flèche large translucide (traînée, vidéo C) |

Course diagonale, latérale ou changement de position ne sont pas des types à part : c'est la
géométrie de la flèche.

### 7.2 Géométrie et édition
- **Droite ou courbe** : une courbe = un point de contrôle déplaçable au milieu (Bézier
  quadratique). Pointe orientée selon la tangente.
- **Ancrage** : départ et/ou arrivée attachés à un joueur → la flèche suit ses déplacements.
- **Édition** : clic = sélection (poignées visibles), glisser une poignée = modifier, glisser le
  corps = déplacer, `Suppr` = supprimer, inspecteur = type / couleur / épaisseur.
  **Ces mêmes capacités sont ajoutées au calque de dessin existant** du terrain principal
  (aujourd'hui limité à « annuler la dernière » / « tout effacer »).

## 8. Ballon et circulation

- Ballon **indépendant**, présent sur le terrain entier (on réutilise `BallToken`).
- Par étape : position libre **ou** « au pied de » un joueur (il suit le joueur pendant la
  transition, avec un léger décalage devant lui).
- **Passe** : si le porteur change entre deux étapes, le ballon voyage du joueur A au joueur B
  pendant la transition, le long de la flèche de passe si elle existe (droite ou courbe),
  sinon en ligne droite. Il part après le début de la transition et arrive au joueur B
  (pas à sa position de départ).
- **Circulation** : une suite d'étapes avec des porteurs successifs suffit ; option
  « tracer la trajectoire » pour laisser la traînée des passes visible.
- Différenciation visuelle passe / déplacement sans ballon / appel : via les types de §7.1.

## 9. Séquences

```
Séquence
 ├─ chapitres (optionnels : titre + segment de la barre de progression)
 └─ étapes (keyframes)
      ├─ positions : nos joueurs, adversaires, ballon (ou porteur)
      ├─ annotations visibles à cette étape
      ├─ caméra (cadrage)
      ├─ titre / sous-titre / commentaire
      ├─ focus / atténuation, effet plein écran (optionnel)
      └─ durée de maintien + durée et easing de la transition vers l'étape suivante
```

- Ajouter, modifier, **dupliquer**, supprimer et réordonner des étapes. « Nouvelle étape »
  **duplique l'étape courante** : on ne déplace que ce qui change. C'est l'action la plus fréquente,
  donc raccourci clavier `N`.
- Option « propager » : une correction de position s'applique aussi aux étapes suivantes
  qui avaient la même valeur.
- Plusieurs séquences par compo (ex. « sortie de balle », « pressing »).
- Exemple cible (cahier des charges) : position initiale → un joueur crée l'espace → appel →
  passe vers un 3ᵉ joueur → mouvement collectif → mise en évidence de l'espace → situation finale.

## 10. Lecture

- Commandes : **Lecture / Pause / Reprise**, **Retour au début**, **Étape précédente /
  suivante**, **vitesse** (0,5× / 1× / 1,5× / 2×, reprise de `AUTOPLAY_SPEEDS`), boucle
  optionnelle.
- Raccourcis : `Espace` lecture/pause, `←`/`→` étape précédente/suivante, `Home` début.
- Arrêt sur une étape = état exact défini par l'utilisateur.
- **Synchronisation** : joueurs, ballon, flèches (tracé progressif) et annotations sont tous
  calculés à partir d'**un seul temps t** → jamais de décalage.
- **Déterminisme** : pendant la lecture, les positions sont une interpolation des étapes
  (easing choisi), sans le ressort « libre » de Framer Motion, donc sans mouvement parasite.
- Durées par défaut pédagogiques : 1,2 s de transition et 1 s de maintien.

## 11. Timeline

Bande compacte sous le terrain (≈ 72 px, repliable) :

```
▶ ⏸ ⏮ ◀ ▶  1×   00:12 / 00:34        [Chap. 1         ][Chap. 2      ]
[É1 ▮▮▮]─tr─[É2 ▮▮]─tr─[É3 ▮▮▮▮]─tr─[É4]  [+]
```

- Une vignette par étape (miniature + numéro + nom), étape courante en surbrillance,
  tête de lecture.
- Clic = affiche immédiatement l'étape. Glisser = réordonner. Bord droit d'un bloc =
  durée de maintien ; bloc entre deux étapes = durée de la transition (affichée en secondes,
  modifiable aussi dans l'inspecteur).
- Scrub sur la timeline = aperçu de la transition (comme le slider actuel).

## 12. Annotations et explications

Chaque annotation a une **durée de vie** : elle apparaît à l'étape *i* et disparaît après
l'étape *j*, avec un fondu, un tracé progressif ou un pop. Elle peut être **ancrée** à des
joueurs (elle suit leurs mouvements) ou à un point du terrain. Toutes sont sélectionnables,
déplaçables, modifiables et supprimables.

| Annotation | Ancrage | Exemple (vidéos) |
|---|---|---|
| Titre / sous-titre de séquence | écran | « PSG · Luis Enrique » |
| Sous-titre d'étape (commentaire) | écran, bas | phrase de la voix off ; option karaoké |
| Texte explicatif / bulle | joueur ou point | « 4 CONTRE 3 », « LIBRE », « ◀◀ RETOUR » |
| Nom / numéro | joueur | déjà sur les tokens ; affichage forçable |
| Zone colorée libre | points | rectangle rouge « TROU » |
| Zone liée aux joueurs | liste de joueurs | triangle, losange qui suivent les joueurs |
| Cercle de mise en évidence | joueur ou point | cercle rouge, halo doré |
| Ligne de séparation / hauteur | y ou x fixe | « HAUTEUR DES ATTAQUANTS » |
| Ligne de joueurs | liste de joueurs | ligne défensive à 4 |
| Pressing | joueur → joueur | flèche rouge courte + cône |
| Marquage | joueur ↔ adversaire | trait fin ; croix si cassé ; « ? » au-dessus |
| Espace libre / à attaquer | points | zone hachurée verte |
| Position fantôme | auto (étape précédente) | cercle pointillé + flèche pointillée |

**Mise en évidence temporaire** : focus sur un ou plusieurs joueurs (halo), **atténuation**
des autres (vidéo C), effet de flash ou de vignette colorée (vidéo A).

## 13. Rendu visuel et caméra

- **Deux presets**, puis chaque réglage reste ajustable :
  - *Tactique sobre* : 2D vue de dessus, sans caméra animée ni effets, couleurs franches (vidéo C).
  - *Cinéma* : 3D inclinée, zooms et cadrages, halos, flashs, sous-titres karaoké, barre de
    chapitres (vidéo A).
- **Caméra par étape** : centre + zoom, réglés en déplaçant un cadre directement sur le terrain ;
  « cadrer sur la sélection ». Interpolation fluide entre étapes.
- **3D** : on réutilise la perspective CSS du Studio. Joueurs, ballon, flèches et zones sont
  dessinés dans le même plan transformé, donc cohérents par construction. Les étiquettes
  restent face caméra.
- **Hiérarchie visuelle** : terrain atténué < zones translucides < trajectoires < joueurs <
  textes. Les effets ne masquent jamais l'action : les flashs sont semi-transparents et en bordure,
  et aucun texte géant ne s'affiche pendant un mouvement.

## 14. Formats et aperçu

- **9:16** (défaut), **16:9**, **1:1**. Le format définit le cadre de rendu. La caméra cadre
  dans ce cadre. Des **zones de sécurité** (marges réservées à l'interface TikTok/Reels) sont
  affichées en option dans l'éditeur.
- En 9:16, le terrain est en portrait ; en 16:9, en paysage. Le 1:1 accepte les deux
  orientations.
- **Aperçu** : bouton « Aperçu » → plein écran (mode présentation existant) avec uniquement
  le rendu destiné au public, sans panneaux ni poignées, lecture depuis le début.

## 15. Export

| Export | Statut visé |
|---|---|
| PNG de l'étape courante (au format choisi, sans interface) | V1 — `html-to-image`, déjà dans l'app |
| `.json` (projet incluant les séquences) | V1 — existant, à étendre |
| Vidéo | voir ci-dessous |

### Vidéo — décision à prendre
Le rendu vidéo doit capturer l'aperçu image par image, sans l'interface. Comme la lecture est
calculée depuis un temps *t* (§10), on peut rendre n'importe quel instant à la demande.
Trois options :

| Option | Nouvelle techno ? | Qualité | Limites |
|---|---|---|---|
| **A. Capture image par image** : rendu de *t* → `html-to-image` → `VideoEncoder` (WebCodecs, API navigateur) → muxer MP4/WebM | **1 petite dépendance** (muxer, ex. `mp4-muxer`) | Parfaite, résolution fixe (1080×1920, 4K possible), 30/60 fps sans saccade | Lent : env. 50–200 ms par image, soit 1,5 à 6 min pour 60 s à 30 fps (barre de progression). Encodeur H.264 absent de certains Firefox → WebM |
| **B. Enregistrement temps réel** : `MediaRecorder` sur la capture de l'onglet (`getDisplayMedia`, recadrée sur l'aperçu) | Aucune | Dépend de la taille d'écran, saccades possibles | Demande de permission de partage d'écran, recadrage fiable surtout sur Chrome/Edge |
| **C. Pas d'export vidéo intégré** | Aucune | — | L'utilisateur enregistre l'aperçu plein écran avec un outil externe (OBS, enregistreur macOS/iOS) |

**Recommandation : A**, car c'est la seule option qui donne un résultat propre et reproductible. C est le repli
sans dépendance : l'aperçu plein écran est conçu pour être enregistré tel quel. Tant que
l'export vidéo n'est pas réellement opérationnel, le bouton n'apparaît pas.

Options d'export vidéo (option A) : 1080×1920 / 1920×1080 / 1080×1080 (4K en V2),
30 ou 60 fps, fond normal ou **chroma vert** (V2 : transparent en WebM alpha, pour incruster
sur une face-cam comme dans la vidéo C).

## 16. Sauvegarde

Les séquences sont stockées dans le `Project`, donc dans la sauvegarde locale et l'export/import
`.json` existants, avec rétrocompatibilité (`videoSequences` absent = aucune séquence).
Tout est conservé : joueurs ajoutés ou retirés et leurs réglages, positions, ballon/porteur,
flèches, annotations, étapes, durées, easings, caméra, format, preset et réglages
d'habillage. Les séquences sont **exclues du lien de partage par URL** (trop long), et l'interface
le signale.

Undo/redo : les modifications d'une séquence passent par l'historique existant
(`useUndoableLineup`, ou un équivalent au niveau du projet).

## 17. Expérience utilisateur

Nouvel onglet **« Séquence »** dans `ViewTabs`, à côté de Terrain / Effectif / Phase arrêtée.

```
┌──────────────────────────────────────────────┬─────────────────┐
│ Outils : sélection · flèches (types) · ballon│ Inspecteur      │
│          annotations · caméra                │ (élément choisi │
├──────────────────────────────────────────────┤  ou étape)      │
│                                              │                 │
│        Terrain dans le cadre du format       │                 │
│        (zoom/déplacement de la vue)          │                 │
│                                              │                 │
├──────────────────────────────────────────────┴─────────────────┤
│ Timeline (§11)                                                 │
└────────────────────────────────────────────────────────────────┘
```

- Mêmes composants, couleurs et typographies que le reste de l'app ; thème clair/sombre.
- Retour visuel immédiat : sélection, position modifiée (fantôme de l'étape précédente
  visible pendant l'édition), changement d'étape.
- Pas d'animations décoratives dans l'éditeur. Les animations « cinéma » sont réservées au rendu.

## 18. Modèle de données (esquisse)

```ts
interface Sequence {
  id: string;
  name: string;
  lineupId: string;              // compo source
  sourcePhase: Phase;
  format: "9:16" | "16:9" | "1:1";
  preset: "sober" | "cinema";
  view: "2d" | "3d";
  theme: SequenceTheme;          // couleurs équipes/gardiens, accent, fond, logo, police
  extraPlayers: SeqPlayer[];     // joueurs ajoutés (les deux équipes)
  removedIds: string[];          // slots/adversaires retirés de cette séquence
  chapters: { id: string; title: string; firstStepId: string }[];
  steps: SequenceStep[];
  annotations: Annotation[];
  title?: string;
  subtitle?: string;
  outro?: { text: string; subtext?: string };
}

interface SequenceStep {
  id: string;
  name?: string;
  positions: Record<string /*entityId*/, Pos>;
  ball: { pos: Pos } | { carrierId: string };
  camera: { x: number; y: number; zoom: number };
  caption?: string;
  karaoke?: boolean;
  focus?: { ids: string[]; dimOthers: boolean; color?: string };
  effect?: { kind: "flash" | "bigText"; color?: string; text?: string };
  holdMs: number;
  transitionMs: number;
  easing: "linear" | "easeInOut";
}

type Anchor = { pos: Pos } | { entityId: string };

interface Annotation {
  id: string;
  kind: "pass" | "dribble" | "run" | "deepRun" | "defensive" | "swap" | "collective"
      | "zone" | "playerZone" | "circle" | "line" | "playerLine" | "pressing"
      | "marking" | "space" | "label" | "ghost";
  anchors: Anchor[];
  control?: Pos;                 // point de contrôle d'une courbe
  text?: string;
  color: string;
  fromStepId: string;
  toStepId: string;
  appear: "fade" | "draw" | "pop";
}
```

## 19. Découpage

**V1 — tactique sobre, complète (couvre les critères 1 à 11)**
- Onglet Séquence, création depuis une phase de compo, deux équipes, ajout/retrait, gardiens
  distincts, sélection multiple.
- Étapes (CRUD, duplication, réordonnancement, durées), timeline, lecture complète.
- Ballon (libre / porteur / passes animées).
- Flèches typées, droites et courbes, éditables ; ancrage joueurs.
- Annotations : sous-titre d'étape, bulle, zone libre, zone liée aux joueurs, cercle, ligne,
  fantôme ; focus et atténuation.
- Zoom et déplacement de la vue d'édition ; formats 9:16 / 16:9 / 1:1 ; aperçu plein écran ;
  export PNG de l'étape ; sauvegarde complète.
- Bonus : sélection, édition et suppression des dessins du terrain principal.

**V2 — preset cinéma + export vidéo (critère 12)**
- Caméra par étape, 3D, chapitres et barre de progression, karaoké, effets, carton de fin,
  annotations restantes (pressing, marquage, espace, ligne de joueurs, traînée, permutation).
- Export vidéo selon l'option retenue au §15.

**V3 — pistes**
- Piste audio (voix off importée) et calage des étapes dessus.
- Photos de joueurs dans les disques, bandeau de score, modèles de séquence.

## 20. Critères de validation

Terminé seulement quand on peut **réellement**, dans l'app, vérifié à la main :

1. Créer une situation tactique avec deux équipes.
2. Déplacer et personnaliser les joueurs.
3. Dessiner des passes et des déplacements.
4. Positionner et animer le ballon.
5. Construire une séquence en plusieurs étapes.
6. Lire, mettre en pause et parcourir l'animation.
7. Contrôler les durées et les transitions.
8. Ajouter des annotations pédagogiques.
9. Prévisualiser le résultat final.
10. Sauvegarder et rouvrir son analyse.
11. Préparer une composition adaptée aux réseaux sociaux.
12. Exporter le résultat, si l'export est disponible et réellement intégré (sinon, la limitation est
    affichée clairement).

Et sans régression : terrain, effectif, phases arrêtées, Studio, partage et undo/redo
fonctionnent comme avant.

## 21. État de l'implémentation

Livré :
- Onglet **Séquence** : création depuis base / attaque / défense, plusieurs séquences par compo,
  dupliquer / supprimer, données dans la compo (undo/redo, sauvegarde locale, `.json` projet ;
  exclues des liens de partage).
- Étapes : ajout par duplication (`N`), suppression, réordonnancement (glisser dans la timeline
  ou boutons), durées de transition / maintien, easing.
- Deux équipes : ajout / retrait de joueurs, nom, numéro, gardien, couleurs ; sélection multiple
  (⇧+clic, rectangle), déplacement groupé, flèches du clavier, option « propager ».
- Ballon : libre ou au pied d'un joueur ; changement de porteur = passe animée (suit la courbe de
  la flèche de passe si elle existe).
- Flèches typées (passe, course, conduite, appel, pressing), droites ou courbes, ancrées aux
  joueurs, éditables (poignées, déplacement, suppression).
- Annotations : zone, espace hachuré, zone liée aux joueurs, ligne de joueurs, marquage, cercle,
  ligne (+ texte), bulle de texte ; visibilité de l'étape i à j, apparition progressive.
- Fantômes, mise en avant + atténuation, flash, mot géant, chapitres + barre de progression,
  sous-titres avec karaoké.
- Caméra par étape (outil caméra, zoom, « cadrer la sélection »), zoom / déplacement de la vue
  d'édition (molette, ±, Espace+glisser).
- Formats 9:16 / 16:9 / 1:1 (terrain vertical ou paysage), zones masquées TikTok/Reels.
- Style cinéma unique qui suit le thème de l'app : cinéma sombre / cinéma clair (le style
  « tactique sobre » a été retiré, jugé inutile).
- Lecture (début, préc., suiv., vitesse, boucle, scrub), aperçu plein écran sans interface.
- Export PNG de l'instant affiché ; export **MP4** (1080p ou 4K, 30/60 i/s, fond vert), bouton
  masqué si le navigateur n'a pas WebCodecs.

Pas fait (hors V1) :
- Rendu 3D (abandonné, cf. décisions).
- Sélection / édition des dessins du **terrain principal** (bonus §19).
- Permutation (double flèche) et traînées de mouvement collectif.
- Piste audio, photos de joueurs, bandeau de score (V3).

## 22. Questions ouvertes (initiales)

1. **Export vidéo** : option A (une petite dépendance de muxer), B ou C ? (§15)
2. **Style par défaut** du preset cinéma : sombre premium (vidéo A) ou vert flashy (vidéo C) ?
3. **Phases arrêtées** : faut-il pouvoir créer une séquence sur demi-terrain à partir d'une
   phase arrêtée ?
4. **Édition des dessins du terrain principal** (sélection, déplacement, suppression) : dans la V1 comme
   proposé, ou séparément ?

---

## Annexe A — Vidéos de référence

### A. « L'Instant Football » (PSG, Luis Enrique, 68 s) — animation pure, style cinéma
- Terrain 3D incliné, fond vert sombre, bandeau autour du terrain.
- Caméra animée : plan large ↔ zooms serrés, pan fluide.
- Chapitres en haut à gauche (« LA COMPO », « LE DILEMME », « LE LOSANGE », « LE TRIANGLE »…)
  + barre de progression segmentée façon stories.
- Sous-titres karaoké (mot courant surligné or).
- Disques blancs (nous) / noirs (eux), numéro + étiquette nom ; joueur clé doré avec halo.
- Positions fantômes + flèches pointillées ; triangle et losange liés aux joueurs ; flèches
  courbes de rotation ; bulles (« AVANT-CENTRE », « 4 CONTRE 3 », « LIBRE », « ◀◀ RETOUR ») ;
  cercle rouge ; zone « TROU » ; ligne « HAUTEUR DES ATTAQUANTS » ; marquages avec croix et « ? » ;
  label « 4-3-3 ».
- Flash/vignette rouge, mot géant « GÉNIE », faisceaux lumineux, carton de fin avec question.

### B. Démo d'un logiciel desktop concurrent (17 s) — workflow
Formation + noms → mouvements individuels sur plusieurs frames (barre de frames en bas) →
formes sur les moments clés → export 4K. Confirme le modèle étapes + interpolation.

### C. « Kick Off » (City / Liverpool, 98 s) — face-cam + incrustation, style sobre
- Terrain 2D vert vif en incrustation sur la face-cam floutée, puis plein écran.
- Disques rouges / bleus avec badge de poste ou photo, nom au-dessus, gardiens d'une autre couleur.
- Ballon animé ; zone jaune reliant des joueurs ; ligne défensive ; traits de marquage ;
  traînées de mouvement translucides ; atténuation des joueurs hors action ; score incrusté.
