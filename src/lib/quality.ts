import type { Quality } from '../state/store'

export interface QualityProfile {
  dpr: [number, number]
  shadows: boolean
  shadowMap: number
  texSize: number
  post: boolean
  dof: boolean
  ao: boolean
  pointLights: number
  grass: number
  antialias: boolean
}

export const PROFILES: Record<Quality, QualityProfile> = {
  high: { dpr: [1, 2], shadows: true, shadowMap: 2048, texSize: 512, post: true, dof: true, ao: true, pointLights: 12, grass: 900, antialias: false },
  medium: { dpr: [1, 1.5], shadows: true, shadowMap: 1024, texSize: 512, post: true, dof: false, ao: false, pointLights: 7, grass: 450, antialias: false },
  low: { dpr: [0.75, 1], shadows: false, shadowMap: 512, texSize: 256, post: false, dof: false, ao: false, pointLights: 3, grass: 0, antialias: true },
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/** Estimación inicial de la calidad según el dispositivo. PerformanceMonitor la ajusta en vivo. */
export function detectQuality(): Quality {
  try {
    const url = new URLSearchParams(location.search).get('quality')
    if (url === 'low' || url === 'medium' || url === 'high') return url
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return 'low'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''
    if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return 'low'
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
    const cores = navigator.hardwareConcurrency ?? 4
    const mobile = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820
    if (mobile) return mem <= 4 || cores <= 4 ? 'low' : 'medium'
    if (mem <= 4 || cores <= 4) return 'medium'
    if (/intel/i.test(renderer) && !/arc|iris xe/i.test(renderer)) return 'medium'
    return 'high'
  } catch {
    return 'medium'
  }
}
