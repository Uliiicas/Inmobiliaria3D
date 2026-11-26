/**
 * Último paso del pipeline: toma lo que exportó Blender y lo deja listo para la web.
 *
 *   node scripts/blender/optimize.mjs [carpeta-de-trabajo]
 *
 *  - house_raw.glb → public/models/house.glb   (soldado, cuantizado, meshopt, texturas KTX2)
 *  - lightmap.png  → public/models/lightmap-{4k,2k}.ktx2  (UASTC: sin bandas en los degradés)
 *  - texturas PBR en mosaico de cada material → public/models/textures/<material>/*.ktx2
 *  - public/models/house.json con rutas y escalas del atlas de luz
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { NodeIO, PropertyType } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, quantize, meshopt, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'
import { encodeToKTX2 } from 'ktx2-encoder'
import { ktx2 } from 'ktx2-encoder/gltf-transform'
import sharp from 'sharp'

const WORK = process.argv[2] ?? '/home/user/work'
const OUT = join(WORK, 'out')
const PUB = new URL('../../public/models/', import.meta.url).pathname
mkdirSync(join(PUB, 'textures'), { recursive: true })

const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data: new Uint8Array(data), width: info.width, height: info.height }
}
const mb = (p) => (statSync(p).size / 1e6).toFixed(2) + ' MB'

// Materiales de la casa: [metros por repetición, ¿mapa normal?, ¿rugosidad?]  (ver scripts/blender/common.py)
const TEX = {
  concrete: [2.4, true, true],
  concreteDark: [2.4, true, false],
  plaster: [3.0, false, false],
  microcement: [3.0, true, false],
  limestone: [2.4, true, true],
  travertine: [1.6, true, true],
  greystone: [2.0, true, true],
  marble: [3.0, false, true],
  basalt: [1.6, true, true],
  bali: [1.2, true, false],
  oak: [2.2, true, true],
  walnut: [1.2, false, true],
  cumaru: [2.0, true, true],
  smoked: [1.2, false, false],
  linen: [0.6, true, false],
  wool: [0.5, true, false],
  leather: [1.0, true, true],
  grass: [4.0, true, false],
  rock: [6.0, true, false],
  sand: [4.0, true, false],
}

const HERO_NORMALS = new Set(['oak', 'limestone', 'greystone', 'travertine'])

async function ktx(src, dst, opts, size) {
  let buf = readFileSync(src)
  if (size) buf = await sharp(buf).resize(size, size).png().toBuffer()
  const out = await encodeToKTX2(new Uint8Array(buf), { generateMipmap: true, imageDecoder, ...opts })
  writeFileSync(dst, out)
  return dst
}
const COLOR = { isUASTC: false, qualityLevel: 190, compressionLevel: 2, isPerceptual: true, isSetKTX2SRGBTransferFunc: true }
const DATA = { isUASTC: false, qualityLevel: 160, compressionLevel: 2, isPerceptual: false, isSetKTX2SRGBTransferFunc: false }
const NORMAL = { isUASTC: true, isNormalMap: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 4, isPerceptual: false }

const only = process.env.ONLY // glb | lightmap | textures
const manifestPath = join(PUB, 'house.json')
const prev = (() => {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    return null
  }
})()
const manifest = prev ?? { version: 1, glb: 'models/house.glb', lightmap: {}, textures: {} }

if (!only || only === 'glb') {
  await MeshoptEncoder.ready
  await MeshoptDecoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  })
  const doc = await io.read(join(OUT, 'house_raw.glb'))
  await doc.transform(
    // los materiales de la casa sólo viajan por nombre: no deben fusionarse aunque sean idénticos
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
    weld(),
    // conservar TEXCOORD_1 (lightmap) aunque ningún material del GLB lo use
    prune({ keepAttributes: true, keepLeaves: false }),
    // texturas de los modelos de Poly Haven: 512 px como máximo y comprimidas en GPU
    textureCompress({ encoder: sharp, resize: [512, 512], targetFormat: 'png' }),
    ktx2({ ...NORMAL, slots: /normalTexture/, imageDecoder, generateMipmap: true }),
    ktx2({ ...COLOR, slots: /baseColorTexture|emissiveTexture/, imageDecoder, generateMipmap: true }),
    ktx2({ ...DATA, slots: /metallicRoughnessTexture|occlusionTexture/, imageDecoder, generateMipmap: true }),
    // el canal de lightmap necesita precisión de texel: 16 bits para todas las UV
    quantize({ quantizePosition: 16, quantizeTexcoord: 16, quantizeNormal: 10 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  )
  await io.write(join(PUB, 'house.glb'), doc)
  console.log('house.glb', mb(join(PUB, 'house.glb')))
}

if (!only || only === 'lightmap') {
  const lm = JSON.parse(readFileSync(join(OUT, 'lightmap.json'), 'utf8'))
  const UA = { isUASTC: true, needSupercompression: true, enableRDO: true, rdoQualityLevel: 1.5, isPerceptual: false, uastcLDRQualityLevel: 2 }
  await ktx(join(OUT, 'lightmap.png'), join(PUB, 'lightmap-4k.ktx2'), UA)
  await ktx(join(OUT, 'lightmap.png'), join(PUB, 'lightmap-2k.ktx2'), UA, 2048)
  manifest.lightmap = { high: 'models/lightmap-4k.ktx2', low: 'models/lightmap-2k.ktx2', scale: lm.scale }
  console.log('lightmap', mb(join(PUB, 'lightmap-4k.ktx2')), mb(join(PUB, 'lightmap-2k.ktx2')))
}

if (!only || only === 'textures') {
  for (const [key, [tile, nor, rough]] of Object.entries(TEX)) {
    const src = join(WORK, 'texproc', key)
    const dst = join(PUB, 'textures', key)
    mkdirSync(dst, { recursive: true })
    const entry = { tile, map: `models/textures/${key}/diff.ktx2` }
    if (!process.env.SKIP_DIFF) await ktx(join(src, 'diff.jpg'), join(dst, 'diff.ktx2'), COLOR)
    if (nor) {
      // relieve a 1k sólo donde la cámara se acerca a superficies grandes; el resto a 512
      await ktx(join(src, 'nor.jpg'), join(dst, 'nor.ktx2'), NORMAL, HERO_NORMALS.has(key) ? 1024 : 512)
      entry.normalMap = `models/textures/${key}/nor.ktx2`
    }
    if (rough) {
      await ktx(join(src, 'rough.jpg'), join(dst, 'rough.ktx2'), DATA, 512)
      entry.roughnessMap = `models/textures/${key}/rough.ktx2`
    }
    manifest.textures[key] = entry
    console.log(key, 'ok')
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log('manifiesto', manifestPath)
