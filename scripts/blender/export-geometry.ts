/**
 * Paso 1 del pipeline de Blender: vuelca la geometría procedural de la casa, etiquetada por
 * pieza y material, más la lista de muebles/árboles y luminarias. Blender la lee en build.py.
 *
 *   npx tsx scripts/blender/export-geometry.ts <carpeta-salida>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { buildHouseTagged } from '../../src/scene/house'
import { LAMPS } from '../../src/data/lighting'

const out = process.argv[2] ?? 'blender-work'
mkdirSync(out, { recursive: true })

const b = buildHouseTagged()
const groups = new Map<string, BufferGeometry[]>()
for (const t of b.tagged) {
  const key = `${t.tag}|${t.mat}`
  let arr = groups.get(key)
  if (!arr) groups.set(key, (arr = []))
  arr.push(t.geom)
}

const chunks: Buffer[] = []
let offset = 0
const meshes: { tag: string; mat: string; offset: number; count: number }[] = []
for (const [key, list] of groups) {
  const g = mergeGeometries(list, false)
  if (!g) continue
  const [tag, mat] = key.split('|')
  const n = g.attributes.position.count
  const data = new Float32Array(n * 8)
  const P = g.attributes.position.array
  const N = g.attributes.normal.array
  const U = g.attributes.uv.array
  for (let i = 0; i < n; i++) {
    data.set([P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], U[i * 2], U[i * 2 + 1]], i * 8)
  }
  chunks.push(Buffer.from(data.buffer))
  meshes.push({ tag, mat, offset, count: n })
  offset += data.byteLength
}
writeFileSync(join(out, 'geometry.bin'), Buffer.concat(chunks))
writeFileSync(
  join(out, 'geometry.json'),
  JSON.stringify({ stride: 8, meshes, placements: b.placements, lamps: LAMPS }, null, 1),
)
console.log(`${meshes.length} mallas, ${b.placements.length} piezas, ${(offset / 1e6).toFixed(1)} MB`)
