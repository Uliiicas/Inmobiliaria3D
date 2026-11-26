import { create } from 'zustand'

export type Mode = 'tour' | 'explore'
export type Quality = 'low' | 'medium' | 'high'
export type InteriorLights = 'auto' | 'on' | 'off'

interface State {
  mode: Mode
  /** 0..1 progreso del recorrido por scroll */
  tourProgress: number
  /** Hora del día 6..21 */
  hour: number
  quality: Quality
  qualityLocked: boolean
  interiorLights: InteriorLights
  showInfo: boolean
  showMeasures: boolean
  /** Modo 360°: ambiente actual y estado del plano */
  roomId: string
  planOpen: boolean
  planFloor: 0 | 1
  transitioning: boolean
  /** posición y yaw actuales de la cámara para el minimapa */
  cam: { x: number; y: number; z: number; yaw: number }
  ready: boolean
  /** la casa activa es la horneada en Blender */
  baked: boolean
  loadStage: string
  loadProgress: number
  contactOpen: boolean
  reducedMotion: boolean
  activeHotspot: string | null

  set: (p: Partial<State>) => void
  goRoom: (id: string) => void
}

export const useStore = create<State>((set) => ({
  mode: 'tour',
  tourProgress: 0,
  hour: 17.2,
  quality: 'high',
  qualityLocked: false,
  interiorLights: 'auto',
  showInfo: true,
  showMeasures: false,
  roomId: 'living',
  planOpen: true,
  planFloor: 0,
  transitioning: false,
  cam: { x: 0, y: 0, z: 0, yaw: 0 },
  ready: false,
  baked: false,
  loadStage: 'Preparando',
  loadProgress: 0,
  contactOpen: false,
  reducedMotion: false,
  activeHotspot: null,
  set: (p) => set(p),
  goRoom: (id) => set({ roomId: id, planOpen: false, activeHotspot: null }),
}))

if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore
