---
name: Clarity
description: Design tokens for the Clarity todo-list application (desktop + mobile layouts).
colors:
  background: "#f7f6f3"
  surface: "#ffffff"
  surface-sidebar: "#fdfdfb"
  surface-subtle: "#f2f1ec"
  surface-field: "#ecebe6"
  surface-dark: "#17181f"
  text-primary: "#17181f"
  text-secondary: "#4a4b55"
  text-tertiary: "#6d6e78"
  text-muted: "#9a9aa6"
  text-muted-alt: "#8b8b93"
  text-muted-on-dark: "#9aa0b5"
  placeholder: "#a5a5ad"
  primary: "#1a66ff"
  primary-hover: "#0f4fd6"
  primary-active: "#0b3fae"
  link: "#4a7aff"
  link-hover: "#8aa8ff"
  accent: "#e8590c"
  accent-bg: "#fdf3e4"
  danger: "#d6431f"
  danger-bg: "#fdeadb"
  border: "#ecebe6"
  border-dashed: "#dcdbd4"
  scrim: "rgba(16,17,22,.45)"
typography:
  h1:
    fontFamily: Sora
    fontSize: 20px
    fontWeight: 600
  title-modal:
    fontFamily: Sora
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.3
  title-card:
    fontFamily: Sora
    fontSize: 14.5px
    fontWeight: 600
  label-caps:
    fontFamily: Sora
    fontSize: 10px
    fontWeight: 600
    letterSpacing: 1.2px
  body:
    fontFamily: Sora
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.65
  button:
    fontFamily: Sora
    fontSize: 12px
    fontWeight: 500
  caption:
    fontFamily: Sora
    fontSize: 11px
    fontWeight: 400
  micro:
    fontFamily: Sora
    fontSize: 9px
    fontWeight: 600
    letterSpacing: 1.5px
rounded:
  xs: 6px
  sm: 9px
  md: 10px
  lg: 12px
  xl: 16px
  2xl: 20px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 44px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 9px 16px
    typography: "{typography.button}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
  button-secondary:
    backgroundColor: "{colors.surface-field}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
  button-destructive:
    backgroundColor: transparent
    textColor: "{colors.text-muted}"
  button-destructive-hover:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.xl}"
    width: 320px
    height: 160px
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 10px 12px
    width: 260px
    height: 44px
  modal:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "{spacing.2xl}"
    width: 360px
    height: 220px
  badge:
    backgroundColor: "{colors.surface-field}"
    rounded: "{rounded.full}"
    padding: 2px 9px
    typography: "{typography.micro}"
---

## Overview

Clarity est un dashboard de todo-list orienté objectifs, avec une navigation sidebar en desktop et une navigation adaptée en mobile. Une seule famille de police (Sora), une palette neutre chaude en fond, un unique accent bleu réservé à l'action, et un accent orange réservé aux espaces/alertes. Le ton général est doux : coins arrondis mesurés, ombres très diffuses, aucune bordure dure.

## Colors

- **Primary (`#1a66ff`)** : seul déclencheur d'action — boutons primaires, liens, icônes actives. États hover `#0f4fd6`, active `#0b3fae`.
- **Accent (`#e8590c`)** : réservé aux espaces et labels d'alerte ("ESPACES"), jamais utilisé comme couleur d'action.
- **Danger (`#d6431f`)** : suppression uniquement, sur fond `#fdeadb` au survol.
- **Background (`#f7f6f3`)** : fond général de l'app et des panneaux inline.
- **Surface (`#ffffff`)** : cartes, modales, menus.
- **Texte** : primaire `#17181f` → secondaire `#4a4b55` → tertiaire `#6d6e78` → muet `#9a9aa6`/`#8b8b93` — la hiérarchie se fait par contraste de gris, pas par la couleur.
- **Palette objectifs/listes** (cycle fixe, assignable) : `#7c3aed, #1a66ff, #00b8e6, #e5197f, #00c25f, #f97316, #fbbf24, #e5252b`. Huit teintes franches, une par famille : un pastel ne se lit pas à 20 px, et deux bleus voisins ne se distinguent pas. Aucune ne reprend `danger` (`#d6431f`).

## Typography

Police unique : **Sora** (Google Fonts, poids 400/500/600/700), fallback `system-ui, sans-serif`. Aucune police secondaire — la hiérarchie vient du poids et de la couleur, jamais du changement de famille.

- Titre d'écran : 20px/600
- Titre carte/modale : 15–17px/600, line-height 1.3
- Titre carte compacte : 14.5px/600
- Label de section (surtitre) : 10–11px/600, `letter-spacing:1.2–1.5px`, uppercase, couleur muette (`#e8590c` pour "ESPACES")
- Corps de texte : 12–12.5px/400, line-height 1.5–1.65
- Bouton/action : 12–13px/500
- Caption/méta : 10.5–11.5px
- Micro (badges) : 8.5–9px/600

## Layout

- Sidebar desktop fixe à 228px (`flex:none`), zone de contenu en `flex:1`.
- Dashboard en grille `1.6fr 1fr` : la colonne focus (tâches du jour) domine sur la colonne secondaire (objectifs/stats).
- Échelle d'espacement observée : `2, 3, 4, 5, 6, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 44` px. Padding boutons `9px 14–18px`, cartes `16–24px`, modales `24px`.
- Densité progressive : le mobile ne réduit pas juste l'échelle des cartes, il resserre aussi les gaps internes (6–14px contre 20–24px en desktop).
- Modales ancrées en haut de l'écran (`padding-top:120–140px`), jamais centrées verticalement — exception : le panneau de célébration sort en bas à droite.

## Elevation & Depth

Profondeur par ombres douces et très diffuses, jamais par bordures dures :
- Carte standard : `0 1px 3px rgba(23,24,31,.04), 0 10px 30px rgba(23,24,31,.05)`
- Modale : `0 30px 80px rgba(0,0,0,.35)`
- Dropdown menu : `0 14px 36px rgba(0,0,0,.14)`
- Bouton primaire (repos → hover → active) : `0 4px 14px rgba(26,102,255,.28)` → `0 8px 22px rgba(15,79,214,.34)` → `0 2px 8px rgba(11,63,174,.3)`
- Scrim modal : `rgba(16,17,22,.45)` (`.55` pour le panneau de célébration)

## Shapes

Coins arrondis mesurés (jamais pointus, jamais pilule sur du contenu) :
- 6px : checkbox de jalon
- 9px : icônes 28px, boutons carrés
- 10px : boutons, inputs, segment actif d'un toggle
- 12px : conteneurs de toggle pill, dropdowns, panneaux inline
- 16px : logo bloc sombre, cartes stats
- 20px : cartes principales, modales
- Pill (20px ou 50%) réservée aux badges, pastilles de fréquence, cercles de progression.

## Components

- **Bouton primaire** : fond `#1a66ff`, texte blanc 12–13px/500, radius 10px, padding `9px 16–18px`, transition `background .13s, box-shadow .13s, transform .09s`. Hover `#0f4fd6` + `translateY(-1px)`, active `#0b3fae` + `translateY(1px)`, focus ring `0 0 0 3px rgba(26,102,255,.32)`.
- **Bouton secondaire/icône** : carré 28×28px radius 9px fond `#ecebe6`, ou pill fond blanc bordure `#ecebe6` + icône SVG trait 15px.
- **Bouton destructif** : texte `#9a9aa6`, hover fond `#fdeadb` + texte `#d6431f`.
- **Card** : fond blanc, radius 20px, padding 20px, ombre carte standard, sans bordure.
- **Modale** : scrim `rgba(16,17,22,.45)`, contenu blanc radius 20px padding 24px ; header titre 15px/600 + bouton fermeture 28px ; séparateur `1px solid #f2f1ec` avant le footer.
- **Input/textarea** : fond `#f7f6f3`, bordure `1.5px solid #ecebe6`, radius 10px, placeholder `#a5a5ad`.
- **Toggle pill group** : conteneur fond `#ecebe6` radius 12px padding 4px, gap 3px, segment actif en fond plein.
- **Badge** : radius 20px (ou 50%), padding `2px 8–9px`, texte 8.5–9px/600.
- **Checkbox de tâche** : carré 18px radius 6px ; non coché `2px solid #d8d7d0` ; coché bordure/fond = couleur de la liste/objectif liée.
- **Dropdown menu** : fond blanc, bordure `1px solid #ecebe6`, radius 12px, ombre dropdown, item radius 8px padding `8–9px 11–12px`.
- **Empty state** : bordure `1.5px dashed #dcdbd4`, radius 20px, icône colorée 48–52px radius 15–16px fond `#1a66ff`, CTA primaire.
- **Panneau inline expansible** (due date, récurrence) : fond `#f7f6f3` radius 14px padding 14px ; sous-bloc de réglage fin fond blanc bordure `1.5px solid #ecebe6` radius 12px.

## Do's and Don'ts

- Ne pas ajouter de deuxième police — tout, y compris les labels 8.5px, reste en Sora.
- Ne pas utiliser le bleu `#1a66ff` ailleurs que sur une action primaire ou un lien — c'est le seul signal d'action de l'UI.
- Ne pas sortir de la palette fixe à 8 couleurs pour les objectifs/listes.
- Ne pas utiliser de radius pointus (0–4px) ni de pilules extrêmes sur des blocs de contenu — rester dans l'échelle 6–20px.
- Ne pas utiliser d'ombres dures ou de bordures noires franches — toutes les ombres sont diffuses et légères.
- Ne pas laisser un bouton sans triplet hover/active/focus explicite.
- Ne pas écrire un label de section sans majuscules + `letter-spacing` — ni l'inverse (gras noir sans espacement).
- Ne pas utiliser d'émoji ni d'icônes pleines colorées — uniquement des traits SVG fins (`stroke-width:1.9–2`) ou des glyphes texte simples (▦ ◎ ▲ ✓).
