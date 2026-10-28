# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

App web React installable en PWA (hors-ligne), également livrée en app macOS (Tauri) qui embarque exactement la même app web : le langage de design reste celui du web, pas celui de macOS natif.

## Users

L'auteur d'abord : Tactica11 est un outil personnel, partagé éventuellement à quelques proches. Au-delà, trois profils confirmés :

- **Entraîneur amateur / de club** : prépare ses compos, phases et phases arrêtées, puis montre le plan aux joueurs, souvent sur iPad (vestiaire, bord du terrain).
- **Créateur de contenu** : fait des analyses tactiques et exporte des séquences animées (MP4 9:16 / 16:9 / 1:1) et des posters Studio pour TikTok, Reels, YouTube.
- **Passionné / analyste** : refait les matchs et teste des schémas pour lui-même ou entre amis.

## Product Purpose

Créer des compos et mises en place tactiques de football (formation, placement libre, variantes par phase base / attaque / défense avec transition scrubable, zones d'influence, adversaires, phases arrêtées, séquences animées en plusieurs étapes) et les raconter. Le succès : passer d'une idée à un visuel tactique clair et partageable (lien, PNG, vidéo, poster) sans quitter l'app.

## Positioning

- **Phases + séquences animées** : chaque emplacement garde ses positions par phase, avec un slider défense ↔ attaque, et un moteur de séquence (flèches typées, zones, caméra, sous-titres) exportable en MP4. Du mouvement qui raconte une idée tactique, pas un tableau statique.
- **Rendu prêt à publier** : les exports (vidéo, poster Studio, PNG) sont faits pour être publiés tels quels, sans retouche dans un autre outil.
- **Gratuit, projet personnel** : pas de positionnement commercial, pas de tarification, pas de compte.

## Operating Context

- Utilisé au doigt sur iPad comme à la souris sur ordinateur ; mode présentation plein écran avec tiroir d'outils repliable ; terrain en portrait / paysage.
- Onglets principaux : Compo, Effectif (fiche joueur), Phase arrêtée, Séquence ; Studio et partage via le menu **Partager**, placé au même endroit sur chaque onglet.
- Données sur l'appareil (`localStorage`), export / import `.json` du projet, liens partageables compressés, import CSV de joueurs avec détection automatique des colonnes.
- Thème clair / sombre basculable dans la barre du haut.

## Capabilities and Constraints

- **Contrainte confirmée : iPad tactile prioritaire.** Toute interaction doit fonctionner au doigt sur iPad autant qu'à la souris sur ordinateur.
- État actuel, non déclaré comme contrainte durable : interface en français uniquement, aucun backend (100 % côté navigateur). Ce sont des faits d'aujourd'hui, pas des engagements ; ils peuvent être rouverts.
- Stack en place : React 19 + TypeScript (Vite), Framer Motion, lz-string, html-to-image, papaparse, mediabunny (MP4), vite-plugin-pwa, Tauri 2. Déploiement statique (Netlify prêt).
- Vocabulaire produit : compo, formation, emplacement, phase (base / attaque / défense), zone d'influence, adversaires, phase arrêtée, séquence, étape, Studio, effectif, titulaires / remplaçants.

## Brand Commitments

- Nom : **Tactica11**. Logo : `public/logo.svg`, `public/logo.png` ; favicon `public/favicon.png`.
- Aucune contrainte de voix ou d'identité déclarée au-delà.

## Evidence on Hand

- Projet de démo ouvert au premier lancement, sur l'effectif réel du Real Madrid : compo 4-3-3 avec phases et adversaires, plan B 4-2-3-1, corner, coup franc, quatre séquences (`src/demo.ts`). Son statut de vitrine n'a pas été confirmé comme engagement.
- Capture d'écran de l'app : `public/screenshot.png`.
- Spécification : `docs/specs/mode-video.md`.
- Aucun témoignage, chiffre d'utilisateurs, presse ou étude de cas : rien de tel ne doit être inventé.

## Product Principles

1. **Raconter, pas seulement placer** : une compo vaut par ce qu'elle explique. Phases, transitions et séquences sont le cœur, pas des options.
2. **Prêt à publier** : chaque export doit tenir seul, sans retouche.
3. **Le tactile n'est pas un mode dégradé** : chaque interaction reste confortable au doigt sur iPad.
4. **Outil personnel d'abord** : optimiser pour l'usage réel de l'auteur et de ses proches, pas pour l'acquisition ou la monétisation.
