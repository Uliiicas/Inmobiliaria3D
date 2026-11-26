import { Color, MathUtils, Vector3 } from 'three'

/**
 * Modelo físico simplificado de la luz del día para el sitio de la residencia.
 * El océano queda al sur de la escena (+Z) y el sol se pone sobre el mar, levemente al oeste.
 * Cada hora produce: posición solar real, intensidad, temperatura de color, cielo,
 * niebla, exposición y el nivel de la iluminación artificial.
 */

export interface DaylightState {
  hour: number
  sunDir: Vector3
  sunElevation: number
  /** Luz direccional principal: sol de día, luna de noche */
  keyDir: Vector3
  keyColor: Color
  keyIntensity: number
  hemiSky: Color
  hemiGround: Color
  hemiIntensity: number
  exposure: number
  fog: Color
  turbidity: number
  rayleigh: number
  mie: number
  mieG: number
  /** 0..1 cuánto pesan las luces artificiales */
  artificial: number
  stars: number
  /** brillo del océano para reflejos */
  envIntensity: number
  label: string
}

interface Key {
  h: number
  key: string
  keyI: number
  sky: string
  ground: string
  hemiI: number
  exp: number
  fog: string
  turb: number
  ray: number
  mie: number
  art: number
  env: number
}

// Temperaturas aproximadas: 2.200 K (amanecer) · 5.500 K (mediodía) · 1.900 K (golden hour)
const KEYS: Key[] = [
  { h: 6.0, key: '#ff9e6b', keyI: 0.9, sky: '#7f94bd', ground: '#4b4038', hemiI: 0.5, exp: 1.05, fog: '#9fa6bd', turb: 7, ray: 3.2, mie: 0.008, art: 0.35, env: 0.55 },
  { h: 7.3, key: '#ffc28e', keyI: 2.2, sky: '#a3b6d6', ground: '#6b5a4a', hemiI: 0.65, exp: 0.82, fog: '#d6cbc0', turb: 4, ray: 2.0, mie: 0.005, art: 0.08, env: 0.8 },
  { h: 10.0, key: '#fff1dc', keyI: 3.1, sky: '#b9d1ee', ground: '#857462', hemiI: 0.85, exp: 0.6, fog: '#dfe4e8', turb: 2.6, ray: 1.2, mie: 0.004, art: 0, env: 1.0 },
  { h: 13.0, key: '#fffaf1', keyI: 3.6, sky: '#c3daf3', ground: '#8f7d69', hemiI: 0.9, exp: 0.52, fog: '#e2e8ec', turb: 2.2, ray: 1.0, mie: 0.004, art: 0, env: 1.05 },
  { h: 15.5, key: '#fff0da', keyI: 3.2, sky: '#bcd3ee', ground: '#8a7763', hemiI: 0.85, exp: 0.56, fog: '#dfe1e2', turb: 2.6, ray: 1.2, mie: 0.004, art: 0, env: 1.0 },
  { h: 17.0, key: '#ffc890', keyI: 2.5, sky: '#a9bedb', ground: '#7d6650', hemiI: 0.7, exp: 0.68, fog: '#e1d2bf', turb: 4.0, ray: 1.8, mie: 0.006, art: 0.12, env: 0.9 },
  { h: 18.4, key: '#ff9f5a', keyI: 1.7, sky: '#9aa7c6', ground: '#6e5240', hemiI: 0.6, exp: 0.86, fog: '#e0b996', turb: 6, ray: 2.6, mie: 0.009, art: 0.45, env: 0.85 },
  { h: 19.0, key: '#ff7f4d', keyI: 1.15, sky: '#8f8db3', ground: '#5c4038', hemiI: 0.5, exp: 0.95, fog: '#d99a86', turb: 8, ray: 3.2, mie: 0.012, art: 0.75, env: 0.75 },
  { h: 19.6, key: '#ff6a5a', keyI: 0.45, sky: '#6d6e98', ground: '#3d2f33', hemiI: 0.4, exp: 1.0, fog: '#9b7480', turb: 9, ray: 3.5, mie: 0.014, art: 0.92, env: 0.55 },
  { h: 20.2, key: '#8ea0d8', keyI: 0.22, sky: '#3a4670', ground: '#221f28', hemiI: 0.32, exp: 1.05, fog: '#3b4060', turb: 9, ray: 3.0, mie: 0.01, art: 1, env: 0.35 },
  { h: 21.0, key: '#9fb2e6', keyI: 0.28, sky: '#1b2440', ground: '#14131a', hemiI: 0.26, exp: 1.08, fog: '#151a2b', turb: 10, ray: 2.0, mie: 0.005, art: 1, env: 0.22 },
]

const tmpA = new Color()
const tmpB = new Color()

function lerpColor(a: string, b: string, t: number, out: Color) {
  tmpA.set(a)
  tmpB.set(b)
  return out.copy(tmpA).lerp(tmpB, t)
}

export const SUNRISE = 6.15
export const SUNSET = 19.75
const MAX_ELEVATION = MathUtils.degToRad(68)

export function sunDirection(hour: number, out = new Vector3()) {
  const t = (hour - SUNRISE) / (SUNSET - SUNRISE)
  const el = MAX_ELEVATION * Math.sin(Math.PI * t)
  // azimut desde el noreste (-30°) hasta el suroeste sobre el mar (122°)
  const az = MathUtils.degToRad(MathUtils.lerp(-30, 122, t))
  out.set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el))
  return out.normalize()
}

const MOON = new Vector3(-0.35, 0.72, -0.6).normalize()

export function labelFor(h: number) {
  if (h < 7) return 'Amanecer'
  if (h < 11.5) return 'Mañana'
  if (h < 15) return 'Mediodía'
  if (h < 18.5) return 'Atardecer'
  if (h < 19.8) return 'Golden hour'
  if (h < 20.5) return 'Hora azul'
  return 'Noche'
}

export function computeDaylight(hour: number, out?: DaylightState): DaylightState {
  const h = MathUtils.clamp(hour, 6, 21)
  let i = 0
  while (i < KEYS.length - 2 && h > KEYS[i + 1].h) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const t = MathUtils.smoothstep(h, a.h, b.h)
  const L = MathUtils.lerp

  const s: DaylightState = out ?? {
    hour: h,
    sunDir: new Vector3(),
    sunElevation: 0,
    keyDir: new Vector3(),
    keyColor: new Color(),
    keyIntensity: 0,
    hemiSky: new Color(),
    hemiGround: new Color(),
    hemiIntensity: 0,
    exposure: 1,
    fog: new Color(),
    turbidity: 2,
    rayleigh: 1,
    mie: 0.005,
    mieG: 0.8,
    artificial: 0,
    stars: 0,
    envIntensity: 1,
    label: '',
  }
  s.hour = h
  sunDirection(h, s.sunDir)
  s.sunElevation = Math.asin(s.sunDir.y)
  // de día el sol, de noche una luna fría y alta
  const night = MathUtils.smoothstep(h, 19.7, 20.3)
  s.keyDir.copy(s.sunDir).lerp(MOON, night).normalize()
  if (s.keyDir.y < 0.06) s.keyDir.y = 0.06
  s.keyDir.normalize()
  lerpColor(a.key, b.key, t, s.keyColor)
  s.keyIntensity = L(a.keyI, b.keyI, t)
  lerpColor(a.sky, b.sky, t, s.hemiSky)
  lerpColor(a.ground, b.ground, t, s.hemiGround)
  s.hemiIntensity = L(a.hemiI, b.hemiI, t)
  s.exposure = L(a.exp, b.exp, t)
  lerpColor(a.fog, b.fog, t, s.fog)
  s.turbidity = L(a.turb, b.turb, t)
  s.rayleigh = L(a.ray, b.ray, t)
  s.mie = L(a.mie, b.mie, t)
  s.mieG = 0.8
  s.artificial = L(a.art, b.art, t)
  s.stars = MathUtils.smoothstep(h, 19.9, 20.8)
  s.envIntensity = L(a.env, b.env, t) * 0.42
  s.label = labelFor(h)
  return s
}

export const PRESETS = [
  { h: 6, label: 'Amanecer' },
  { h: 10, label: 'Mañana' },
  { h: 13, label: 'Mediodía' },
  { h: 17, label: 'Atardecer' },
  { h: 19, label: 'Golden hour' },
  { h: 21, label: 'Noche' },
]

export function formatHour(h: number) {
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
