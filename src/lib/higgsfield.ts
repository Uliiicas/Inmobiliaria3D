import type { MatKey } from '../scene/builder'

/**
 * Integración opcional con recursos generados en Higgsfield AI.
 *
 * El navegador NUNCA habla con la API de Higgsfield ni conoce credenciales.
 * Los recursos se generan del lado del servidor con `npm run higgsfield:generate`
 * (scripts/higgsfield/generate.mjs) o se exportan a mano desde higgsfield.ai,
 * y se publican como archivos estáticos junto a un manifiesto:
 *
 *   public/higgsfield/manifest.json
 *
 * Si el manifiesto no existe o está vacío, la experiencia funciona igual con
 * materiales y escenas 100 % procedurales.
 */

export interface HiggsfieldAsset {
  id: string
  /** ambiente al que pertenece (id de src/data/rooms.ts) */
  room?: string
  kind: 'image' | 'video'
  src: string
  poster?: string
  title?: string
  prompt?: string
  model?: string
  createdAt?: string
}

export interface HiggsfieldManifest {
  version: 1
  generator?: string
  assets: HiggsfieldAsset[]
  /** reemplazos de texturas procedurales por imágenes tileables */
  textures?: Partial<Record<MatKey, string>>
}

let cache: Promise<HiggsfieldManifest | null> | null = null

export function loadHiggsfieldManifest(): Promise<HiggsfieldManifest | null> {
  if (!cache) {
    const base = import.meta.env.BASE_URL
    cache = fetch(`${base}higgsfield/manifest.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: HiggsfieldManifest | null) => {
        if (!m || !Array.isArray(m.assets)) return null
        const fix = (u: string) => (/^https?:|^data:/.test(u) ? u : `${base}${u.replace(/^\//, '')}`)
        m.assets = m.assets.map((a) => ({ ...a, src: fix(a.src), poster: a.poster ? fix(a.poster) : undefined }))
        if (m.textures) {
          for (const k of Object.keys(m.textures) as MatKey[]) {
            const v = m.textures[k]
            if (v) m.textures[k] = fix(v)
          }
        }
        return m
      })
      .catch(() => null)
  }
  return cache
}

export function assetsForRoom(m: HiggsfieldManifest | null, room: string) {
  return m?.assets.filter((a) => a.room === room) ?? []
}
