import {
  CanvasTexture,
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three'

/**
 * Generador de texturas PBR procedurales (color + rugosidad + normales), sin descargas.
 * Cada textura es periódica (tileable) para repetirse sin costuras.
 * Si existen texturas fotográficas pre-generadas (Higgsfield u otras), materials.ts las reemplaza.
 */

export interface PBRSet {
  map: Texture
  roughnessMap: Texture
  normalMap: Texture
}

// ── ruido de valor periódico ──────────────────────────────────────────
function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967295
}

function makeNoise(seed: number) {
  return (x: number, y: number, period: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const m = (n: number) => ((n % period) + period) % period
    const a = hash(m(xi), m(yi), seed)
    const b = hash(m(xi + 1), m(yi), seed)
    const c = hash(m(xi), m(yi + 1), seed)
    const d = hash(m(xi + 1), m(yi + 1), seed)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}

function fbm(noise: ReturnType<typeof makeNoise>, x: number, y: number, base: number, oct: number) {
  let f = 0
  let amp = 0.5
  let p = base
  for (let i = 0; i < oct; i++) {
    f += amp * noise(x * p, y * p, p)
    p *= 2
    amp *= 0.5
  }
  return f
}

type RGB = [number, number, number]

interface Spec {
  size: number
  /** devuelve [r,g,b] 0..1, altura 0..1, rugosidad 0..1 para cada texel u,v 0..1 */
  sample: (u: number, v: number) => { c: RGB; h: number; r: number }
  normalStrength: number
}

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

function build(spec: Spec): PBRSet {
  const { size } = spec
  const n = size * size
  const col = new Uint8ClampedArray(n * 4)
  const rough = new Uint8ClampedArray(n * 4)
  const height = new Float32Array(n)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const s = spec.sample(x / size, y / size)
      col[i * 4] = clamp01(s.c[0]) * 255
      col[i * 4 + 1] = clamp01(s.c[1]) * 255
      col[i * 4 + 2] = clamp01(s.c[2]) * 255
      col[i * 4 + 3] = 255
      const r = clamp01(s.r) * 255
      rough[i * 4] = r
      rough[i * 4 + 1] = r
      rough[i * 4 + 2] = r
      rough[i * 4 + 3] = 255
      height[i] = s.h
    }
  }
  const nor = new Uint8ClampedArray(n * 4)
  const k = spec.normalStrength
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = height[y * size + ((x - 1 + size) % size)]
      const r = height[y * size + ((x + 1) % size)]
      const t = height[((y - 1 + size) % size) * size + x]
      const b = height[((y + 1) % size) * size + x]
      let nx = (l - r) * k
      let ny = (b - t) * k
      let nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len
      const i = (y * size + x) * 4
      nor[i] = (nx * 0.5 + 0.5) * 255
      nor[i + 1] = (ny * 0.5 + 0.5) * 255
      nor[i + 2] = (nz * 0.5 + 0.5) * 255
      nor[i + 3] = 255
    }
  }
  const tex = (data: Uint8ClampedArray, srgb: boolean) => {
    const c = document.createElement('canvas')
    c.width = c.height = size
    const ctx = c.getContext('2d')!
    ctx.putImageData(new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, size, size), 0, 0)
    const t = new CanvasTexture(c)
    t.wrapS = t.wrapT = RepeatWrapping
    t.colorSpace = srgb ? SRGBColorSpace : LinearSRGBColorSpace
    t.anisotropy = 8
    t.needsUpdate = true
    return t
  }
  return { map: tex(col, true), roughnessMap: tex(rough, false), normalMap: tex(nor, false) }
}

// ── recetas de materiales ─────────────────────────────────────────────

/** Hormigón visto con encofrado de tablas horizontales (cada textura = 2 m) */
export function concrete(size: number): PBRSet {
  const nA = makeNoise(11)
  const nB = makeNoise(12)
  const base = hex('#b9b3aa')
  const dark = hex('#9d978e')
  const boards = 14
  return build({
    size,
    normalStrength: 2.2,
    sample(u, v) {
      const board = Math.floor(v * boards)
      const bv = v * boards - board
      const offset = hash(board, 3, 7)
      const grain = fbm(nA, u * 1 + offset, v * boards * 0.25, 8, 4)
      const cloud = fbm(nB, u, v, 3, 5)
      const joint = bv < 0.045 ? 1 - bv / 0.045 : 0
      const pores = nA(u * 180, v * 180, 180) > 0.93 ? 1 : 0
      let c = mix(base, dark, cloud * 0.9 + hash(board, 9, 1) * 0.25)
      c = mix(c, dark, grain * 0.25 + joint * 0.5)
      c = mix(c, hex('#7f7a73'), pores * 0.5)
      return { c, h: 1 - joint * 0.6 - pores * 0.4 + grain * 0.15, r: 0.86 + cloud * 0.1 }
    },
  })
}

/** Madera (roble claro, nogal o cumarú). Vetas a lo largo de U. Cada textura = 2 m */
export function wood(size: number, kind: 'oak' | 'walnut' | 'cumaru' | 'smoked', planks = 8): PBRSet {
  const n = makeNoise(kind.length * 31)
  const pal = {
    oak: ['#c8a77e', '#a9865d'],
    walnut: ['#6b4a35', '#4a3122'],
    cumaru: ['#9a6a45', '#77492c'],
    smoked: ['#7a634e', '#55432f'],
  }[kind]
  const a = hex(pal[0])
  const b = hex(pal[1])
  return build({
    size,
    normalStrength: 1.4,
    sample(u, v) {
      const plank = Math.floor(v * planks)
      const pv = v * planks - plank
      const seed = hash(plank, 5, 3)
      const uu = u + seed
      const rings = Math.sin((fbm(n, uu * 0.6, v * planks * 0.5, 4, 3) * 18 + pv * 3) * Math.PI)
      const fine = fbm(n, uu * 2, v * planks * 6, 16, 3)
      const seam = pv < 0.03 || pv > 0.97 ? 1 : 0
      const endJoint = ((uu * 2) % 1) < 0.004 ? 1 : 0
      let c = mix(a, b, 0.35 + rings * 0.18 + fine * 0.35 + (seed - 0.5) * 0.3)
      c = mix(c, hex('#2a1d14'), (seam + endJoint) * 0.6)
      return { c, h: 0.7 + fine * 0.2 - (seam + endJoint) * 0.5, r: 0.55 + fine * 0.2 + seam * 0.2 }
    },
  })
}

/** Piedra veteada (travertino / caliza / mármol / basalto). tiles = baldosas por textura */
export function stone(
  size: number,
  kind: 'travertine' | 'limestone' | 'marble' | 'basalt' | 'bali' | 'greystone',
  tiles = 2,
): PBRSet {
  const n = makeNoise(kind.length * 7 + 3)
  const n2 = makeNoise(kind.length * 13 + 9)
  const pal: Record<typeof kind, [string, string, string, number]> = {
    travertine: ['#d8c9b2', '#bfa98d', '#a48b6d', 0.62],
    limestone: ['#e3dccf', '#d1c7b6', '#b8ab95', 0.45],
    marble: ['#f2efea', '#dedad3', '#8f8a84', 0.18],
    basalt: ['#3a3836', '#2b2a29', '#1c1b1a', 0.6],
    bali: ['#7fa89a', '#5e8c7f', '#45706a', 0.3],
    greystone: ['#a29d95', '#8c867e', '#6e6962', 0.85],
  }
  const [c1, c2, c3, rBase] = pal[kind]
  const A = hex(c1)
  const B = hex(c2)
  const V = hex(c3)
  return build({
    size,
    normalStrength: kind === 'marble' ? 0.6 : 2,
    sample(u, v) {
      const tu = u * tiles
      const tv = v * (kind === 'travertine' ? tiles * 2 : tiles)
      const fu = tu - Math.floor(tu)
      const fv = tv - Math.floor(tv)
      const jw = kind === 'marble' ? 0.002 : 0.006
      const joint = fu < jw || fv < jw ? 1 : 0
      const tileSeed = hash(Math.floor(tu), Math.floor(tv), 4)
      const cloud = fbm(n, u + tileSeed, v, 3, 5)
      let vein = 0
      if (kind === 'marble') {
        const w = fbm(n2, u, v, 2, 6)
        vein = Math.pow(1 - Math.abs(Math.sin((u * 3 + v * 1.5 + w * 4) * Math.PI)), 18)
      } else if (kind === 'travertine') {
        const w = fbm(n2, u * 0.3, v * 6, 4, 5)
        vein = Math.pow(1 - Math.abs(Math.sin((v * 22 + w * 3) * Math.PI)), 10) * 0.6
      } else {
        vein = fbm(n2, u, v, 12, 3) > 0.72 ? 0.5 : 0
      }
      const pits = kind === 'travertine' && n(u * 90, v * 90 * 0.4, 90) > 0.86 ? 1 : 0
      let c = mix(A, B, cloud * 1.1 + tileSeed * 0.15)
      c = mix(c, V, vein * 0.8 + pits * 0.4)
      c = mix(c, mix(V, hex('#000000'), 0.3), joint * 0.6)
      return { c, h: 1 - joint * 0.8 - pits * 0.5 - vein * 0.05, r: rBase + cloud * 0.12 + pits * 0.2 }
    },
  })
}

/** Revoque / microcemento cálido */
export function plaster(size: number, tint = '#ece6dc'): PBRSet {
  const n = makeNoise(77)
  const base = hex(tint)
  return build({
    size,
    normalStrength: 0.8,
    sample(u, v) {
      const c0 = fbm(n, u, v, 4, 6)
      const c = mix(base, mix(base, hex('#b7ab99'), 0.5), c0 * 0.45)
      return { c, h: c0, r: 0.9 }
    },
  })
}

/** Tejido (lino / lana) */
export function fabric(size: number, tint: string): PBRSet {
  const n = makeNoise(5)
  const base = hex(tint)
  return build({
    size,
    normalStrength: 1.6,
    sample(u, v) {
      const wx = Math.sin(u * size * 0.9) * 0.5 + 0.5
      const wy = Math.sin(v * size * 0.9) * 0.5 + 0.5
      const slub = fbm(n, u, v * 8, 8, 3)
      const c = mix(base, mix(base, hex('#6d645a'), 0.4), (wx * wy) * 0.3 + slub * 0.25)
      return { c, h: wx * wy * 0.6 + slub * 0.4, r: 0.95 }
    },
  })
}

/** Mapa de normales para el agua (ondas multiescala, periódico) */
export function waterNormals(size: number): Texture {
  const n = makeNoise(99)
  return build({
    size,
    normalStrength: 4,
    sample(u, v) {
      const h = fbm(n, u, v, 6, 5)
      return { c: [0, 0, 0], h, r: 0 }
    },
  }).normalMap
}

/** Césped y vegetación baja vista desde arriba */
export function grass(size: number): PBRSet {
  const n = makeNoise(41)
  const A = hex('#5c6b45')
  const B = hex('#7c8a5a')
  return build({
    size,
    normalStrength: 2.5,
    sample(u, v) {
      const f = fbm(n, u, v, 24, 4)
      const g = fbm(n, u * 3, v * 3, 4, 3)
      return { c: mix(A, B, f * 0.8 + g * 0.4), h: f, r: 0.95 }
    },
  })
}

/** Roca del acantilado */
export function rock(size: number): PBRSet {
  const n = makeNoise(63)
  const A = hex('#6f665c')
  const B = hex('#9a8f80')
  return build({
    size,
    normalStrength: 4,
    sample(u, v) {
      const f = fbm(n, u, v, 4, 6)
      const strata = Math.sin((v * 14 + f * 3) * Math.PI) * 0.5 + 0.5
      return { c: mix(A, B, f * 0.7 + strata * 0.25), h: f * 0.7 + strata * 0.3, r: 0.92 }
    },
  })
}

/** Arena de playa */
export function sand(size: number): PBRSet {
  const n = makeNoise(21)
  const A = hex('#cdb999')
  const B = hex('#e2d3b8')
  return build({
    size,
    normalStrength: 1.5,
    sample(u, v) {
      const f = fbm(n, u, v, 8, 5)
      const ripple = Math.sin((u * 30 + f * 6) * Math.PI) * 0.5 + 0.5
      return { c: mix(A, B, f * 0.8 + ripple * 0.15), h: ripple * 0.4 + f * 0.6, r: 0.95 }
    },
  })
}
