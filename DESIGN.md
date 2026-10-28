---
name: Tactica11
description: Console de travail pour composer, phaser et raconter des mises en place tactiques de football.
colors:
  graphite-ground: "#16191d"
  graphite-panel: "#1c1f24"
  graphite-seam: "#2e333a"
  segment-raised: "#2b3037"
  ink: "#e6e9ed"
  ink-dim: "#959ca6"
  selection-blue: "#79a9f9"
  selection-blue-fill: "#2f6fe4"
  on-accent: "#ffffff"
  confirm-green: "#238636"
  confirm-green-hover: "#2a9a3f"
  on-primary: "#ffffff"
  doubt-amber: "#d29922"
  danger-red: "#e5534b"
  light-paper-ground: "#f2f3f5"
  light-panel: "#ffffff"
  light-seam: "#dadde1"
  light-ink: "#16191d"
  light-ink-dim: "#5d646e"
  light-selection-blue: "#2563d9"
  light-confirm-green: "#1f7f35"
  light-confirm-green-hover: "#238f3c"
  light-doubt-amber: "#9a6700"
  light-danger-red: "#cf222e"
typography:
  title:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.01em"
    fontFeature: "\"cv11\", \"ss01\""
  body:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "\"cv11\", \"ss01\""
  control:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
    fontFeature: "\"cv11\", \"ss01\""
  label:
    fontFamily: "Inter Variable, Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.08em"
  figure:
    fontFamily: "JetBrains Mono Variable, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "\"tnum\""
rounded:
  sm: "4px"
  md: "6px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button:
    backgroundColor: "rgba(255, 255, 255, 0.05)"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "11px"
  button-hover:
    backgroundColor: "rgba(255, 255, 255, 0.10)"
  button-primary:
    backgroundColor: "{colors.confirm-green}"
    textColor: "{colors.on-primary}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.confirm-green-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.sm}"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.sm}"
  button-destructive-hover:
    backgroundColor: "transparent"
    textColor: "{colors.danger-red}"
  input:
    backgroundColor: "rgba(255, 255, 255, 0.05)"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "32px"
    padding: "0 10px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    typography: "{typography.control}"
    height: "44px"
  tab-active:
    textColor: "{colors.ink}"
  segment:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "6px 16px"
  segment-active:
    backgroundColor: "{colors.segment-raised}"
    textColor: "{colors.ink}"
  panel:
    backgroundColor: "{colors.graphite-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  panel-header:
    textColor: "{colors.ink-dim}"
    typography: "{typography.label}"
    padding: "12px 16px 10px"
    height: "41px"
  menu:
    backgroundColor: "{colors.graphite-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px"
  top-bar:
    backgroundColor: "{colors.graphite-panel}"
    padding: "8px 16px"
    height: "52px"
---

# Design System: Tactica11

## Overview

**Creative North Star: "La console graphite"**

Tactica11 se lit comme un poste de travail, pas comme une vitrine. Les zones (barre du haut, rangée d'onglets, effectif à gauche, terrain au centre, propriétés de la sélection) sont posées bord à bord et séparées par des coutures de 1px ; aucune ne flotte, aucune ne brille. L'utilisateur doit savoir où se trouve chaque chose avant de remarquer un style.

La couleur de l'interface ne décore jamais : elle signifie un état. Bleu pour la sélection, vert pour l'action principale ou confirmée, ambre pour l'incertain, rouge pour le destructif ou le blessé. Toute la couleur tactique (maillots, flèches, zones) vit sur le terrain, qui est la seule surface colorée de l'écran ; c'est ce contraste qui la rend lisible instantanément. Le système refuse explicitement le défaut de la catégorie : verre sombre lumineux, accent néon, boutons pilule.

La densité est celle d'un outil : lignes serrées, trois tailles de texte, chiffres en mono tabulaire dans des cellules fixes. Sombre d'abord, avec un jumeau clair sur gris papier froid qui suit exactement la même structure. Le tactile iPad est un mode de premier rang : les cibles restent confortables au doigt (bascules et pastilles agrandies en pointeur grossier).

**Périmètre.** Ce système couvre le chrome de l'app. Le terrain (gazon, lignes, pastilles joueurs, marqueurs de phases arrêtées, flèches) et les rendus d'export (poster Studio dans `src/studio/`, vidéo et PNG de Séquence via `src/sequence/SequenceStage.tsx`) gardent leurs propres couleurs fixes, indépendantes du thème, et ne relèvent pas de ces tokens.

**Key Characteristics:**
- Panneaux plats bord à bord, séparés par des coutures de 1px, une seule marche d'élévation.
- La couleur du chrome porte uniquement un état ; le terrain est la seule surface colorée.
- Trois tailles de texte (11 / 13 / 15px), Inter pour l'interface, JetBrains Mono pour les chiffres seulement.
- Rayons de 4px (contrôles, menus) et 6px (panneaux flottants, modales) ; pas de pilules, de dégradés, de verre ni de halos dans le chrome.
- Icônes dessinées sur une grille de 16px, trait 1,6, couleur courante.

## Colors

Un graphite neutre à deux marches, et quatre couleurs d'état qui n'apparaissent que lorsqu'un état existe.

### Primary
- **Bleu sélection** (texte `selection-blue`, aplat `selection-blue-fill`) : l'onglet actif (soulignement de 2px), l'anneau de focus clavier, la bordure d'un champ en saisie, l'outil actif, la sélection de texte et le curseur. La teinte texte est assez claire pour rester lisible sur le panneau ; l'aplat plus profond porte du texte blanc (`on-accent`). Les teintes translucides de sélection dérivent de #4C8DF6 (`--accent-rgb`).

### Secondary
- **Vert confirmé** (`confirm-green`, survol `confirm-green-hover`) : l'action principale d'un contexte et elle seule : Partager, Ajouter, Exporter, l'appel à l'action de la barre Séquence. Texte blanc.

### Tertiary
- **Ambre incertain** (`doubt-amber`) : joueur douteux, état non confirmé.
- **Rouge destructif** (`danger-red`) : joueur blessé ou suspendu, erreurs, et la couleur d'intention des actions destructives au survol ou au focus.

### Neutral
- **Sol graphite** (`graphite-ground`) : le fond de l'app, visible autour du terrain.
- **Panneau graphite** (`graphite-panel`) : la seule marche d'élévation ; barres, panneaux, menus, modales.
- **Couture** (`graphite-seam`) : toutes les séparations de 1px, bordures de contrôles, en-têtes de panneaux.
- **Segment levé** (`segment-raised`) : le segment actif d'un contrôle segmenté (Base / Attaque / Défense).
- **Encre** (`ink`) et **encre atténuée** (`ink-dim`) : texte principal ; libellés, en-têtes, états inactifs.
- **Voiles neutres** : les fonds de contrôles et de survol sont des voiles de 5 à 10 % de `--overlay-rgb` (blanc sur sombre, encre sur clair), pour que les mêmes règles servent les deux thèmes.
- **Jumeau clair** : chaque rôle a son équivalent `light-*` (sol papier gris froid, panneaux blancs, coutures `light-seam`) ; les couleurs d'état sont assombries pour tenir le contraste sur blanc.

### Named Rules
**The State-Only Colour Rule.** Dans le chrome, une couleur saturée signifie un état (sélection, confirmé, incertain, destructif) ou rien. Aucune couleur n'est choisie pour l'ambiance.

**The One Coloured Surface Rule.** Le terrain est la seule surface colorée de l'écran. Les couleurs d'équipe, de flèches et de zones restent sur le terrain et dans les exports ; elles ne remontent pas dans les panneaux, sauf dans le sélecteur de couleur lui-même.

**The Single Green Rule.** Un seul bouton vert par contexte : l'action principale. Partager occupe la même place à droite de la barre sur chaque onglet.

## Typography

**Display Font:** aucune ; l'outil n'a pas de titre d'affichage.
**Body Font:** Inter Variable (repli system-ui), auto-hébergée, variantes `cv11` et `ss01`.
**Label/Mono Font:** JetBrains Mono Variable (repli ui-monospace), auto-hébergée, chiffres tabulaires.

**Character:** Une grotesque neutre et compacte pour tout ce qui se lit, une mono réservée aux chiffres pour que numéros, compteurs, coordonnées et durées s'alignent en colonnes.

### Hierarchy
- **Title** (650, 15px, approche -0,01em) : nom de marque dans la barre, titres de modales, indications majeures.
- **Body** (500, 13px, 1,4) : noms de joueurs, contenu des listes et des champs. Le corps de base est à 13px.
- **Control** (600, 13px) : boutons, onglets, segments, éléments de menu.
- **Label** (600, 11px, capitales, 0,08em) : en-têtes de panneaux (Disponibles, Projet, Compo), en-têtes de colonnes, titres de groupes dans les menus et inspecteurs. Toujours en encre atténuée.
- **Figure** (JetBrains Mono, 500, 11 ou 13px, tabulaire) : numéros de maillot, compteurs d'en-tête, durées, pourcentages, coordonnées.

### Named Rules
**The Three Sizes Rule.** Le chrome n'utilise que 11, 13 et 15px. Trois exceptions sont admises parce qu'elles ne sont pas du texte de chrome : le marqueur de phase arrêtée sur le terrain (10px), la flèche de tri du tableau Effectif (8px) et l'illustration de l'accueil (38px).

**The Figures-Only Mono Rule.** La mono ne sert qu'aux chiffres. Un mot en mono est une erreur.

## Layout

Un pavage de console : `.app` empile barre du haut, rangée d'onglets et zone de travail sans marge ni espace entre elles ; les panneaux pavés perdent leur forme de carte (rayon 0) et ne gardent qu'une couture à droite ou en bas.

- **Barre du haut** : 52px de haut, marges de 16px, marque à gauche, champs Projet / Compo, puis annuler / rétablir, Studio et Partager à droite. Le contrat visait 44 à 48px ; le build livre 52px et c'est la valeur de référence.
- **Rangée d'onglets** : 44px, onglets Compo / Effectif / Phase arrêtée / Séquence à gauche (espacés de 18px, soulignement de 2px), système et contrôle segmenté Base / Attaque / Défense centrés au-dessus du terrain.
- **Zone de travail** : grille à deux colonnes, panneau de 260px à gauche puis le terrain, centré à hauteur maximale.
- **Rythme** : pas de 6 / 8 / 12 / 16px ; en-têtes de panneau 12px 16px 10px, corps de panneau 12px 16px 16px, menus 6px de padding intérieur avec 2px entre les éléments.
- **Responsive** : sous 900px (iPad portrait), le panneau passe à 240px, la rangée d'onglets s'enroule, les libellés de champs et le nom de marque disparaissent, les noms longs finissent en ellipse. Sous 1180px la barre du haut se compacte ; la barre Séquence réduit ses outils à des icônes quand la place manque. En pointeur grossier, bascules et pastilles s'agrandissent. Le téléphone (390px) n'est pas une cible produit ; sa mise en page est antérieure à ce système.
- **Mode présentation** : le terrain occupe la fenêtre, avec un seul rail d'outils repliable.

## Elevation & Depth

Plat par défaut. La profondeur des zones de travail vient d'une seule marche tonale (sol puis panneau) et des coutures de 1px, jamais d'ombres. Seules les surfaces qui flottent réellement au-dessus du travail (modales, popovers d'emplacement, menus déroulants, barre de dessin, panneau d'outils de présentation) portent une ombre douce et décalée vers le bas. Les états levés à l'intérieur d'un contrôle (segment actif) utilisent un fond plus clair et un filet intérieur de 1px, pas une ombre portée.

### Shadow Vocabulary
- **Ombre flottante** (`--shadow-pop`) : la seule ombre du chrome ; plus dense en sombre, très légère en clair. Valeurs exactes dans le sidecar.
- **Filet intérieur** (`inset 0 0 0 1px` couture ou bleu sélection) : segment levé, élément sélectionné.

### Named Rules
**The Floating-Only Shadow Rule.** Une ombre signifie « posé au-dessus du travail ». Un panneau pavé n'en porte jamais.

## Shapes

Des coins doucement cassés, jamais ronds. 4px (`rounded.sm`) pour tout contrôle : boutons, champs, segments, menus déroulants, étiquettes. 6px (`rounded.md`) pour les panneaux autonomes, modales et popovers. Les panneaux pavés dans la grille ont des angles vifs (0). Le cercle est réservé aux objets du terrain et aux pastilles de couleur. Les marques d'état de l'effectif sont des carrés de 10px à coins de 2px dans une cellule fixe ; un joueur indisponible est barré en rouge, jamais retiré de la liste.

## Components

### Buttons
Sobres et tactiles, sans effet.
- **Shape:** coins de 4px.
- **Défaut :** voile neutre de 5 %, couture de 1px, texte 600 ; survol à 10 %.
- **Primaire :** aplat vert confirmé, texte blanc, sans bordure ; survol un cran plus clair. Un seul par contexte.
- **Ghost / outil :** sans fond ni bordure, encre atténuée ; survol en voile de 7 % et encre pleine ; actif en voile bleu de 16 % avec bordure bleue à 50 %.
- **Destructif :** contour seul (voile neutre de 16 %), encre atténuée, isolé de 12px des actions voisines ; rouge uniquement au survol ou au focus, fond toujours transparent.
- **Focus :** anneau bleu de 2px décalé de 2px, sur tous les contrôles.
- **Transitions :** 0,12 à 0,15s sur fond, bordure et couleur ; aucune autre animation.

### Chips
- **Compteur d'en-tête :** chiffre mono 11px en encre atténuée, poussé à droite de l'en-tête de panneau.
- **Étiquette :** 11px en capitales sur voile neutre de 7 à 8 %, coins de 4px, padding 1px 6px.

### Cards / Containers
- **Corner Style:** 0 quand pavé, 6px quand autonome.
- **Background:** panneau graphite.
- **Shadow Strategy:** aucune, sauf flottant (voir Elevation & Depth).
- **Border:** couture de 1px.
- **Internal Padding:** 12px 16px ; en-tête séparé du corps par une couture.

### Inputs / Fields
- **Style :** voile neutre de 5 %, couture de 1px, coins de 4px, 32px de haut dans la barre.
- **Focus :** la bordure passe au bleu sélection ; certains champs ajoutent un voile bleu de 8 à 10 %.
- **Groupe :** un champ suivi d'un bouton déroulant partage une seule bordure, coins extérieurs seulement.

### Navigation
- **Onglets :** texte 600 13px en encre atténuée, encre pleine au survol et actif ; l'actif porte un soulignement bleu de 2px à angles vifs, collé au bas de la rangée de 44px.
- **Contrôle segmenté :** segments sans fond, le segment actif porte le fond levé, un filet de couture intérieur et des coins de 4px ; le fond glisse entre segments.

### Menus
- **Style :** panneau à 97 % d'opacité, bordure en voile neutre de 14 %, coins de 4px, ombre flottante, padding de 6px ; entrée en fondu de 0,12s.
- **Groupes :** titres en Label 11px capitales.

### Ligne d'effectif (signature)
Ligne dense : numéro en mono, nom, poste en 11px atténué aligné à droite dans une cellule de 30px, puis la marque d'état dans une cellule fixe de 10px (ambre douteux, rouge blessé ou suspendu). La cellule existe même sans état, pour que les colonnes ne bougent jamais.

### Icônes
Jeu dessiné (`src/components/Icon.tsx`) : grille de 16px, trait 1,6 arrondi, `currentColor` ; les icônes de lecture sont pleines. Elles s'alignent sur le centre optique du texte.

## Do's and Don'ts

### Do:
- **Do** séparer les zones par une couture de 1px et une seule marche tonale (sol puis panneau).
- **Do** réserver le bleu à la sélection et au focus, le vert à l'unique action principale, l'ambre à l'incertain, le rouge au destructif et au blessé.
- **Do** composer en 11 / 13 / 15px, Inter pour les mots, JetBrains Mono tabulaire pour les chiffres.
- **Do** utiliser 4px pour les contrôles et menus, 6px pour les panneaux autonomes et modales, 0 pour les panneaux pavés.
- **Do** garder les actions destructives en contour seul, à 12px de leurs voisines, rouges seulement à l'intention.
- **Do** placer marques d'état et postes dans des cellules fixes, et barrer un joueur indisponible plutôt que de le retirer.
- **Do** dessiner les icônes avec le jeu de 16px plutôt qu'avec des caractères Unicode.

### Don't:
- **Don't** utiliser de verre, de flou d'arrière-plan, de dégradé ou de halo dans le chrome.
- **Don't** donner une forme de pilule à un bouton, un onglet ou un segment.
- **Don't** faire remonter les couleurs d'équipe, de flèches ou de zones du terrain dans les panneaux.
- **Don't** poser d'ombre sur un panneau pavé ; l'ombre est réservée à ce qui flotte.
- **Don't** mettre deux boutons verts dans le même contexte.
- **Don't** appliquer ces tokens au terrain, aux pastilles joueurs ni aux rendus d'export (Studio, vidéo et PNG de Séquence), qui gardent leurs couleurs fixes.
