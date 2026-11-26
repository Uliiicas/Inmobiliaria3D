import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  SphereGeometry,
  TorusGeometry,
  IcosahedronGeometry,
  Euler,
  Quaternion,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

export type MatKey =
  | 'concrete'
  | 'concreteDark'
  | 'plaster'
  | 'microcement'
  | 'limestone'
  | 'travertine'
  | 'greystone'
  | 'marble'
  | 'basalt'
  | 'bali'
  | 'oak'
  | 'walnut'
  | 'cumaru'
  | 'smoked'
  | 'linen'
  | 'wool'
  | 'leather'
  | 'metal'
  | 'bronze'
  | 'ceramic'
  | 'mirror'
  | 'glass'
  | 'glassFrosted'
  | 'glow'
  | 'cove'
  | 'fire'
  | 'foliage'
  | 'foliageLight'
  | 'trunk'
  | 'grass'
  | 'rock'
  | 'sand'
  | 'art1'
  | 'art2'
  | 'art3'

export interface Opening {
  /** centro a lo largo del muro */
  c: number
  w: number
  /** altura del alféizar */
  b?: number
  h: number
  glass?: boolean
}

const tmpM = new Matrix4()
const tmpQ = new Quaternion()
const tmpE = new Euler()
const tmpV = new Vector3()
const tmpS = new Vector3(1, 1, 1)

/** UV en metros reales para que las texturas mantengan escala física en cualquier caja */
function worldUVBox(w: number, h: number, d: number, cx: number, cy: number, cz: number) {
  const g = new BoxGeometry(w, h, d)
  const uv = g.attributes.uv
  const x0 = cx - w / 2
  const y0 = cy - h / 2
  const z0 = cz - d / 2
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k
      const u = uv.getX(i)
      const v = uv.getY(i)
      if (f < 2) uv.setXY(i, u * d + z0, v * h + y0)
      else if (f < 4) uv.setXY(i, u * w + x0, v * d + z0)
      else uv.setXY(i, u * w + x0, v * h + y0)
    }
  }
  return g
}

function scaleUV(g: BufferGeometry, s: number) {
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * s)
  return g
}

/** Pieza semántica (mueble, árbol…) registrada para el pipeline de Blender */
export interface Placement {
  id: string
  kind: string
  /** posición del pie del objeto */
  p: [number, number, number]
  rot: number
  /** parámetros propios del tipo (medidas, material, escala…) */
  args: Record<string, number | string>
}

export class Builder {
  buckets = new Map<MatKey, BufferGeometry[]>()
  /**
   * Sólo para exportar a Blender: si está activo, cada geometría se guarda además
   * con la etiqueta vigente (arquitectura o la pieza de mobiliario que la generó).
   */
  recordTags = false
  tag = 'arch'
  tagged: { tag: string; mat: MatKey; geom: BufferGeometry }[] = []
  placements: Placement[] = []
  private counter = 0

  /** Ejecuta fn atribuyendo su geometría a una pieza nombrada */
  piece(kind: string, p: [number, number, number], rot: number, args: Record<string, number | string>, fn: () => void) {
    const prev = this.tag
    const id = `${kind}#${this.counter++}`
    if (this.recordTags) this.placements.push({ id, kind, p, rot, args })
    this.tag = id
    try {
      fn()
    } finally {
      this.tag = prev
    }
  }
  /** mallas que no deben proyectar sombra (vidrio, luces) */
  static noShadow: MatKey[] = ['glass', 'glassFrosted', 'glow', 'cove', 'fire', 'mirror']

  add(mat: MatKey, g: BufferGeometry) {
    // todos los atributos deben coincidir para poder fusionar
    if (g.index) g = g.toNonIndexed()
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name)
    }
    if (!g.attributes.uv) {
      const n = g.attributes.position.count
      g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n * 2), 2))
    }
    if (this.recordTags) this.tagged.push({ tag: this.tag, mat, geom: g.clone() })
    let arr = this.buckets.get(mat)
    if (!arr) this.buckets.set(mat, (arr = []))
    arr.push(g)
  }

  /** caja por centro y tamaño, con rotación opcional en Y */
  box(mat: MatKey, cx: number, cy: number, cz: number, w: number, h: number, d: number, rotY = 0) {
    if (w <= 0.0001 || h <= 0.0001 || d <= 0.0001) return
    const g = rotY ? worldUVBox(w, h, d, 0, cy, 0) : worldUVBox(w, h, d, cx, cy, cz)
    if (rotY) {
      tmpM.compose(tmpV.set(cx, cy, cz), tmpQ.setFromEuler(tmpE.set(0, rotY, 0)), tmpS)
      g.applyMatrix4(tmpM)
    } else g.translate(cx, cy, cz)
    this.add(mat, g)
  }

  /** caja por esquinas mínimas y máximas */
  bb(mat: MatKey, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const [ax, bx] = x0 < x1 ? [x0, x1] : [x1, x0]
    const [ay, by] = y0 < y1 ? [y0, y1] : [y1, y0]
    const [az, bz] = z0 < z1 ? [z0, z1] : [z1, z0]
    this.box(mat, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, bx - ax, by - ay, bz - az)
  }

  rounded(
    mat: MatKey,
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    r = 0.06,
    rotY = 0,
  ) {
    const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) - 0.0001)
    scaleUV(g, Math.max(w, d))
    tmpM.compose(tmpV.set(cx, cy, cz), tmpQ.setFromEuler(tmpE.set(0, rotY, 0)), tmpS)
    g.applyMatrix4(tmpM)
    this.add(mat, g)
  }

  cyl(mat: MatKey, cx: number, cy: number, cz: number, rTop: number, rBot: number, h: number, seg = 24) {
    const g = new CylinderGeometry(rTop, rBot, h, seg)
    scaleUV(g, Math.max(rTop, rBot) * 6)
    g.translate(cx, cy, cz)
    this.add(mat, g)
  }

  sphere(mat: MatKey, cx: number, cy: number, cz: number, r: number, sx = 1, sy = 1, sz = 1, detail = 1) {
    const g = detail > 0 ? new IcosahedronGeometry(r, detail) : new SphereGeometry(r, 24, 16)
    g.scale(sx, sy, sz)
    g.translate(cx, cy, cz)
    this.add(mat, g)
  }

  torus(mat: MatKey, cx: number, cy: number, cz: number, R: number, r: number, horizontal = true) {
    const g = new TorusGeometry(R, r, 12, 64)
    if (horizontal) g.rotateX(Math.PI / 2)
    g.translate(cx, cy, cz)
    this.add(mat, g)
  }

  /** cuadrilátero arbitrario (p. ej. baranda inclinada de la escalera) */
  quad(mat: MatKey, a: Vector3, b: Vector3, c: Vector3, d: Vector3) {
    const g = new BufferGeometry()
    const p = [a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z])
    g.setAttribute('position', new Float32BufferAttribute(p, 3))
    g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2))
    g.computeVertexNormals()
    this.add(mat, g)
  }

  /**
   * Muro recto con vanos. axis 'x': corre a lo largo de X en z = fixed. axis 'z': a lo largo de Z en x = fixed.
   */
  wall(
    mat: MatKey,
    axis: 'x' | 'z',
    fixed: number,
    a0: number,
    a1: number,
    y0: number,
    h: number,
    t: number,
    openings: Opening[] = [],
    frame: MatKey = 'metal',
  ) {
    const ops = [...openings].sort((p, q) => p.c - q.c)
    const piece = (s0: number, s1: number, py0: number, py1: number, m: MatKey = mat, th = t) => {
      if (s1 - s0 < 0.001 || py1 - py0 < 0.001) return
      if (axis === 'x') this.bb(m, s0, py0, fixed - th / 2, s1, py1, fixed + th / 2)
      else this.bb(m, fixed - th / 2, py0, s0, fixed + th / 2, py1, s1)
    }
    let cur = a0
    for (const o of ops) {
      const s0 = o.c - o.w / 2
      const s1 = o.c + o.w / 2
      const b = o.b ?? 0
      piece(cur, s0, y0, y0 + h)
      piece(s0, s1, y0, y0 + b) // antepecho
      piece(s0, s1, y0 + b + o.h, y0 + h) // dintel
      if (o.glass) {
        piece(s0, s1, y0 + b, y0 + b + o.h, 'glass', 0.025)
        // marco perimetral fino
        const f = 0.04
        piece(s0, s1, y0 + b, y0 + b + f, frame, t * 0.5)
        piece(s0, s1, y0 + b + o.h - f, y0 + b + o.h, frame, t * 0.5)
      }
      cur = s1
    }
    piece(cur, a1, y0, y0 + h)
  }

  /**
   * Fachada vidriada de piso a techo con montantes. gaps = vanos corredizos abiertos (sin vidrio).
   */
  glazing(
    axis: 'x' | 'z',
    fixed: number,
    a0: number,
    a1: number,
    y0: number,
    h: number,
    spacing = 2.4,
    gaps: { c: number; w: number }[] = [],
    transoms: number[] = [],
  ) {
    const box = (s0: number, s1: number, py0: number, py1: number, m: MatKey, th: number, off = 0) => {
      if (s1 - s0 < 0.001) return
      if (axis === 'x') this.bb(m, s0, py0, fixed - th / 2 + off, s1, py1, fixed + th / 2 + off)
      else this.bb(m, fixed - th / 2 + off, py0, s0, fixed + th / 2 + off, py1, s1)
    }
    // vidrio entre vanos
    let cur = a0
    const sorted = [...gaps].sort((p, q) => p.c - q.c)
    for (const g of sorted) {
      box(cur, g.c - g.w / 2, y0, y0 + h, 'glass', 0.024)
      // hoja corrediza desplazada detrás del paño fijo
      box(g.c - g.w / 2 - g.w * 0.95, g.c - g.w / 2, y0 + 0.02, y0 + h - 0.02, 'glass', 0.024, -0.07)
      cur = g.c + g.w / 2
    }
    box(cur, a1, y0, y0 + h, 'glass', 0.024)
    // montantes
    const n = Math.max(1, Math.round((a1 - a0) / spacing))
    for (let i = 0; i <= n; i++) {
      const s = a0 + ((a1 - a0) * i) / n
      if (sorted.some((g) => Math.abs(s - g.c) < g.w / 2 + 0.03)) continue
      box(s - 0.03, s + 0.03, y0, y0 + h, 'metal', 0.09)
    }
    for (const g of sorted) {
      box(g.c - g.w / 2 - 0.03, g.c - g.w / 2 + 0.03, y0, y0 + h, 'metal', 0.09)
      box(g.c + g.w / 2 - 0.03, g.c + g.w / 2 + 0.03, y0, y0 + h, 'metal', 0.09)
    }
    // perfiles superior e inferior
    box(a0, a1, y0 + h - 0.05, y0 + h, 'metal', 0.1)
    box(a0, a1, y0, y0 + 0.03, 'metal', 0.1)
    for (const ty of transoms) box(a0, a1, ty - 0.025, ty + 0.025, 'metal', 0.08)
  }

  merge() {
    const out = new Map<MatKey, BufferGeometry>()
    for (const [k, list] of this.buckets) {
      const m = mergeGeometries(list, false)
      if (m) {
        m.computeBoundingSphere()
        m.computeBoundingBox()
        out.set(k, m)
      }
      list.forEach((g) => g.dispose())
    }
    this.buckets.clear()
    return out
  }
}
