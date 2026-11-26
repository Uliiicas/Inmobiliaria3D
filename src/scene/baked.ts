import {
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  Material,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  type WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { MatKey } from './builder'
import type { MaterialSet } from './materials'
import type { Quality } from '../state/store'

/**
 * Casa horneada en Blender (scripts/blender): geometría y mobiliario optimizados en GLB y un
 * atlas de luz con tres canales independientes que se mezclan en tiempo real según la hora:
 *
 *   R · luz del cielo (oclusión + rebotes)   → se tiñe con el color del cielo de cada hora
 *   G · rebote del sol de la tarde           → sigue la intensidad y temperatura del sol
 *   B · luminarias interiores y exteriores   → se enciende con la iluminación artificial
 *
 * El sol directo sigue siendo dinámico (sombras en tiempo real), así que el ciclo día/noche
 * conserva el movimiento de las sombras mientras la luz indirecta viene del horneado.
 */

export interface BakedManifest {
  version: number
  glb: string
  lightmap: { high: string; low: string; scale: { sky: number; sun: number; lamps: number } }
  textures: Partial<Record<MatKey, { map: string; normalMap?: string; roughnessMap?: string; tile: number }>>
}

export interface BakedHouse {
  root: Object3D
  /** mallas con atlas de luz (todas las de la casa salvo vidrio, emisivos y vegetación exterior) */
  lightmapped: Mesh[]
  dispose: () => void
}

/** Uniformes compartidos por todos los materiales horneados; Atmosphere los actualiza cada frame */
export const bakedUniforms = {
  uLMScale: { value: new Color(1, 1, 1) },
  uSkyIrr: { value: new Color(0.6, 0.65, 0.7) },
  uSunIrr: { value: new Color(1, 0.95, 0.9) },
  uLampIrr: { value: new Color(0, 0, 0) },
  /** 1 sin mapas de sombra (calidad baja): el sol directo se apaga donde el cielo no llega */
  uSunGate: { value: 0 },
}

const BASE = import.meta.env.BASE_URL
/** ?lmdebug muestra el atlas de luz crudo (R cielo, G sol, B luminarias) para revisar el horneado */
const LM_DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('lmdebug')

export async function loadBakedManifest(): Promise<BakedManifest | null> {
  try {
    const url = new URLSearchParams(location.search).get('engine')
    if (url === 'procedural') return null
    const r = await fetch(`${BASE}models/house.json`, { cache: 'no-cache' })
    if (!r.ok) return null
    return (await r.json()) as BakedManifest
  } catch {
    return null
  }
}

let ktx2: KTX2Loader | null = null
function getKTX2(gl: WebGLRenderer) {
  if (!ktx2) {
    ktx2 = new KTX2Loader().setTranscoderPath(`${BASE}basis/`).detectSupport(gl)
  }
  return ktx2
}

function loadTexture(gl: WebGLRenderer, url: string): Promise<Texture> {
  const full = `${BASE}${url}`
  if (url.endsWith('.ktx2')) return getKTX2(gl).loadAsync(full)
  return new TextureLoader().loadAsync(full)
}

/** Sustituye el aporte indirecto difuso por el atlas de luz de tres canales */
export function patchLightmapped(m: MeshStandardMaterial) {
  if (m.userData.lmPatched) return
  m.userData.lmPatched = true
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, bakedUniforms)
    if (LM_DEBUG)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n  gl_FragColor = vec4( lmT, 1.0 );',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <lightmap_pars_fragment>',
        `#include <lightmap_pars_fragment>
uniform vec3 uLMScale; uniform vec3 uSkyIrr; uniform vec3 uSunIrr; uniform vec3 uLampIrr; uniform float uSunGate;`,
      )
      .replace(
        '#include <lights_fragment_maps>',
        `
float lmSkyOcc = 1.0;
float lmSunVis = 1.0;
vec3 lmT = vec3( 0.0 );
#if defined( RE_IndirectDiffuse ) && defined( USE_LIGHTMAP )
  lmT = texture2D( lightMap, vLightMapUv ).rgb;
  vec3 lmV = lmT * lmT * uLMScale;
  // reemplaza cielo hemisférico y ambiente: la luz indirecta ya incluye oclusión y rebotes
  irradiance = lmV.x * uSkyIrr + lmV.y * uSunIrr + lmV.z * uLampIrr;
  // sin mapas de sombra el sol atravesaría los techos: se apaga donde el cielo no llega
  lmSunVis = mix( 1.0, smoothstep( 0.12, 0.45, lmV.x ), uSunGate );
  // ^1.5: en interiores (poco cielo) los reflejos del cielo casi desaparecen; afuera quedan intactos
  lmSkyOcc = pow( clamp( lmV.x * 1.2, 0.0, 1.0 ), 1.5 ) + clamp( lmV.z * 0.1, 0.0, 0.3 );
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
  // reflejos del cielo atenuados donde el cielo no llega (interiores, bajo muebles)
  radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness ) * lmSkyOcc;
  #ifdef USE_CLEARCOAT
    clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness ) * lmSkyOcc;
  #endif
#endif
`,
      )
      .replace(
        '#include <aomap_fragment>',
        `reflectedLight.directDiffuse *= lmSunVis;
reflectedLight.directSpecular *= lmSunVis;
#include <aomap_fragment>`,
      )
  }
  m.customProgramCacheKey = () => (LM_DEBUG ? 'baked-lm-debug' : 'baked-lm-v3')
  m.needsUpdate = true
}

/**
 * Carga la casa horneada. Los materiales de la arquitectura llegan sólo con nombre (MatKey) y se
 * reemplazan por los de `set` con texturas PBR en mosaico; los modelos de Poly Haven conservan los suyos.
 */
export async function loadBakedHouse(
  gl: WebGLRenderer,
  manifest: BakedManifest,
  set: MaterialSet,
  quality: Quality,
  onProgress: (p: number) => void,
): Promise<BakedHouse> {
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  loader.setKTX2Loader(getKTX2(gl))
  const [gltf, lightMap] = await Promise.all([
    loader.loadAsync(`${BASE}${manifest.glb}`, (e) => e.total && onProgress(e.loaded / e.total)),
    loadTexture(gl, quality === 'high' ? manifest.lightmap.high : manifest.lightmap.low),
  ])
  lightMap.colorSpace = NoColorSpace
  lightMap.flipY = false
  lightMap.channel = 1
  lightMap.minFilter = lightMap.mipmaps?.length ? LinearMipmapLinearFilter : LinearFilter
  lightMap.magFilter = LinearFilter
  lightMap.needsUpdate = true
  const s = manifest.lightmap.scale
  bakedUniforms.uLMScale.value.setRGB(s.sky, s.sun, s.lamps)

  const lightmapped: Mesh[] = []
  const owned: Material[] = []
  gltf.scene.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const src = mesh.material as MeshStandardMaterial
    const key = (src.name || '') as MatKey
    // sólo las mallas con segundo canal UV llevan atlas de luz (vidrio, emisivos y exteriores no)
    const isLM = !!mesh.geometry.attributes.uv1
    let mat: Material
    if (set.mats[key]) {
      mat = set.mats[key]
      src.dispose()
    } else {
      mat = src
      owned.push(src)
      // hojas en tarjetas: recorte alfa nítido y sin ordenamiento de transparencias
      if (src.transparent && src.map) {
        src.transparent = false
        src.alphaTest = 0.5
        src.side = 2
      }
    }
    if (isLM) {
      const sm = mat as MeshStandardMaterial
      sm.lightMap = lightMap
      sm.lightMapIntensity = 1
      patchLightmapped(sm)
      lightmapped.push(mesh)
    }
    mesh.material = mat
    mesh.matrixAutoUpdate = false
    mesh.updateMatrix()
  })
  return {
    root: gltf.scene,
    lightmapped,
    dispose() {
      lightMap.dispose()
      owned.forEach((m) => {
        const sm = m as MeshStandardMaterial
        sm.map?.dispose()
        sm.normalMap?.dispose()
        sm.roughnessMap?.dispose()
        sm.metalnessMap?.dispose()
        m.dispose()
      })
      gltf.scene.traverse((o) => (o as Mesh).geometry?.dispose())
    },
  }
}

/** Reemplaza los mapas procedurales por las texturas PBR (KTX2) a medida que llegan */
export function upgradeTextures(gl: WebGLRenderer, set: MaterialSet, manifest: BakedManifest, quality: Quality) {
  const jobs: Promise<void>[] = []
  for (const [key, t] of Object.entries(manifest.textures) as [MatKey, NonNullable<BakedManifest['textures'][MatKey]>][]) {
    const m = set.mats[key] as MeshStandardMaterial | undefined
    if (!m || !t) continue
    const r = 1 / t.tile
    const apply = (url: string | undefined, slot: 'map' | 'normalMap' | 'roughnessMap') => {
      if (!url) return
      if (quality === 'low' && slot !== 'map') return
      jobs.push(
        loadTexture(gl, url)
          .then((tex) => {
            tex.wrapS = tex.wrapT = RepeatWrapping
            tex.repeat.set(r, r)
            tex.anisotropy = quality === 'high' ? 8 : 4
            tex.colorSpace = slot === 'map' ? SRGBColorSpace : NoColorSpace
            const old = m[slot]
            m[slot] = tex
            if (slot === 'map') m.color.set('#ffffff')
            if (slot === 'roughnessMap') m.roughness = 1
            if (slot === 'normalMap') m.normalScale.set(0.9, 0.9)
            old?.dispose()
            m.needsUpdate = true
          })
          .catch(() => console.info(`[baked] textura no disponible: ${url}`)),
      )
    }
    apply(t.map, 'map')
    apply(t.normalMap, 'normalMap')
    apply(t.roughnessMap, 'roughnessMap')
  }
  return Promise.all(jobs)
}
