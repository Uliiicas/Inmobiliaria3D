#!/usr/bin/env node
/**
 * Convierte los cuadros renderizados (tour_render.py) en videos aptos para "scrubbing" con el scroll
 * y escribe public/video/tour.json, que lee la página /video/.
 *
 *   node scripts/video/encode.mjs <carpeta de cuadros> <id> <hora> "<etiqueta>" [--fps 30]
 *
 * Claves del encode para que buscar un cuadro cualquiera sea instantáneo:
 *  - un keyframe cada 4 cuadros (-g 4) y sin B-frames: el decodificador nunca retrocede más de 3 cuadros
 *  - +faststart: los metadatos van al principio del archivo
 *  - sin audio
 * Genera dos tamaños: 1280×720 (escritorio) y 854×480 (móvil), más un póster del primer cuadro.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(ROOT, 'public/video')
const [frames, id, hour, label] = process.argv.slice(2)
const fpsArg = process.argv.indexOf('--fps')
const fps = fpsArg > 0 ? Number(process.argv[fpsArg + 1]) : 30
if (!frames || !id || !hour) {
  console.error('uso: encode.mjs <carpeta> <id> <hora> "<etiqueta>" [--fps 30]')
  process.exit(1)
}
const files = readdirSync(frames).filter((f) => /^f\d{5}\.jpg$/.test(f)).sort()
if (!files.length) throw new Error('no hay cuadros f00000.jpg en ' + frames)
mkdirSync(OUT, { recursive: true })

const common = ['-y', '-framerate', String(fps), '-start_number', files[0].slice(1, 6), '-i', join(frames, 'f%05d.jpg'), '-an',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'slow', '-tune', 'film', '-g', '4', '-keyint_min', '4', '-bf', '0',
  '-sc_threshold', '0', '-movflags', '+faststart']
const run = (args) => execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] })
run([...common, '-vf', 'scale=1280:720:flags=lanczos', '-crf', '21', join(OUT, `tour-${id}.mp4`)])
run([...common, '-vf', 'scale=854:480:flags=lanczos', '-crf', '24', join(OUT, `tour-${id}-480.mp4`)])
run(['-y', '-i', join(frames, files[0]), '-vf', 'scale=1280:720', '-q:v', '4', join(OUT, `tour-${id}.jpg`)])

const mfile = join(OUT, 'tour.json')
const m = existsSync(mfile) ? JSON.parse(readFileSync(mfile, 'utf8')) : { version: 1, variants: [] }
m.fps = fps
m.frames = files.length
m.source = 'blender-cycles'
m.variants = m.variants.filter((v) => v.id !== id)
m.variants.push({ id, hour: Number(hour), label: label ?? id, src: `video/tour-${id}.mp4`, srcMobile: `video/tour-${id}-480.mp4`, poster: `video/tour-${id}.jpg` })
m.variants.sort((a, b) => a.hour - b.hour)
writeFileSync(mfile, JSON.stringify(m, null, 2) + '\n')
console.log(`✓ ${id}: ${files.length} cuadros → public/video/tour-${id}.mp4 (+480p) · tour.json actualizado`)
