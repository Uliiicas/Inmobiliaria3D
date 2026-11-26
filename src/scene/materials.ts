import {
  CanvasTexture,
  Color,
  DoubleSide,
  Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
} from 'three'
import type { MatKey } from './builder'
import { concrete, fabric, grass, plaster, rock, sand, stone, wood, type PBRSet } from './textures'

/** Metros que cubre una repetición de cada textura */
const TILE: Partial<Record<MatKey, number>> = {
  concrete: 2,
  concreteDark: 2,
  oak: 2,
  walnut: 2,
  cumaru: 2,
  smoked: 2,
  limestone: 2.4,
  travertine: 1.2,
  greystone: 1.6,
  marble: 3,
  basalt: 1.2,
  bali: 0.8,
  plaster: 3,
  microcement: 3,
  linen: 0.5,
  wool: 0.5,
  leather: 1,
  grass: 6,
  rock: 8,
  sand: 6,
}

export interface MaterialSet {
  mats: Record<MatKey, Material>
  /** materiales cuya emisión depende de la hora (luces artificiales) */
  emissive: { glow: MeshStandardMaterial; cove: MeshStandardMaterial; fire: MeshStandardMaterial }
  glass: MeshPhysicalMaterial
  dispose: () => void
}

function applySet(m: MeshStandardMaterial, set: PBRSet, key: MatKey, normalScale = 1) {
  const r = 1 / (TILE[key] ?? 2)
  for (const t of [set.map, set.roughnessMap, set.normalMap]) t.repeat.set(r, r)
  m.map = set.map
  m.roughnessMap = set.roughnessMap
  m.normalMap = set.normalMap
  m.normalScale.set(normalScale, normalScale)
  return m
}

function artTexture(seed: number) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 640
  const g = c.getContext('2d')!
  const palettes = [
    ['#e9e2d6', '#c9b49a', '#8a7a66', '#2f2a25'],
    ['#efe9df', '#b9b0a2', '#6f7a7c', '#36393a'],
    ['#ede4d3', '#d2b48c', '#a26f4e', '#4a3328'],
  ][seed % 3]
  g.fillStyle = palettes[0]
  g.fillRect(0, 0, 512, 640)
  // campos de color tipo pintura matérica
  for (let i = 0; i < 4; i++) {
    g.globalAlpha = 0.85
    g.fillStyle = palettes[1 + (i % 3)]
    const y = 80 + i * 130 + ((seed * 31 + i * 17) % 40)
    g.beginPath()
    g.ellipse(256 + Math.sin(seed + i) * 60, y, 190 - i * 25, 46 + (i % 2) * 20, Math.sin(i + seed) * 0.12, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 0.08
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = i % 2 ? '#000' : '#fff'
    g.fillRect(Math.random() * 512, Math.random() * 640, 2, 2)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

export function createMaterials(texSize: number): MaterialSet {
  const S = texSize
  const std = (p: ConstructorParameters<typeof MeshStandardMaterial>[0]) => new MeshStandardMaterial(p)

  const mats = {} as Record<MatKey, Material>
  mats.concrete = applySet(std({ color: '#ffffff', roughness: 1 }), concrete(S), 'concrete', 0.8)
  mats.concreteDark = std({ color: '#3a3733', roughness: 0.85 })
  {
    const c = concrete(S)
    applySet(mats.concreteDark as MeshStandardMaterial, c, 'concreteDark', 0.5)
    ;(mats.concreteDark as MeshStandardMaterial).color.set('#4a4641')
  }
  mats.plaster = applySet(std({ color: '#f4efe7', roughness: 1 }), plaster(Math.min(S, 256)), 'plaster', 0.3)
  mats.microcement = applySet(std({ color: '#ffffff', roughness: 1 }), plaster(Math.min(S, 256), '#d9cbb5'), 'microcement', 0.5)
  mats.limestone = applySet(std({ color: '#ffffff', roughness: 1 }), stone(S, 'limestone', 2), 'limestone', 0.6)
  mats.travertine = applySet(std({ color: '#ffffff', roughness: 1 }), stone(S, 'travertine', 1), 'travertine', 1)
  mats.greystone = applySet(std({ color: '#ffffff', roughness: 1 }), stone(S, 'greystone', 2), 'greystone', 1.2)
  mats.marble = applySet(std({ color: '#ffffff', roughness: 1, envMapIntensity: 1.3 }), stone(S, 'marble', 1), 'marble', 0.3)
  mats.basalt = applySet(std({ color: '#ffffff', roughness: 1 }), stone(Math.min(S, 256), 'basalt', 2), 'basalt', 0.8)
  mats.bali = applySet(std({ color: '#ffffff', roughness: 1 }), stone(Math.min(S, 256), 'bali', 2), 'bali', 0.6)
  mats.oak = applySet(std({ color: '#ffffff', roughness: 1 }), wood(S, 'oak'), 'oak', 0.5)
  mats.walnut = applySet(std({ color: '#ffffff', roughness: 1 }), wood(S, 'walnut'), 'walnut', 0.5)
  mats.cumaru = applySet(std({ color: '#ffffff', roughness: 1 }), wood(S, 'cumaru', 10), 'cumaru', 0.6)
  mats.smoked = applySet(std({ color: '#ffffff', roughness: 1 }), wood(S, 'smoked'), 'smoked', 0.4)
  const fab = Math.min(S, 256)
  mats.linen = applySet(std({ color: '#ffffff', roughness: 1 }), fabric(fab, '#e4dccf'), 'linen', 0.6)
  mats.wool = applySet(std({ color: '#ffffff', roughness: 1 }), fabric(fab, '#8d857b'), 'wool', 0.8)
  mats.leather = std({ color: '#8a5a3a', roughness: 0.55, metalness: 0 })
  mats.metal = std({ color: '#2b2926', roughness: 0.38, metalness: 0.8 })
  mats.bronze = std({ color: '#8c6a45', roughness: 0.3, metalness: 1 })
  mats.ceramic = std({ color: '#f3f0ea', roughness: 0.22, metalness: 0 })
  mats.mirror = std({ color: '#cfd3d2', roughness: 0.02, metalness: 1, envMapIntensity: 1.4 })
  mats.foliage = std({ color: '#46503a', roughness: 0.85 })
  mats.foliageLight = std({ color: '#6b7454', roughness: 0.85 })
  mats.trunk = std({ color: '#5a4a3c', roughness: 0.95 })
  mats.grass = applySet(std({ color: '#ffffff', roughness: 1 }), grass(Math.min(S, 256)), 'grass', 1)
  mats.rock = applySet(std({ color: '#ffffff', roughness: 1, flatShading: true }), rock(Math.min(S, 256)), 'rock', 1)
  mats.sand = applySet(std({ color: '#ffffff', roughness: 1 }), sand(Math.min(S, 256)), 'sand', 0.6)
  mats.art1 = std({ map: artTexture(1), roughness: 0.9 })
  mats.art2 = std({ map: artTexture(2), roughness: 0.9 })
  mats.art3 = std({ map: artTexture(3), roughness: 0.9 })

  const glass = new MeshPhysicalMaterial({
    color: new Color('#dde8e6'),
    metalness: 0,
    roughness: 0.03,
    transparent: true,
    opacity: 0.14,
    envMapIntensity: 1.8,
    specularIntensity: 1,
    reflectivity: 0.6,
    side: DoubleSide,
    depthWrite: false,
  })
  mats.glass = glass
  mats.glassFrosted = new MeshPhysicalMaterial({
    color: '#f1eee8',
    roughness: 0.6,
    transparent: true,
    opacity: 0.55,
    side: DoubleSide,
    depthWrite: false,
  })
  const glow = std({ color: '#f2e6d6', emissive: '#ffcf96', emissiveIntensity: 0.2, roughness: 0.7 })
  const cove = std({ color: '#1a1714', emissive: '#ffc988', emissiveIntensity: 0, roughness: 1 })
  const fire = std({ color: '#2a1408', emissive: '#ff7a2a', emissiveIntensity: 3, roughness: 1 })
  mats.glow = glow
  mats.cove = cove
  mats.fire = fire

  return {
    mats,
    emissive: { glow, cove, fire },
    glass,
    dispose() {
      Object.values(mats).forEach((m) => {
        const sm = m as MeshStandardMaterial
        sm.map?.dispose()
        sm.normalMap?.dispose()
        sm.roughnessMap?.dispose()
        m.dispose()
      })
    },
  }
}

/**
 * Reemplaza texturas procedurales por fotografías pre-generadas (Higgsfield u otra fuente)
 * listadas en public/higgsfield/manifest.json → "textures": { "marble": "higgsfield/marble.jpg" }
 */
export function applyTextureOverrides(set: MaterialSet, textures: Partial<Record<MatKey, string>>) {
  const loader = new TextureLoader()
  for (const [key, url] of Object.entries(textures) as [MatKey, string][]) {
    const m = set.mats[key] as MeshStandardMaterial | undefined
    if (!m || !url) continue
    loader.load(
      url,
      (t) => {
        t.colorSpace = SRGBColorSpace
        t.wrapS = t.wrapT = RepeatWrapping
        const r = 1 / (TILE[key] ?? 2)
        t.repeat.set(r, r)
        t.anisotropy = 8
        m.map = t
        m.color.set('#ffffff')
        m.needsUpdate = true
      },
      undefined,
      () => console.info(`[higgsfield] textura no disponible para ${key}, se mantiene la procedural`),
    )
  }
}
