/**
 * Recorrido cinematográfico: una secuencia de escenas que avanza con el scroll.
 *
 * Cada escena parte de un render fijo de Cycles (public/cine/stills/). Mientras no tenga clip,
 * la imagen se mueve con un Ken Burns que imita el movimiento de cámara pedido a la IA. Cuando
 * existe public/cine/clips/<id>.mp4 (animado en Kling, Hailuo o Higgsfield y recodificado con
 * scripts/cine/encode.sh), el scroll recorre ese video cuadro a cuadro.
 */
import '@fontsource/cormorant-garamond/300.css'
import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/400-italic.css'
import '@fontsource-variable/manrope'
import '../index.css'
import './cine.css'

interface Move {
  /** escala inicial y final */
  scale: [number, number]
  /** desplazamiento inicial y final en % del ancho / alto */
  x: [number, number]
  y: [number, number]
  /** punto de anclaje del zoom, en % */
  origin?: [number, number]
}
interface Scene {
  id: string
  kicker: string
  title: string
  text: string
  still: string
  stillMobile?: string
  /** clip opcional; si falta se prueba clips/<id>.mp4 */
  clip?: string
  move: Move
}
interface Manifest {
  version: number
  scenes: Scene[]
}

const BASE = import.meta.env.BASE_URL + 'cine/'
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const mobile = matchMedia('(max-width: 820px)').matches
const params = new URLSearchParams(location.search)
/** ?stills fuerza las imágenes fijas aunque haya clips (para comparar) */
const forceStills = params.has('stills')

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (x: number, a: number, b: number) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/** fracción del tramo de cada escena dedicada al fundido con la siguiente */
const FADE = 0.22
/** alto de scroll por escena */
const VH_PER_SCENE = 130

interface Layer {
  s: Scene
  root: HTMLDivElement
  img: HTMLImageElement
  video?: HTMLVideoElement
  /** el clip cargó y se puede recorrer */
  live: boolean
  shownT: number
}
const layers: Layer[] = []
let target = 0
let shown = 0

// ───────────────────────── carga ─────────────────────────
const loaderBar = $('loader-bar')
let loaded = 0
const bump = (total: number) => {
  loaded++
  loaderBar.style.width = `${Math.round((loaded / total) * 100)}%`
}

async function clipExists(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD' })
    return r.ok && (r.headers.get('content-type') ?? '').startsWith('video')
  } catch {
    return false
  }
}

async function init() {
  const manifest: Manifest = await fetch(BASE + 'escenas.json').then((r) => r.json())
  const stage = $('stage')
  const total = manifest.scenes.length

  await Promise.all(
    manifest.scenes.map(async (s, i) => {
      const root = document.createElement('div')
      root.className = 'cn-layer'
      root.style.zIndex = String(total - i)
      const img = new Image()
      img.className = 'cn-media'
      img.alt = ''
      img.decoding = 'async'
      img.src = BASE + (mobile && s.stillMobile ? s.stillMobile : s.still)
      const o = s.move.origin ?? [50, 50]
      img.style.transformOrigin = `${o[0]}% ${o[1]}%`
      // en pantallas verticales el recorte se centra en el punto de interés
      img.style.objectPosition = `${o[0]}% ${o[1]}%`
      root.appendChild(img)
      stage.appendChild(root)
      const layer: Layer = { s, root, img, live: false, shownT: 0 }
      layers[i] = layer

      const imgReady = img.decode().catch(() => undefined)
      const clipUrl = BASE + (s.clip ?? `clips/${s.id}.mp4`)
      if (!forceStills && (await clipExists(clipUrl))) {
        const v = document.createElement('video')
        v.className = 'cn-media cn-video'
        v.muted = true
        v.playsInline = true
        v.preload = 'auto'
        v.src = clipUrl
        v.style.objectPosition = img.style.objectPosition
        root.appendChild(v)
        layer.video = v
        await new Promise<void>((res) => {
          v.addEventListener('loadeddata', () => res(), { once: true })
          v.addEventListener('error', () => res(), { once: true })
          setTimeout(res, 8000)
        })
        if (v.readyState >= 2) {
          layer.live = true
          root.classList.add('has-clip')
        } else v.remove()
      }
      await imgReady
      bump(total)
    }),
  )

  buildDots()
  spacer.style.height = `${total * VH_PER_SCENE + 60}vh`
  readScroll()
  shown = target
  $('loader').style.opacity = '0'
  setTimeout(() => $('loader').remove(), 1100)
  requestAnimationFrame(frame)
}

// ───────────────────────── scroll ─────────────────────────
const spacer = $('spacer')
const readScroll = () => {
  const max = document.documentElement.scrollHeight - innerHeight
  target = max > 0 ? clamp(scrollY / max, 0, 1) : 0
}
addEventListener('scroll', readScroll, { passive: true })
addEventListener('resize', readScroll)

const dotsEl = $('dots')
const dots: HTMLButtonElement[] = []
function buildDots() {
  layers.forEach((l, i) => {
    const b = document.createElement('button')
    b.className = 'cn-dot'
    b.setAttribute('aria-label', l.s.title)
    b.title = l.s.title
    b.addEventListener('click', () => {
      const max = document.documentElement.scrollHeight - innerHeight
      // a media escena, con el texto visible
      scrollTo({ top: ((i + 0.4) / layers.length) * 0.94 * max, behavior: reduced ? 'auto' : 'smooth' })
    })
    dotsEl.appendChild(b)
    dots.push(b)
  })
}

// ───────────────────────── textos ─────────────────────────
const caption = $('caption')
const capKicker = $('cap-kicker')
const capTitle = $('cap-title')
const capText = $('cap-text')
let capIndex = -1
/** el texto sólo cambia mientras está oculto (entre escenas siempre lo está) */
function setCaption(i: number, visible: boolean) {
  if (i !== capIndex && !caption.classList.contains('is-in')) {
    capIndex = i
    const s = layers[i].s
    capKicker.textContent = s.kicker
    capTitle.textContent = s.title
    capText.textContent = s.text
  }
  caption.classList.toggle('is-in', visible && i === capIndex)
}

// ───────────────────────── cuadro a cuadro ─────────────────────────
const hero = $('hero')
const outro = $('outro')
let last = performance.now()

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  // el progreso mostrado persigue al scroll con amortiguación: el movimiento se siente filmado
  shown += (target - shown) * (reduced ? 1 : 1 - Math.exp(-dt * 6))

  const n = layers.length
  // el último 6 % del scroll es el cierre
  const p = clamp(shown / 0.94, 0, 1) * n
  const idx = Math.min(n - 1, Math.floor(p))

  layers.forEach((l, i) => {
    const local = clamp(p - i, 0, 1)
    // opacidad: la escena i se desvanece en su tramo final mostrando la i+1 debajo
    const fadeOut = i < n - 1 ? smooth(local, 1 - FADE, 1) : 0
    const visible = p >= i - 1 && p <= i + 1
    l.root.style.opacity = String(p < i ? 1 : 1 - fadeOut)
    l.root.style.visibility = visible ? 'visible' : 'hidden'
    if (!visible) return

    // el movimiento ocupa todo el tramo de la escena, incluido el fundido (la cámara no se detiene)
    const t = reduced ? 0.5 : easeInOut(clamp((p - i + 0.08) / 1.08, 0, 1))
    if (l.live && l.video && l.video.duration) {
      const want = t * (l.video.duration - 0.05)
      if (Math.abs(l.video.currentTime - want) > 1 / 60) l.video.currentTime = want
    } else {
      const m = l.s.move
      const sc = lerp(m.scale[0], m.scale[1], t)
      const x = lerp(m.x[0], m.x[1], t)
      const y = lerp(m.y[0], m.y[1], t)
      l.img.style.transform = `translate3d(${x}%, ${y}%, 0) scale(${sc})`
    }
  })

  const local = p - idx
  const atEnd = shown > 0.955
  setCaption(idx, shown > 0.015 && local > 0.06 && local < 1 - FADE * 0.7 && !atEnd)
  hero.style.opacity = String(1 - smooth(shown, 0.004, 0.03))
  outro.style.opacity = String(smooth(shown, 0.955, 0.99))
  outro.style.pointerEvents = atEnd ? 'auto' : 'none'
  dots.forEach((d, i) => d.setAttribute('aria-current', String(i === idx)))

  requestAnimationFrame(frame)
}

init().catch((e) => {
  console.error(e)
  $('loader-bar').style.width = '100%'
})
