import type { MaterialSet } from '../scene/materials'

/**
 * Estado mutable de alta frecuencia (no reactivo) compartido entre sistemas de la escena.
 * Evita re-renderizar React en cada frame.
 */
export const runtime = {
  materials: null as MaterialSet | null,
  /** hora mostrada (interpolada suavemente hacia la hora elegida) */
  hour: 17.8,
  /** 0..1 intensidad efectiva de la iluminación artificial */
  artificial: 0,
  /** 0..1 apertura de la puerta principal */
  door: 0,
  /** progreso suavizado del recorrido */
  tour: 0,
  /** distancia de enfoque para la profundidad de campo */
  focus: 6,
  /** la casa activa es la horneada en Blender (luz indirecta en lightmaps) */
  baked: false,
  /** apertura extra de la exposición dentro de la casa (1 = ninguna) */
  exposureBoost: 1,
  /** tiempo transcurrido */
  time: 0,
}

export type Runtime = typeof runtime
