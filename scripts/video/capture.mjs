#!/usr/bin/env node
/**
 * Renderiza el recorrido 3D cuadro a cuadro (misma ruta de cámara que la página principal)
 * como "video guía" para cada momento del día. Esos videos son la base que Seedance
 * transforma en fotorrealista (scripts/video/seedance.mjs) y, mientras tanto, lo que
 * muestra la página /video/.
 *
 * Uso:  npm run build && npx vite preview --port 4173 &
 *       node scripts/video/capture.mjs --hour 12 --frames 1440 --out work/frames-dia
 *  Opciones: --url  --quality low|medium|high  --width 1280 --height 720  --from 0 --to 1
 */
import { createRequire } from 'node:module'
import { mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const opt = (f, d) => {
  const i = args.indexOf(f)
  return i >= 0 ? args[i + 1] : d
}
const url = opt('--url', 'http://localhost:4173/')
const hour = parseFloat(opt('--hour', '12'))
const frames = parseInt(opt('--frames', '1440'))
const out = opt('--out', `work/frames-${hour}`)
const quality = opt('--quality', 'medium')
const W = parseInt(opt('--width', '1280'))
const H = parseInt(opt('--height', '720'))
const from = parseFloat(opt('--from', '0'))
const to = parseFloat(opt('--to', '1'))
const start = parseInt(opt('--start', '0'))
const end = parseInt(opt('--end', String(frames)))
const settle = parseInt(opt('--settle', '2'))

// playwright puede estar instalado globalmente (no es dependencia del sitio)
const require = createRequire(import.meta.url)
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  const { execSync } = await import('node:child_process')
  ;({ chromium } = require(join(execSync('npm root -g').toString().trim(), 'playwright')))
}
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: W, height: H } })
page.on('pageerror', (e) => console.error('pageerror', e.message))
await page.goto(`${url}?capture&quality=${quality}&hour=${hour}`)
await page.waitForFunction(() => window.__capture?.ready(), null, { timeout: 600_000 })
await page.waitForTimeout(1500)

// la curva se recorre a velocidad uniforme en "tomas": el progreso es lineal en el tiempo
const raf = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const t0 = Date.now()
for (let i = start; i < end; i++) {
  const file = join(out, `f${String(i).padStart(5, '0')}.jpg`)
  if (existsSync(file)) continue
  const p = from + ((to - from) * i) / (frames - 1)
  await page.evaluate(([p, h]) => window.__capture.frame(p, h), [p, hour])
  for (let s = 0; s < settle; s++) await raf()
  await page.screenshot({ path: file, type: 'jpeg', quality: 92, timeout: 600_000 })
  if (i % 10 === 0 || i - start < 3) {
    const el = (Date.now() - t0) / 1000
    console.log(`${i}/${end}  ${(el / (i - start + 1)).toFixed(2)} s/cuadro`)
  }
}
await browser.close()
