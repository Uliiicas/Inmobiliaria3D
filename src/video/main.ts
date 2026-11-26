/**
 * Recorrido en video: el scroll avanza el video (scrubbing) y la hora del día mezcla
 * varias versiones del mismo recorrido renderizadas con la misma ruta de cámara.
 *
 * Los videos y su manifiesto viven en public/video/ (ver scripts/video/README.md).
 * Están codificados con un keyframe cada pocos cuadros para que buscar en cualquier punto sea instantáneo.
 */
import '@fontsource/cormorant-garamond/300.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource-variable/manrope'
import '../index.css'
import './video.css'
import { CHAPTERS, SHOTS } from '../data/tour'

interface Variant {
  id: string
  hour: number
  label: string
  src: string
  srcMobile?: string
  poster?: string
}
interface Manifest {
  version: number
  fps: number
  frames: number
  /** de dónde salen los videos: "render" (recorrido 3D) o "seedance" */
  source: string
  variants: Variant[]
}

const BASE = import.meta.env.BASE_URL
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const mobile = matchMedia('(max-width: 820px)').matches
const params = new URLSearchParams(location.search)

const PRESETS = [
  { h: 6.5, label: 'Amanecer' },
  { h: 10, label: 'Mañana' },
  { h: 13, label: 'Mediodía' },
  { h: 17, label: 'Atardecer' },
  { h: 19, label: 'Golden hour' },
  { h: 21, label: 'Noche' },
]
const labelFor = (h: number) =>
  h < 7 ? 'Amanecer' : h < 11.5 ? 'Mañana' : h < 15 ? 'Mediodía' : h < 18.5 ? 'Atardecer' : h < 19.8 ? 'Golden hour' : h < 20.5 ? 'Hora azul' : 'Noche'
const formatHour = (h: number) => {
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const smooth = (x: number, a: number, b: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>'
const MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z"/></svg>'

// ───────────────────────── estado ─────────────────────────
let manifest: Manifest
let duration = 0
/** progreso de scroll 0..1 */
let target = 0
/** tiempo de video mostrado (persigue al scroll con amortiguación) */
let shown = 0
/** hora elegida y hora mostrada (la transición de luz es gradual) */
let hour = clamp(parseFloat(params.get('hour') ?? '') || 17, 6, 21)
let hourShown = hour

interface Layer {
  v: Variant
  el: HTMLVideoElement
  ready: boolean
  weight: number
}
const layers: Layer[] = []

// ───────────────────────── scroll ─────────────────────────
const spacer = $('spacer')
spacer.style.height = `${SHOTS.length * 58}vh`
const readScroll = () => {
  const max = document.documentElement.scrollHeight - innerHeight
  target = max > 0 ? clamp(scrollY / max, 0, 1) : 0
}
addEventListener('scroll', readScroll, { passive: true })
addEventListener('resize', readScroll)

// ───────────────────────── hora ─────────────────────────
const range = $<HTMLInputElement>('time-range')
range.value = String(hour)
range.addEventListener('input', () => (hour = parseFloat(range.value)))
const presetBox = $('presets')
for (const p of PRESETS) {
  const b = document.createElement('button')
  b.className = 'chip'
  b.textContent = p.label
  b.addEventListener('click', () => {
    hour = p.h
    range.value = String(p.h)
  })
  presetBox.appendChild(b)
}

/** Pesos de cada versión para la hora dada: interpolación entre las dos más cercanas */
function weightsFor(h: number) {
  const vs = layers.filter((l) => l.ready).sort((a, b) => a.v.hour - b.v.hour)
  for (const l of layers) l.weight = 0
  if (!vs.length) return
  if (h <= vs[0].v.hour) vs[0].weight = 1
  else if (h >= vs[vs.length - 1].v.hour) vs[vs.length - 1].weight = 1
  else {
    let i = 0
    while (h > vs[i + 1].v.hour) i++
    const t = smooth(h, vs[i].v.hour, vs[i + 1].v.hour)
    vs[i].weight = 1 - t
    vs[i + 1].weight = t
  }
}

/** Ajuste de color fuera del rango renderizado (p. ej. amanecer antes de la primera versión) */
function gradeFor(h: number) {
  const dawn = 1 - smooth(h, 6, 8.5)
  return `brightness(${(1 - dawn * 0.28).toFixed(3)}) saturate(${(1 - dawn * 0.25).toFixed(3)}) sepia(${(dawn * 0.18).toFixed(3)}) hue-rotate(${(-dawn * 8).toFixed(1)}deg)`
}

// ───────────────────────── capítulos ─────────────────────────
const cap = { box: $('caption'), kicker: $('cap-kicker'), title: $('cap-title'), text: $('cap-text') }
let capIdx = -2
function updateCaption(p: number) {
  const shot = p * (SHOTS.length - 1)
  const i = CHAPTERS.findIndex((c) => shot >= c.from && shot <= c.to)
  if (i === capIdx) return
  capIdx = i
  cap.box.classList.remove('is-in')
  if (i < 0) return
  const c = CHAPTERS[i]
  setTimeout(() => {
    if (capIdx !== i) return
    cap.kicker.textContent = c.kicker
    cap.title.textContent = c.title
    cap.text.textContent = c.text
    cap.box.classList.add('is-in')
  }, 260)
}

// ───────────────────────── carga ─────────────────────────
const loaderBar = $('loader-bar')
const loaderText = $('loader-text')

/** Descarga el video completo en memoria: así buscar cualquier cuadro no espera a la red */
async function fetchBlob(url: string, onProgress: (f: number) => void) {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length')) || 0
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    got += value.length
    if (total) onProgress(got / total)
  }
  return URL.createObjectURL(new Blob(chunks as BlobPart[], { type: 'video/mp4' }))
}

function makeLayer(v: Variant) {
  const el = document.createElement('video')
  el.muted = true
  el.playsInline = true
  el.preload = 'auto'
  el.setAttribute('muted', '')
  el.setAttribute('playsinline', '')
  if (v.poster) el.poster = BASE + v.poster
  el.className = 'vt-layer'
  el.style.opacity = '0'
  $('stage').appendChild(el)
  const layer: Layer = { v, el, ready: false, weight: 0 }
  layers.push(layer)
  return layer
}

async function loadLayer(layer: Layer, onProgress: (f: number) => void) {
  const url = BASE + (mobile && layer.v.srcMobile ? layer.v.srcMobile : layer.v.src)
  try {
    layer.el.src = await fetchBlob(url, onProgress)
  } catch {
    layer.el.src = url // sin streaming de fetch: el navegador lo carga por rangos
  }
  await new Promise<void>((r) => {
    if (layer.el.readyState >= 2) return r()
    layer.el.addEventListener('loadeddata', () => r(), { once: true })
  })
  duration = duration || layer.el.duration
  layer.el.currentTime = shown
  layer.ready = true
}

async function boot() {
  try {
    manifest = await (await fetch(`${BASE}video/tour.json`)).json()
  } catch {
    // todavía no hay videos publicados: se avisa y se ofrece volver al recorrido 3D
    loaderText.innerHTML = 'El recorrido en video se está renderizando. <a class="underline" href="../">Ver el recorrido 3D</a>'
    loaderBar.parentElement?.remove()
    return
  }
  for (const v of manifest.variants) makeLayer(v)
  // primero la versión más cercana a la hora inicial, el resto en segundo plano
  const order = [...layers].sort((a, b) => Math.abs(a.v.hour - hour) - Math.abs(b.v.hour - hour))
  await loadLayer(order[0], (f) => (loaderBar.style.width = `${Math.round(f * 100)}%`))
  hourShown = hour
  $('loader').style.opacity = '0'
  setTimeout(() => $('loader').remove(), 1100)
  readScroll()
  shown = target * duration
  requestAnimationFrame(tick)
  for (const l of order.slice(1)) await loadLayer(l, () => {})
}

// ───────────────────────── bucle ─────────────────────────
const rail = $('rail')
const hero = $('hero')
const timeLabel = $('time-label')
const timeName = $('time-name')
const timeIcon = $('time-icon')
const grade = document.querySelector<HTMLElement>('.vt-grade')!
let last = performance.now()
let lastLabel = ''

function tick(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now

  // tiempo del video: amortiguación exponencial (la rueda "a saltos" no se nota)
  const goal = target * Math.max(0, duration - 1 / (manifest.fps || 30))
  shown = reduced ? goal : shown + (goal - shown) * (1 - Math.exp(-dt * 7))
  if (Math.abs(goal - shown) < 1e-3) shown = goal

  hourShown = reduced ? hour : hourShown + (hour - hourShown) * (1 - Math.exp(-dt * 3.2))
  weightsFor(hourShown)

  // la capa base va opaca y la siguiente encima con su peso: mezcla correcta de dos videos
  const visible = layers.filter((l) => l.weight > 0.001).sort((a, b) => a.v.hour - b.v.hour)
  for (const l of layers) {
    const i = visible.indexOf(l)
    const op = i < 0 ? 0 : i === 0 ? 1 : l.weight
    l.el.style.opacity = op.toFixed(3)
    l.el.style.zIndex = String(i < 0 ? 0 : i + 1)
    if (i < 0 || !l.ready) continue
    // buscar sólo si cambió de cuadro y el anterior ya terminó de decodificarse
    const frame = 1 / (manifest.fps || 30)
    if (!l.el.seeking && Math.abs(l.el.currentTime - shown) > frame * 0.5) l.el.currentTime = shown
  }
  grade.style.backdropFilter = gradeFor(hourShown)

  const p = duration ? shown / duration : 0
  rail.style.transform = `scaleY(${p.toFixed(4)})`
  hero.style.opacity = target < 0.012 ? '1' : '0'
  updateCaption(target)

  const label = formatHour(hourShown)
  if (label !== lastLabel) {
    lastLabel = label
    timeLabel.textContent = label
    timeName.textContent = labelFor(hourShown)
    timeIcon.innerHTML = hourShown >= 19.9 ? MOON : SUN
    for (const b of presetBox.children) {
      const ph = PRESETS.find((x) => x.label === b.textContent)!.h
      b.setAttribute('aria-pressed', String(Math.abs(hour - ph) < 0.26))
    }
  }
  requestAnimationFrame(tick)
}

boot()
