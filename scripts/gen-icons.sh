#!/usr/bin/env bash
# Régénère les icônes PWA de public/ depuis les SVG de assets/.
#
# Volontairement hors de `npm run build` : les PNG sont des inputs versionnés, pas
# des artefacts de build, et rsvg-convert n'est pas garanti présent en CI.
# Prérequis (macOS) : brew install librsvg imagemagick
#
# Lancer depuis la racine du dépôt : ./scripts/gen-icons.sh
set -euo pipefail

cd "$(dirname "$0")/.."

for tool in rsvg-convert magick; do
  command -v "$tool" >/dev/null || {
    echo "$tool introuvable — brew install librsvg imagemagick" >&2
    exit 1
  }
done

# purpose "any" : le carré arrondi de la marque.
rsvg-convert -w 192 -h 192 assets/icon.svg -o public/icon-192.png
rsvg-convert -w 512 -h 512 assets/icon.svg -o public/icon-512.png

# purpose "maskable" + apple-touch : plein cadre, le système applique son masque.
rsvg-convert -w 512 -h 512 assets/icon-maskable.svg -o public/icon-maskable-512.png
rsvg-convert -w 180 -h 180 assets/icon-maskable.svg -o public/apple-touch-icon.png

# iOS rend en noir tout pixel transparent : on retire le canal alpha par sécurité.
magick public/apple-touch-icon.png -background '#1a66ff' -alpha remove -alpha off \
  public/apple-touch-icon.png

# Le favicon partage la source des icônes « any » — un seul endroit à modifier.
cp assets/icon.svg public/favicon.svg

echo "Icônes régénérées dans public/."
