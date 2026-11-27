#!/usr/bin/env bash
# Prepara un clip animado por IA (Kling, Hailuo, Higgsfield…) para la página /cine/.
# uso: scripts/cine/encode.sh <clip-descargado.mp4> <id-de-escena>
#   ej: scripts/cine/encode.sh ~/Descargas/kling_123.mp4 living
#
# El scroll recorre el video cuadro a cuadro, así que se recodifica con un keyframe cada 4 cuadros
# (buscar cualquier punto es instantáneo), sin audio, a 1920 px y con faststart para que empiece a
# cargar enseguida. Deja public/cine/clips/<id>.mp4, que la página detecta sola.
set -euo pipefail
in="$1"
id="$2"
out="$(dirname "$0")/../../public/cine/clips/${id}.mp4"
ffmpeg -y -loglevel error -i "$in" -an \
  -vf "scale='min(1920,iw)':-2:flags=lanczos,fps=24,format=yuv420p" \
  -c:v libx264 -preset slow -crf 21 -g 4 -keyint_min 4 -sc_threshold 0 \
  -movflags +faststart "$out"
ls -lh "$out"
