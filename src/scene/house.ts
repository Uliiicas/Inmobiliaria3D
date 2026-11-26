import { Vector3 } from 'three'
import { Builder } from './builder'
import { CEILING_1, FLOOR_2, ROOF } from '../data/rooms'

/**
 * Construcción procedural de la residencia completa: estructura, fachadas, interiores,
 * mobiliario y paisaje. Todo se fusiona por material para minimizar draw calls.
 */

const F2 = FLOOR_2 + 0.01 // nivel de piso terminado de la planta alta
const H1 = CEILING_1 // altura libre planta baja
const EXT = 0.3 // muros exteriores
const INT = 0.14 // tabiques

/* ─────────────────────────────── estructura ─────────────────────────────── */

function structure(b: Builder) {
  // losa de planta baja + solado
  b.bb('concrete', -14.3, -0.6, -8.3, 14.3, -0.02, 12)
  b.bb('limestone', -14, -0.02, -8, 14, 0, 12) // continuidad interior / galería
  // solado de baños en piedra oscura
  b.bb('basalt', -5, 0, -8, -2, 0.004, -5)
  b.bb('microcement', -14, 0, -3, -10, 0.004, 1)
  // dormitorio de huéspedes en madera
  b.bb('oak', -14, 0, 1, -8, 0.004, 8)

  // losa entre plantas (con vacío del living y de la escalera)
  const slab = (x0: number, z0: number, x1: number, z1: number) => b.bb('plaster', x0, H1, z0, x1, FLOOR_2 - 0.02, z1)
  slab(-14.3, -8.3, -2, 12)
  slab(-0.2, -8.3, 8, 0)
  slab(-2, -8.3, -0.2, -6.8)
  slab(-2, -2.2, -0.2, 0)
  slab(8, -8.3, 14.3, 12)
  slab(-2, 8.15, 8, 12)
  // canto de losa visible del balcón (hormigón)
  b.bb('concrete', -14.3, H1 - 0.05, 11.85, 14.3, FLOOR_2 + 0.02, 12.15)
  // cielorraso de listones de cumarú bajo el voladizo
  for (let x = -13.95; x < 14; x += 0.14) b.bb('cumaru', x, H1 - 0.06, 8.2, x + 0.09, H1, 11.85)

  // pisos de planta alta
  const fl = (m: Parameters<Builder['bb']>[0], x0: number, z0: number, x1: number, z1: number) =>
    b.bb(m, x0, FLOOR_2 - 0.02, z0, x1, F2, z1)
  fl('oak', -10, 2, -2, 9.5) // dormitorio principal
  fl('oak', -8, -8, -2, 2) // antecámara
  fl('limestone', -14, 2, -10, 9.5) // baño principal
  fl('smoked', -14, -8, -8, 2) // vestidor
  fl('oak', -0.2, -8, 8, 0) // sala privada + puente
  fl('oak', -2, -8, -0.2, -6.8) // desembarco
  fl('oak', -2, -2.2, -0.2, 0)
  fl('oak', 8, -4, 14, 9.5) // dormitorios
  fl('limestone', 8, -8, 14, -4) // baño compartido
  fl('cumaru', -14, 9.5, 14, 11.85) // balcón
  fl('cumaru', -2, 8.15, 8, 9.5)

  // cielorraso planta alta y cubierta
  b.bb('plaster', -14.3, ROOF, -8.3, 14.3, ROOF + 0.12, 9.6)
  b.bb('concrete', -14.7, ROOF + 0.12, -8.7, 14.7, ROOF + 0.5, 10.6)
  // alero de hormigón sobre el balcón
  b.bb('concrete', -14.7, ROOF - 0.05, 9.6, 14.7, ROOF + 0.12, 10.6)
  // iluminación arquitectónica rasante bajo los aleros (se enciende al anochecer)
  b.bb('cove', -14.5, ROOF + 0.1, -8.62, 14.5, ROOF + 0.12, -8.5)
  b.bb('cove', -14.5, ROOF - 0.07, 10.4, 14.5, ROOF - 0.05, 10.5)
  b.bb('cove', -14.2, H1 - 0.08, 11.8, 14.2, H1 - 0.06, 11.85)
  // cubierta: grava clara + lucernarios
  b.bb('greystone', -14.4, ROOF + 0.5, -8.4, 14.4, ROOF + 0.52, 10.3)
}

/* ─────────────────────────────── planta baja ─────────────────────────────── */

function groundFloor(b: Builder) {
  const y = 0
  // Fachada norte (acceso): hormigón visto con puerta pivotante y ranura vidriada
  b.wall('concrete', 'x', -8.15, -14.3, 14.3, y, H1, EXT, [
    { c: 2, w: 2.0, h: 3.2 },
    { c: 4.3, w: 0.6, h: H1 - 0.01, glass: true },
    { c: 11, w: 4, b: 1.05, h: 1.35, glass: true },
    { c: -12, w: 1.6, b: 1.7, h: 0.8, glass: true },
    { c: -8, w: 0.5, b: 0.0, h: H1 - 0.01, glass: true },
  ])
  // Fachada oeste: piedra gris
  b.wall('greystone', 'z', -14.15, -8.3, 8, y, H1, EXT, [
    { c: 4.5, w: 3, b: 0.45, h: 2.5, glass: true },
    { c: -1, w: 0.5, b: 1.2, h: 1.6, glass: true },
  ])
  // Fachada este: hormigón con paño vidriado del comedor
  b.wall('concrete', 'z', 14.15, -8.3, 8, y, H1, EXT, [{ c: 5, w: 5, b: 0, h: H1 - 0.01, glass: true }])
  // Frente al océano: vidrio de piso a techo (el living sube a doble altura)
  b.glazing('x', 8, -14, -2, y, H1, 2, [
    { c: -11, w: 1.6 },
    { c: -5, w: 1.6 },
  ])
  b.glazing('x', 8, -2, 8, y, ROOF, 2.5, [{ c: 4.5, w: 2.0 }], [H1 + 0.15])
  b.glazing('x', 8, 8, 14, y, H1, 2, [{ c: 11.2, w: 1.6 }])
  // columnas de hormigón que marcan el ritmo
  for (const x of [-14.15, -8, -2, 8, 14.15]) b.bb('concrete', x - 0.15, y, 7.85, x + 0.15, x === -2 || x === 8 ? ROOF : H1, 8.15)

  // tabiques interiores
  b.wall('concrete', 'z', -2, -8, 8, y, H1, 0.25, [
    { c: -1, w: 1.4, h: 2.6 },
    { c: 4.5, w: 3.0, h: 2.9 },
  ])
  // el muro de hormigón del living sube a doble altura
  b.bb('concrete', -2.125, H1, 1.0, -1.875, ROOF, 7.85)
  b.wall('plaster', 'z', 8, -8, -2, y, H1, INT, [{ c: -4.5, w: 2.4, h: 2.8 }])
  // baño de visitas, depósito, lavadero, baño de huéspedes
  b.wall('plaster', 'x', -5, -5, -2.12, y, H1, INT, [{ c: -3.5, w: 0.9, h: 2.4 }])
  b.wall('plaster', 'z', -5, -8, -5, y, H1, INT)
  b.wall('plaster', 'x', -5, -10, -5, y, H1, INT)
  b.wall('plaster', 'z', -10, -8, 1, y, H1, INT, [{ c: -4, w: 0.9, h: 2.4 }])
  b.wall('plaster', 'x', -3, -14, -10, y, H1, INT)
  b.wall('plaster', 'x', 1, -14, -8, y, H1, INT, [
    { c: -12, w: 0.9, h: 2.4 },
    { c: -9, w: 0.95, h: 2.4 },
  ])
  b.wall('plaster', 'z', -8, 1, 7.85, y, H1, INT)

  // muro de travertino en la sala de estar (cara este del tabique)
  b.bb('travertine', -7.93, 0, 1.2, -7.88, H1, 7.8)
  // revestimiento de basalto del baño de visitas
  b.bb('basalt', -4.93, 0, -7.98, -2.14, H1, -7.94)
  b.bb('basalt', -4.92, 0, -7.95, -4.9, H1, -5.1)

  // escalera escultórica en voladizo (17 peldaños)
  const steps = 17
  const rise = F2 / steps
  const going = 0.27
  for (let i = 0; i < steps; i++) {
    const zc = -2.25 - (i + 0.5) * going
    b.bb('oak', -1.88, (i + 1) * rise - 0.09, zc - going / 2 - 0.01, -0.3, (i + 1) * rise, zc + going / 2)
    // luz rasante bajo cada peldaño
    b.bb('cove', -1.86, (i + 1) * rise - 0.095, zc - 0.02, -0.34, (i + 1) * rise - 0.09, zc + 0.02)
  }
  b.quad(
    'glass',
    new Vector3(-0.28, 0.1, -2.2),
    new Vector3(-0.28, 0.1 + 0.15, -2.2 - going * 1),
    new Vector3(-0.28, F2 + 1.05, -2.25 - steps * going),
    new Vector3(-0.28, 1.05 + 0.2, -2.2),
  )
  b.quad(
    'glass',
    new Vector3(-0.28, 1.05 + 0.2, -2.2),
    new Vector3(-0.28, F2 + 1.05, -2.25 - steps * going),
    new Vector3(-0.28, rise * 2, -2.25 - steps * going),
    new Vector3(-0.28, 0.1, -2.2),
  )
}

/* ─────────────────────────────── planta alta ─────────────────────────────── */

function upperFloor(b: Builder) {
  const y = F2
  const h = ROOF - F2
  // Fachada norte: revestimiento de listones verticales de cumarú sobre muro oscuro
  b.wall('concreteDark', 'x', -8.15, -14.3, 14.3, y, h, EXT, [
    { c: 3.8, w: 7.4, b: 0.75, h: 1.6, glass: true },
    { c: 11, w: 2.2, b: 1.6, h: 0.7, glass: true },
  ])
  for (let x = -14.25; x < 14.3; x += 0.16) {
    if (x > 0.05 && x < 7.55) {
      b.bb('cumaru', x, y, -8.42, x + 0.07, y + 0.75, -8.3)
      b.bb('cumaru', x, y + 2.35, -8.42, x + 0.07, ROOF, -8.3)
      continue
    }
    if (x > 9.85 && x < 12.15) {
      b.bb('cumaru', x, y, -8.42, x + 0.07, y + 1.6, -8.3)
      b.bb('cumaru', x, y + 2.3, -8.42, x + 0.07, ROOF, -8.3)
      continue
    }
    b.bb('cumaru', x, y, -8.42, x + 0.07, ROOF, -8.3)
  }
  // Oeste: piedra
  b.wall('greystone', 'z', -14.15, -8.3, 9.5, y, h, EXT, [{ c: 6, w: 0.6, b: 0.4, h: 2.4, glass: true }])
  // Este: hormigón con vidrio en esquina para el dormitorio secundario
  b.wall('concrete', 'z', 14.15, -8.3, 9.5, y, h, EXT, [
    { c: -0.5, w: 5, b: 0.5, h: 2.2, glass: true },
    { c: 6.5, w: 5.6, b: 0, h: h - 0.01, glass: true },
  ])
  // Sur: vidrio sobre el balcón
  b.glazing('x', 9.5, -14, -2, y, h, 2, [{ c: -6, w: 1.8 }], [])
  b.glazing('x', 9.5, 8, 14, y, h, 2, [{ c: 11, w: 1.6 }], [])
  b.bb('concrete', -10.15, y, 9.35, -9.85, ROOF, 9.65)
  // cierre lateral de los dormitorios frente al vacío del living
  b.wall('concrete', 'z', -2, 2, 9.5, y, h, 0.25)
  b.wall('concrete', 'z', 8, 2.5, 9.5, y, h, 0.25)

  // tabiques
  b.wall('plaster', 'z', -2, -8, 2, y, h, INT, [
    { c: -7.4, w: 1.1, h: 2.6 },
    { c: -1, w: 1.5, h: 2.6 },
  ])
  b.wall('plaster', 'x', 2, -14, -2, y, h, INT, [
    { c: -12, w: 0.9, h: 2.4 },
    { c: -9, w: 0.9, h: 2.4 },
    { c: -2.85, w: 1.0, h: 2.6 },
  ])
  b.wall('plaster', 'z', -8, -8, 2, y, h, INT)
  b.wall('glassFrosted', 'z', -10, 2, 9.35, y, h, 0.06, [{ c: 6, w: 1.0, h: 2.5 }])
  b.wall('plaster', 'z', 8, -8, -2.0, y, h, INT, [])
  b.wall('plaster', 'z', 8, -2.0, 2.5, y, h, INT, [{ c: -1, w: 1.6, h: 2.6 }])
  b.wall('plaster', 'x', -4, 8, 14, y, h, INT, [{ c: 8.7, w: 0.9, h: 2.4 }])
  b.wall('plaster', 'z', 9.4, -4, 2.5, y, h, INT, [{ c: 0.6, w: 0.95, h: 2.4 }])
  b.wall('plaster', 'x', 2.5, 8, 14, y, h, INT, [{ c: 8.7, w: 0.95, h: 2.4 }])

  // barandas de vidrio sobre los vacíos
  const rail = (x0: number, z0: number, x1: number, z1: number, yy = y) => {
    b.bb('glass', x0, yy, z0, x1, yy + 1.05, z1)
    b.bb('metal', x0, yy + 1.03, z0, x1, yy + 1.06, z1)
  }
  rail(-2, -0.02, 8, 0.02) // puente sobre el living
  rail(-0.22, -6.8, -0.18, -2.2) // vacío de escalera, lado sala privada
  rail(-2, -2.22, -0.2, -2.18)
  rail(-14, 11.98, 14, 12.02) // balcón
  rail(-14.02, 9.5, -13.98, 12)
  rail(13.98, 9.5, 14.02, 12)
  // borde del puente: canto de roble
  b.bb('oak', -2, H1, -0.06, 8, F2, 0.0)
}

/* ─────────────────────────────── mobiliario ─────────────────────────────── */

function sofa_(b: Builder, x: number, y: number, z: number, w: number, d: number, rot: number, mat: 'linen' | 'wool' | 'leather' = 'linen') {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c]
  // base y asiento
  let p = at(0, 0)
  b.rounded(mat, p[0], y + 0.2, p[1], w, 0.4, d, 0.05, rot)
  p = at(0, -d / 2 + 0.13)
  b.rounded(mat, p[0], y + 0.55, p[1], w, 0.42, 0.26, 0.08, rot)
  // almohadones
  const n = Math.max(2, Math.round(w / 1.0))
  for (let i = 0; i < n; i++) {
    const lx = -w / 2 + (w / n) * (i + 0.5)
    p = at(lx, 0.08)
    b.rounded(mat, p[0], y + 0.46, p[1], w / n - 0.04, 0.14, d - 0.32, 0.06, rot)
  }
  p = at(0, 0)
  b.box('metal', p[0], y + 0.02, p[1], w - 0.1, 0.04, d - 0.1, rot)
}

function armchair_(b: Builder, x: number, y: number, z: number, rot: number, mat: 'linen' | 'wool' | 'leather' = 'wool') {
  b.rounded(mat, x, y + 0.22, z, 0.85, 0.44, 0.85, 0.12, rot)
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  b.rounded(mat, x - 0.34 * s, y + 0.55, z - 0.34 * c, 0.85, 0.5, 0.18, 0.08, rot)
}

function bed_(b: Builder, x: number, y: number, z: number, w: number, l: number, rot: number) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c]
  // plataforma flotante
  b.box('walnut', x, y + 0.2, z, w + 0.3, 0.16, l + 0.2, rot)
  b.box('cove', x, y + 0.11, z, w + 0.1, 0.02, l, rot)
  // colchón y ropa de cama
  b.rounded('linen', x, y + 0.42, z, w, 0.3, l, 0.08, rot)
  let p = at(0, l * 0.22)
  b.rounded('wool', p[0], y + 0.585, p[1], w + 0.04, 0.04, l * 0.45, 0.02, rot)
  p = at(-w * 0.24, -l / 2 + 0.3)
  b.rounded('linen', p[0], y + 0.66, p[1], w * 0.42, 0.18, 0.4, 0.08, rot)
  p = at(w * 0.24, -l / 2 + 0.3)
  b.rounded('linen', p[0], y + 0.66, p[1], w * 0.42, 0.18, 0.4, 0.08, rot)
  // mesas de luz suspendidas con lámpara
  for (const side of [-1, 1]) {
    p = at(side * (w / 2 + 0.45), -l / 2 + 0.25)
    b.box('walnut', p[0], y + 0.48, p[1], 0.55, 0.08, 0.42, rot)
    b.cyl('bronze', p[0], y + 0.75, p[1], 0.012, 0.012, 0.45, 8)
    b.cyl('glow', p[0], y + 1.0, p[1], 0.1, 0.13, 0.16, 20)
  }
}

function table_(b: Builder, x: number, y: number, z: number, w: number, d: number, h: number, top: 'walnut' | 'marble' | 'travertine' | 'oak', rot = 0) {
  b.box(top, x, y + h - 0.03, z, w, 0.06, d, rot)
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  for (const side of [-1, 1]) {
    const lx = side * (w / 2 - 0.35)
    b.box(top === 'marble' ? 'marble' : 'metal', x + lx * c, y + (h - 0.06) / 2, z - lx * s, 0.08, h - 0.06, d * 0.7, rot)
  }
}

function chair_(b: Builder, x: number, y: number, z: number, rot: number) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  b.rounded('linen', x, y + 0.46, z, 0.5, 0.08, 0.5, 0.03, rot)
  b.rounded('linen', x - 0.23 * s, y + 0.75, z - 0.23 * c, 0.5, 0.55, 0.06, 0.03, rot)
  for (const [lx, lz] of [
    [-0.21, -0.21],
    [0.21, -0.21],
    [-0.21, 0.21],
    [0.21, 0.21],
  ])
    b.box('oak', x + lx * c + lz * s, y + 0.21, z - lx * s + lz * c, 0.035, 0.42, 0.035, rot)
}

function rug_(b: Builder, x: number, y: number, z: number, w: number, d: number, rot = 0) {
  b.rounded('wool', x, y + 0.012, z, w, 0.024, d, 0.01, rot)
}

function plant_(b: Builder, x: number, y: number, z: number, scale = 1) {
  b.cyl('concreteDark', x, y + 0.25 * scale, z, 0.28 * scale, 0.22 * scale, 0.5 * scale, 20)
  b.cyl('trunk', x, y + 0.9 * scale, z, 0.02 * scale, 0.03 * scale, 0.9 * scale, 6)
  for (let k = 0; k < 6; k++) {
    const a = k * 2.4
    b.sphere(k % 2 ? 'foliageLight' : 'foliage', x + Math.cos(a) * 0.18 * scale, y + (1.35 + (k % 3) * 0.18) * scale, z + Math.sin(a) * 0.18 * scale, 0.24 * scale, 1.2, 0.8, 1.1, 2)
  }
}

function floorLamp_(b: Builder, x: number, y: number, z: number) {
  b.cyl('metal', x, y + 0.01, z, 0.16, 0.16, 0.02, 20)
  b.cyl('metal', x, y + 0.8, z, 0.012, 0.012, 1.6, 8)
  b.cyl('glow', x, y + 1.62, z, 0.16, 0.22, 0.24, 24)
}

function pendantLine_(b: Builder, x: number, y: number, z: number, len: number, alongX = true) {
  const w = alongX ? len : 0.06
  const d = alongX ? 0.06 : len
  b.box('bronze', x, y + 0.03, z, w, 0.04, d)
  b.box('glow', x, y, z, w - 0.04, 0.012, d - 0.02)
  for (const s of [-1, 1]) {
    const ox = alongX ? (s * len) / 2.5 : 0
    const oz = alongX ? 0 : (s * len) / 2.5
    b.cyl('metal', x + ox, y + 0.6, z + oz, 0.004, 0.004, 1.15, 4)
  }
}


/* Envoltorios que registran cada pieza para el pipeline de Blender (scripts/blender) */
type Up = 'linen' | 'wool' | 'leather'
function sofa(b: Builder, x: number, y: number, z: number, w: number, d: number, rot: number, mat: Up = 'linen') {
  b.piece('sofa', [x, y, z], rot, { w, d, mat }, () => sofa_(b, x, y, z, w, d, rot, mat))
}
function armchair(b: Builder, x: number, y: number, z: number, rot: number, mat: Up = 'wool') {
  b.piece('armchair', [x, y, z], rot, { mat }, () => armchair_(b, x, y, z, rot, mat))
}
function bed(b: Builder, x: number, y: number, z: number, w: number, l: number, rot: number) {
  b.piece('bed', [x, y, z], rot, { w, l }, () => bed_(b, x, y, z, w, l, rot))
}
function table(b: Builder, x: number, y: number, z: number, w: number, d: number, h: number, top: 'walnut' | 'marble' | 'travertine' | 'oak', rot = 0) {
  b.piece('table', [x, y, z], rot, { w, d, h, top }, () => table_(b, x, y, z, w, d, h, top, rot))
}
function chair(b: Builder, x: number, y: number, z: number, rot: number) {
  b.piece('chair', [x, y, z], rot, {}, () => chair_(b, x, y, z, rot))
}
function rug(b: Builder, x: number, y: number, z: number, w: number, d: number, rot = 0) {
  b.piece('rug', [x, y, z], rot, { w, d }, () => rug_(b, x, y, z, w, d, rot))
}
function plant(b: Builder, x: number, y: number, z: number, scale = 1) {
  b.piece('plant', [x, y, z], 0, { scale }, () => plant_(b, x, y, z, scale))
}
function floorLamp(b: Builder, x: number, y: number, z: number) {
  b.piece('floorLamp', [x, y, z], 0, {}, () => floorLamp_(b, x, y, z))
}
function pendantLine(b: Builder, x: number, y: number, z: number, len: number, alongX = true) {
  b.piece('pendantLine', [x, y, z], 0, { len, alongX: alongX ? 1 : 0 }, () => pendantLine_(b, x, y, z, len, alongX))
}

function furnishGround(b: Builder) {
  const y = 0.004
  // ── Hall
  b.box('oak', 5.6, 0.22, -7.65, 3.2, 0.44, 0.45) // banco
  b.box('travertine', 5, 0.45, -4.3, 0.8, 0.9, 0.8) // pedestal
  b.piece('sculpture', [5, 0.9, -4.3], 0, {}, () => b.sphere('bronze', 5, 1.28, -4.3, 0.36, 1, 1.05, 1, 3))
  b.box('art1', 6.2, 1.9, -8.0, 1.8, 2.2, 0.04)
  b.box('cove', 3, H1 - 0.03, -5, 0.05, 0.02, 5.5)
  plant(b, 0.4, y, -7.4, 1.25)

  // ── Living de doble altura
  rug(b, 3, y, 3.6, 5.2, 3.8)
  sofa(b, 3, y, 2.4, 3.6, 1.05, 0)
  sofa(b, 0.2, y, 4.2, 2.2, 1.0, Math.PI / 2)
  armchair(b, 5.4, y, 5.0, -Math.PI * 0.62)
  armchair(b, 5.6, y, 3.4, -Math.PI * 0.4)
  table(b, 3, y, 3.9, 1.6, 0.9, 0.34, 'travertine')
  b.box('travertine', 3.6, y + 0.17, 4.9, 0.6, 0.34, 0.6)
  b.sphere('ceramic', 2.6, y + 0.43, 3.9, 0.09, 1, 0.9, 1, 2)
  b.box('walnut', 3.3, y + 0.38, 3.75, 0.5, 0.06, 0.32)
  floorLamp(b, 1.1, y, 2.0)
  // hogar suspendido sobre banco de hormigón junto al muro
  b.bb('concrete', -1.88, 0, -1.6, -1.1, 0.42, 2.8)
  b.bb('metal', -1.86, 0.42, -0.2, -1.2, 0.95, 1.4)
  b.bb('fire', -1.6, 0.48, 0.0, -1.18, 0.62, 1.2)
  // anillo de luz suspendido
  b.torus('bronze', 3, 5.2, 3.6, 1.2, 0.03)
  b.torus('glow', 3, 5.17, 3.6, 1.2, 0.018)
  for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) b.cyl('metal', 3 + Math.cos(a) * 1.2, 6.15, 3.6 + Math.sin(a) * 1.2, 0.004, 0.004, 1.9, 4)
  plant(b, 7.2, y, 7.2, 1.5)
  plant(b, -1.2, y, 7.2, 1.1)
  // obra de arte de gran formato sobre el muro de hormigón
  b.box('art2', -1.97, 4.9, 4.4, 0.04, 2.6, 3.6)

  // ── Comedor
  rug(b, 11, y, 5, 4.6, 2.8)
  table(b, 11, y, 5, 3.6, 1.1, 0.75, 'walnut')
  for (let i = 0; i < 4; i++) {
    const x = 9.65 + i * 0.9
    chair(b, x, y, 4.15, 0)
    chair(b, x, y, 5.85, Math.PI)
  }
  chair(b, 8.85, y, 5, Math.PI / 2)
  chair(b, 13.15, y, 5, -Math.PI / 2)
  pendantLine(b, 11, 2.3, 5, 2.8)
  b.box('walnut', 13.65, 0.4, 2.6, 0.6, 0.8, 0.12) // aparador frente al vidrio, bajo
  plant(b, 13.4, y, 7.4, 1.0)

  // ── Cocina
  b.box('marble', 11, 0.46, -2.6, 4.2, 0.92, 1.3)
  b.box('marble', 11, 0.93, -2.6, 4.24, 0.03, 1.34)
  for (let i = 0; i < 4; i++) {
    const x = 9.6 + i * 0.95
    b.piece('stool', [x, 0, -1.55], 0, {}, () => {
      b.cyl('leather', x, 0.72, -1.55, 0.2, 0.2, 0.06, 18)
      b.cyl('metal', x, 0.36, -1.55, 0.02, 0.12, 0.7, 8)
    })
  }
  // muebles bajos bajo la ventana norte
  b.bb('oak', 8.1, 0, -7.98, 13.98, 0.88, -7.33)
  b.bb('marble', 8.1, 0.88, -8.0, 13.98, 0.92, -7.3)
  b.bb('metal', 10.5, 0.92, -7.75, 11.5, 0.93, -7.45) // anafe
  // columnas de guardado en roble
  b.bb('oak', 13.33, 0, -7.3, 13.98, 2.7, -0.6)
  b.bb('plaster', 13.33, 2.7, -7.3, 13.98, H1, -0.6)
  b.bb('metal', 13.3, 0.9, -4.6, 13.33, 2.0, -3.6) // horno
  pendantLine(b, 11, 2.25, -2.6, 3.4)

  // ── Sala de estar
  rug(b, -4.8, y, 4.6, 3.6, 3.2)
  sofa(b, -3.0, y, 4.6, 2.8, 1.0, -Math.PI / 2, 'wool')
  armchair(b, -6.3, y, 3.4, Math.PI * 0.75, 'leather')
  armchair(b, -6.3, y, 5.8, Math.PI * 0.25, 'leather')
  table(b, -4.7, y, 4.6, 0.9, 0.9, 0.36, 'oak')
  b.bb('walnut', -7.86, 0.4, 2.0, -7.5, 0.5, 7.2) // repisa flotante
  floorLamp(b, -6.9, y, 7.2)
  b.box('art3', -7.85, 1.9, 4.6, 0.03, 1.3, 1.9)
  // circulación
  b.bb('walnut', -9.6, 0, -4.6, -6.0, 0.8, -4.2)
  b.bb('cove', -9.6, H1 - 0.04, -1.2, -2.4, H1 - 0.02, -1.15)

  // ── Baño de visitas
  b.box('basalt', -3.5, 0.6, -7.65, 1.1, 0.42, 0.55)
  b.box('mirror', -3.5, 1.55, -7.9, 0.9, 1.1, 0.02)
  b.box('cove', -3.5, 2.12, -7.88, 0.9, 0.02, 0.03)
  b.box('ceramic', -2.5, 0.22, -6.9, 0.38, 0.44, 0.6)

  // ── Lavadero
  b.bb('oak', -13.98, 0, -7.98, -10.2, 0.9, -7.35)
  b.bb('ceramic', -13.98, 0.9, -7.98, -10.2, 0.94, -7.3)
  b.bb('oak', -13.98, 1.5, -7.98, -10.2, 2.4, -7.6)
  b.bb('ceramic', -13.4, 0, -4.2, -12.8, 0.85, -3.6)

  // ── Huéspedes
  bed(b, -11.4, y, 2.6, 1.8, 2.1, 0)
  rug(b, -11.4, y, 3.4, 3.2, 2.6)
  armchair(b, -9.2, y, 6.3, Math.PI * 0.85, 'linen')
  b.box('art1', -11.4, 1.8, 1.09, 1.6, 1.0, 0.02)
  // ── Baño de huéspedes
  b.bb('glass', -12.2, 0, -2.9, -12.17, 2.4, -0.6)
  b.bb('microcement', -13.98, 0.55, -0.4, -12.6, 0.9, 0.9)
  b.box('mirror', -13.97, 1.6, 0.25, 0.02, 1.0, 1.0)
  b.box('ceramic', -10.4, 0.22, -2.5, 0.38, 0.44, 0.6)
}

function furnishUpper(b: Builder) {
  const y = F2
  // ── Sala privada / biblioteca
  b.bb('smoked', 7.55, y, -7.8, 7.95, y + 2.8, -2.4)
  for (let k = 1; k < 6; k++) b.bb('cove', 7.5, y + k * 0.48 - 0.02, -7.75, 7.55, y + k * 0.48, -2.45)
  // libros (bloques de color sobrio)
  for (let k = 0; k < 5; k++) {
    for (let j = 0; j < 9; j++) {
      const z0 = -7.7 + j * 0.58
      const w = 0.25 + ((j * 7 + k * 3) % 5) * 0.05
      b.bb(j % 3 === 0 ? 'leather' : j % 3 === 1 ? 'linen' : 'wool', 7.25, y + 0.03 + k * 0.48, z0, 7.53, y + 0.3 + k * 0.48 - ((j + k) % 2) * 0.04, z0 + w)
    }
  }
  rug(b, 3.6, y, -5, 4.2, 3.2)
  sofa(b, 3.4, y, -6.9, 3.0, 1.0, 0, 'wool')
  armchair(b, 5.8, y, -4.2, -Math.PI * 0.6, 'leather')
  armchair(b, 1.3, y, -4.2, Math.PI * 0.6, 'leather')
  table(b, 3.4, y, -5.2, 1.4, 0.8, 0.34, 'walnut')
  floorLamp(b, 6.6, y, -7.4)
  b.bb('cove', 0.2, ROOF - 0.03, -7.8, 7.4, ROOF - 0.01, -7.6)

  // ── Dormitorio principal
  b.bb('walnut', -8.6, y, 2.08, -3.4, y + 2.8, 2.22)
  b.bb('cove', -8.6, y + 2.8, 2.2, -3.4, y + 2.83, 2.3)
  bed(b, -6, y, 3.5, 2.0, 2.2, 0)
  rug(b, -6, y, 4.5, 4.2, 3.2)
  b.box('oak', -6, y + 0.22, 5.05, 1.6, 0.44, 0.45) // banco a los pies
  armchair(b, -3.2, y, 7.6, -Math.PI * 0.8, 'linen')
  plant(b, -9.3, y, 8.9, 1.0)
  // antecámara
  b.box('art2', -2.1, y + 1.7, -4.5, 0.03, 1.8, 2.4)
  b.bb('walnut', -7.9, y, -5, -7.5, y + 0.8, -2)

  // ── Vestidor
  for (const x of [-13.98, -8.55]) {
    b.bb('smoked', x, y, -7.9, x + 0.55, y + 2.6, 1.6)
    for (let k = 1; k < 5; k++) b.bb('cove', x + (x < -10 ? 0.55 : -0.02), y + k * 0.6, -7.8, x + (x < -10 ? 0.57 : 0), y + k * 0.6 + 0.02, 1.5)
  }
  b.box('leather', -11, y + 0.45, -3, 1.2, 0.9, 3.2)
  b.box('glass', -11, y + 0.92, -3, 1.24, 0.04, 3.24)
  b.box('mirror', -11, y + 1.4, -7.92, 1.2, 2.2, 0.02)

  // ── Baño principal
  b.rounded('ceramic', -12, y + 0.29, 8.15, 1.9, 0.58, 0.9, 0.25)
  b.rounded('bali', -12, y + 0.5, 8.15, 1.7, 0.1, 0.7, 0.05)
  b.bb('travertine', -13.98, y, 2.1, -13.93, ROOF, 9.4)
  b.bb('travertine', -13.93, y + 0.75, 3.2, -13.4, y + 0.9, 6.0)
  b.box('mirror', -13.92, y + 1.65, 4.6, 0.02, 1.1, 2.6)
  b.box('cove', -13.9, y + 2.25, 4.6, 0.03, 0.02, 2.6)
  b.bb('glass', -13.9, y, 2.9, -11.2, y + 2.4, 2.93)
  plant(b, -10.6, y, 8.9, 0.8)

  // ── Dormitorio secundario
  bed(b, 11, y, 3.85, 1.8, 2.1, 0)
  rug(b, 11, y, 4.8, 3.2, 2.6)
  armchair(b, 13.2, y, 8.3, -Math.PI * 0.8, 'linen')
  b.box('art3', 11, y + 1.8, 2.58, 1.6, 1.0, 0.02)

  // ── Dormitorio terciario
  bed(b, 11.7, y, -2.8, 1.6, 2.0, 0)
  b.bb('oak', 13.35, y + 0.74, -3, 13.98, y + 0.78, -0.6) // escritorio frente a la ventana
  chair(b, 13.0, y, -1.8, -Math.PI / 2)
  rug(b, 11.7, y, -1.4, 2.6, 2.0)

  // ── Baño compartido
  b.bb('travertine', 8.1, y + 0.75, -7.98, 12, y + 0.9, -7.4)
  b.box('mirror', 10.05, y + 1.65, -7.97, 3.6, 1.1, 0.02)
  b.bb('glass', 12.3, y, -7.98, 12.33, y + 2.4, -5.2)

  // ── Balcón
  for (const x of [-12, -10.6, 9.6, 11.0]) b.piece('lounger', [x, y, 10.9], 0, { base: 0 }, () => b.rounded('linen', x, y + 0.2, 10.9, 0.75, 0.3, 1.8, 0.08))
  for (const x of [-3, 6]) {
    b.piece('planter', [x, y, 11.5], 0, { w: 1.6, d: 0.5, h: 0.6 }, () => {
      b.box('concrete', x, y + 0.3, 11.5, 1.6, 0.6, 0.5)
      b.sphere('foliage', x, y + 0.8, 11.5, 0.45, 1.6, 0.6, 0.5, 1)
    })
  }
}

/* ─────────────────────────────── exteriores ─────────────────────────────── */

function exterior(b: Builder) {
  // terreno: meseta sobre el acantilado
  b.bb('grass', -60, -0.62, -60, 60, -0.6, 20)
  // patio de acceso: espejo de agua con muelle de piedra
  b.bb('basalt', -4.5, -0.6, -17, 8.5, -0.3, -8.3) // fondo del espejo de agua
  b.bb('concrete', -4.7, -0.6, -17.2, 8.7, -0.02, -17) // bordes
  b.bb('concrete', -4.7, -0.6, -17.2, -4.5, -0.02, -8.3)
  b.bb('concrete', 8.5, -0.6, -17.2, 8.7, -0.02, -8.3)
  // losas flotantes del muelle
  for (let i = 0; i < 8; i++) {
    const z = -16.2 + i * 1.0
    b.bb('greystone', 0.6, -0.04, z, 3.4, 0.0, z + 0.85)
    b.bb('cove', 0.7, -0.06, z + 0.4, 3.3, -0.05, z + 0.45)
  }
  // camino desde la calle
  for (let i = 0; i < 12; i++) {
    const z = -30 + i * 1.1
    b.bb('greystone', 0.6, -0.6, z, 3.4, -0.58, z + 0.9)
  }
  // muros bajos de hormigón del jardín de acceso
  b.bb('concrete', -14.3, -0.6, -24, -13.9, 1.2, -8.3)
  b.bb('concrete', 13.9, -0.6, -24, 14.3, 1.2, -8.3)
  b.bb('concrete', -14.3, -0.6, -24.2, -1.5, 1.2, -23.8)
  b.bb('concrete', 5.5, -0.6, -24.2, 14.3, 1.2, -23.8)
  // canteros de grava
  b.bb('sand', -13.9, -0.6, -23.8, -4.7, -0.5, -8.3)
  b.bb('sand', 8.7, -0.6, -23.8, 13.9, -0.5, -8.3)
  // balizas
  for (const z of [-22, -19, -16, -13, -10]) {
    for (const x of [-0.2, 4.2]) {
      b.box('metal', x, -0.3, z, 0.12, 0.6, 0.12)
      b.box('glow', x, -0.08, z + 0.065, 0.08, 0.1, 0.01)
    }
  }

  // ── terraza sur: deck de cumarú con piscina infinita
  const deckY = -0.02
  // base de la terraza (con hueco para el vaso de la piscina)
  b.bb('concrete', -16.3, -0.62, 12, 16.3, deckY - 0.02, 13.45)
  b.bb('concrete', -16.3, -0.62, 13.45, -11.05, deckY - 0.02, 20)
  b.bb('concrete', 11.05, -0.62, 13.45, 16.3, deckY - 0.02, 20)
  b.bb('concrete', -11.05, -0.62, 19.1, 11.05, -0.4, 20)
  const deck = (x0: number, z0: number, x1: number, z1: number) => b.bb('cumaru', x0, deckY - 0.02, z0, x1, deckY, z1)
  deck(-16, 12, 16, 13.5)
  deck(-16, 13.5, -11, 20)
  deck(11, 13.5, 16, 20)
  // vaso de la piscina revestido en piedra
  b.bb('bali', -11, -1.5, 13.5, 11, -1.4, 18) // fondo
  b.bb('bali', -11.05, -1.5, 13.45, 11.05, deckY - 0.03, 13.5)
  b.bb('bali', -11.05, -1.5, 13.5, -11, deckY - 0.03, 18)
  b.bb('bali', 11, -1.5, 13.5, 11.05, deckY - 0.03, 18)
  // borde de desborde (más bajo) y canal
  b.bb('bali', -11.05, -1.5, 18, 11.05, -0.1, 18.15)
  b.bb('basalt', -11.05, -1.0, 18.15, 11.05, -0.55, 18.9)
  b.bb('concrete', -11.05, -1.0, 18.9, 11.05, -0.4, 19.1)
  // escalón sumergido / solárium en el agua
  b.bb('bali', -11, -1.5, 13.5, -7, -0.35, 15)
  // luces bajo el agua
  for (let x = -9; x <= 9; x += 3) b.box('glow', x, -0.9, 13.52, 0.3, 0.12, 0.01)

  // muro de contención y acantilado
  b.bb('concrete', -16.3, -2.5, 19.8, 16.3, -0.02, 20.2)
  b.bb('rock', -60, -12, 20.2, 60, -0.62, 22)
  b.bb('rock', -60, -12, 22, 60, -2.5, 25)
  b.bb('rock', -60, -12, 25, 60, -6.5, 29)
  for (let i = 0; i < 26; i++) {
    const x = -55 + i * 4.3 + ((i * 37) % 7) * 0.3
    const s = 2 + ((i * 13) % 5) * 0.6
    b.sphere('rock', x, -8, 27 + ((i * 7) % 4), s, 1.4, 0.9, 1.2, 1)
  }
  // playa
  b.bb('sand', -200, -9.2, 24, 200, -8.95, 36)

  // ── terraza este: fogón y camastros
  b.cyl('concrete', 13.5, 0.15, 16.4, 0.9, 0.95, 0.34, 32)
  b.cyl('basalt', 13.5, 0.33, 16.4, 0.7, 0.7, 0.02, 32)
  b.cyl('fire', 13.5, 0.38, 16.4, 0.35, 0.45, 0.06, 24)
  sofa(b, 13.5, deckY, 18.4, 2.4, 0.9, Math.PI, 'linen')
  sofa(b, 15.3, deckY, 16.4, 2.0, 0.9, -Math.PI / 2, 'linen')
  // camastros a lo largo de la piscina
  for (const x of [-15, -13]) {
    b.piece('lounger', [x, 0, 16.5], 0, { base: 1 }, () => {
      b.rounded('linen', x, 0.2, 16.5, 0.75, 0.25, 1.9, 0.08)
      b.box('cumaru', x, 0.05, 16.5, 0.8, 0.1, 2.0)
    })
  }
  // galería: mesa exterior y sillones
  table(b, -9, deckY, 10.2, 3.0, 1.0, 0.75, 'oak')
  for (let i = 0; i < 3; i++) {
    chair(b, -10 + i, deckY, 9.5, 0)
    chair(b, -10 + i, deckY, 10.9, Math.PI)
  }
  sofa(b, 10, deckY, 10.4, 2.6, 0.95, Math.PI, 'linen')
  armchair(b, 7.8, deckY, 10.6, Math.PI * 0.7, 'linen')
  table(b, 10, deckY, 11.4, 1.2, 0.6, 0.32, 'travertine')
  // canteros
  for (const [x, z] of [
    [-15.5, 12.5],
    [15.5, 12.5],
  ]) {
    b.piece('planter', [x, 0, z], 0, { w: 0.9, d: 0.9, h: 0.6 }, () => {
      b.box('concrete', x, 0.3, z, 0.9, 0.6, 0.9)
      b.sphere('foliage', x, 0.9, z, 0.6, 1, 0.8, 1, 1)
    })
  }
}


function tree(b: Builder, x: number, y: number, z: number, s: number) {
  b.cyl('trunk', x, y + 1.6 * s, z, 0.07 * s, 0.14 * s, 3.2 * s, 8)
  b.cyl('trunk', x + 0.5 * s, y + 2.6 * s, z, 0.04 * s, 0.06 * s, 1.6 * s, 6)
  // copa de olivo: racimos irregulares de follaje
  for (let k = 0; k < 9; k++) {
    const a = k * 2.399 + x
    const r = (0.4 + ((k * 37) % 10) / 14) * s
    const m = k % 3 === 0 ? 'foliageLight' : 'foliage'
    b.sphere(m, x + Math.cos(a) * r * 1.1, y + (3.0 + (k % 4) * 0.28) * s, z + Math.sin(a) * r, (0.75 + (k % 3) * 0.18) * s, 1.25, 0.62, 1.15, 2)
  }
}

/** Árboles escultóricos y jardín lateral */
function trees(b: Builder) {
  const spots: [number, number, number][] = [
    [-20, -14, 1.3],
    [-24, -2, 1.6],
    [-19, 8, 1.2],
    [20, -15, 1.4],
    [23, -3, 1.7],
    [19.5, 7, 1.1],
    [-8, -20, 1.0],
    [10.5, -20.5, 1.1],
    [-30, 12, 1.8],
    [30, 13, 1.6],
    [-36, -18, 2],
    [36, -22, 2.1],
  ]
  for (const [x, z, s] of spots) {
    const y = -0.6
    b.cyl('glow', x + 0.6, y + 0.04, z + 0.6, 0.12, 0.12, 0.06, 12) // proyector al pie del árbol
    b.piece('tree', [x, y, z], 0, { scale: s }, () => tree(b, x, y, z, s))
  }
  // setos bajos que integran la casa al jardín
  for (const x of [-16.5, 16.5]) b.piece('hedge', [x, -0.6, 0], 0, { w: 2, d: 18, h: 0.8 }, () => b.rounded('foliage', x, -0.2, 0, 2, 0.8, 18, 0.35))
}

export function buildHouse() {
  return populate(new Builder()).merge()
}

/** Construye la casa registrando piezas y etiquetas: lo usa scripts/blender/export-geometry.ts */
export function buildHouseTagged() {
  const b = new Builder()
  b.recordTags = true
  return populate(b)
}

function populate(b: Builder) {
  structure(b)
  groundFloor(b)
  upperFloor(b)
  furnishGround(b)
  furnishUpper(b)
  exterior(b)
  trees(b)
  return b
}
