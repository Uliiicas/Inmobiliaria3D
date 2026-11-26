/**
 * Fuente única de verdad de la residencia.
 * Todas las medidas están en metros. Ejes de la escena:
 *  - X: oeste (-) → este (+)
 *  - Z: calle / acceso (-) → océano (+)
 *  - Y: altura. Planta baja a 0 m, planta alta a FLOOR_2 m.
 * El plano interactivo, el minimapa, el modo 360° y la geometría 3D leen estos datos.
 */

export const FLOOR_1 = 0
export const FLOOR_2 = 3.7
export const CEILING_1 = 3.4
export const ROOF = 7.1
export const EYE = 1.62

export type FloorId = 0 | 1

export interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}

export interface Hotspot {
  /** Posición en el mundo */
  p: [number, number, number]
  title: string
  body: string
  kind: 'material' | 'detail'
}

export interface Room {
  id: string
  name: string
  floor: FloorId
  /** Rectángulos que componen el ambiente en el plano (la mayoría es uno solo) */
  rects: Rect[]
  /** Texto breve que aparece al llegar al ambiente */
  description: string
  /** Identidad del ambiente: frase corta */
  mood: string
  /** Punto de vista para el modo 360° (altura de ojos incluida) */
  view: [number, number, number]
  /** Orientación inicial (yaw, radianes). 0 mira hacia el océano (+Z) */
  yaw: number
  /** Ambientes vecinos con la posición del indicador de paso */
  links: { to: string; p: [number, number, number] }[]
  hotspots?: Hotspot[]
  exterior?: boolean
  ceiling?: number
}

const y1 = FLOOR_1 + EYE
const y2 = FLOOR_2 + EYE

export const ROOMS: Room[] = [
  // ───────────────────────── PLANTA BAJA ─────────────────────────
  {
    id: 'acceso',
    name: 'Acceso principal',
    floor: 0,
    exterior: true,
    rects: [{ x0: -3, x1: 7, z0: -16, z1: -8 }],
    description:
      'Un muelle de piedra flota sobre un espejo de agua y conduce a la puerta pivotante de roble de 3,2 m.',
    mood: 'Umbral',
    view: [2, y1, -14],
    yaw: 0,
    links: [{ to: 'hall', p: [2, 1.4, -8.6] }],
    hotspots: [
      {
        p: [2, 1.6, -8.15],
        title: 'Puerta pivotante',
        body: 'Roble macizo aceitado, 2,0 × 3,2 m. Eje pivotante oculto y cerradura biométrica.',
        kind: 'material',
      },
      {
        p: [-1.5, 0.05, -12],
        title: 'Espejo de agua',
        body: 'Lámina de 4 cm sobre piedra basáltica. Refleja la fachada y enfría el acceso.',
        kind: 'detail',
      },
    ],
  },
  {
    id: 'hall',
    name: 'Hall de entrada',
    floor: 0,
    rects: [{ x0: -2, x1: 8, z0: -8, z1: -2 }],
    description:
      'Un vestíbulo de piedra caliza donde la escalera escultórica se suspende del muro de hormigón visto.',
    mood: 'Silencio y escala',
    view: [3.5, y1, -5.5],
    yaw: Math.PI * 0.12,
    links: [
      { to: 'acceso', p: [2, 1.4, -7.6] },
      { to: 'living', p: [3, 1.4, -2.2] },
      { to: 'cocina', p: [7.8, 1.4, -4] },
      { to: 'sala-privada', p: [-1.1, 2.6, -3.2] },
    ],
    hotspots: [
      {
        p: [-1.1, 1.8, -5],
        title: 'Escalera en voladizo',
        body: '17 peldaños de roble macizo de 9 cm anclados al muro. Sin zancas visibles; baranda de vidrio extra-claro.',
        kind: 'material',
      },
      {
        p: [3, 0.02, -5],
        title: 'Piedra caliza',
        body: 'Caliza beige en formato 120 × 60 cm, acabado apomazado, con calefacción radiante.',
        kind: 'material',
      },
    ],
  },
  {
    id: 'living',
    name: 'Living de doble altura',
    floor: 0,
    ceiling: 7.1,
    rects: [{ x0: -2, x1: 8, z0: -2, z1: 8 }],
    description:
      'Siete metros de altura libre y un frente vidriado de diez metros que convierte el horizonte en el protagonista.',
    mood: 'El horizonte como muro',
    view: [3, y1, 1],
    yaw: 0,
    links: [
      { to: 'hall', p: [3, 1.4, -1.8] },
      { to: 'comedor', p: [7.6, 1.4, 4.5] },
      { to: 'cocina', p: [7.6, 1.4, 0] },
      { to: 'sala-estar', p: [-1.8, 1.4, 4.5] },
      { to: 'galeria', p: [4.5, 1.4, 7.6] },
    ],
    hotspots: [
      {
        p: [3, 3.5, 7.9],
        title: 'Muro cortina',
        body: 'Vidrio laminado low-e de 10 × 7 m con perfilería mínima de 50 mm. Control solar del 62 %.',
        kind: 'material',
      },
      {
        p: [-1.95, 2.2, 1.2],
        title: 'Hormigón visto',
        body: 'Encofrado de tabla de pino; cada junta queda marcada como textura arquitectónica.',
        kind: 'material',
      },
      {
        p: [2.8, 0.9, 3.4],
        title: 'Hogar suspendido',
        body: 'Chimenea a bioetanol en acero ennegrecido, frente a la vista al mar.',
        kind: 'detail',
      },
    ],
  },
  {
    id: 'comedor',
    name: 'Comedor',
    floor: 0,
    rects: [{ x0: 8, x1: 14, z0: 2, z1: 8 }],
    description: 'Una mesa de nogal de 3,6 m para diez comensales bajo una lámpara lineal de bronce.',
    mood: 'Sobremesa frente al mar',
    view: [10, y1, 3],
    yaw: Math.PI * 0.08,
    links: [
      { to: 'living', p: [8.4, 1.4, 4.5] },
      { to: 'cocina', p: [11, 1.4, 2.2] },
      { to: 'galeria', p: [11, 1.4, 7.6] },
    ],
    hotspots: [
      {
        p: [11, 0.78, 5],
        title: 'Nogal americano',
        body: 'Tablero macizo de 3,6 m con canto vivo y aceite natural mate.',
        kind: 'material',
      },
    ],
  },
  {
    id: 'cocina',
    name: 'Cocina de diseño',
    floor: 0,
    rects: [{ x0: 8, x1: 14, z0: -8, z1: 2 }],
    description: 'Isla monolítica de mármol Calacatta de 4,2 m y frentes de roble sin tiradores.',
    mood: 'Precisión',
    view: [9.2, y1, 0.8],
    yaw: Math.PI * 0.9,
    links: [
      { to: 'comedor', p: [11, 1.4, 1.8] },
      { to: 'hall', p: [8.2, 1.4, -4] },
      { to: 'living', p: [8.2, 1.4, 0] },
    ],
    hotspots: [
      {
        p: [11, 0.95, -3],
        title: 'Mármol Calacatta',
        body: 'Isla en bloque de 4,2 × 1,3 m con vetas a libro abierto y canto de 12 cm.',
        kind: 'material',
      },
      {
        p: [13.6, 1.2, -5],
        title: 'Frentes de roble',
        body: 'Roble europeo rift con apertura push-to-open. Electrodomésticos integrados.',
        kind: 'material',
      },
    ],
  },
  {
    id: 'sala-estar',
    name: 'Sala de estar',
    floor: 0,
    rects: [
      { x0: -8, x1: -2, z0: 1, z1: 8 },
      { x0: -10, x1: -2, z0: -5, z1: 1 },
    ],
    description: 'Un refugio más íntimo de lana, lino y piedra para la lectura y las tardes largas.',
    mood: 'Recogimiento',
    view: [-4.5, y1, 2.5],
    yaw: Math.PI * 0.05,
    links: [
      { to: 'living', p: [-2.2, 1.4, 4.5] },
      { to: 'huespedes', p: [-9, 1.4, 0.6] },
      { to: 'banio-visitas', p: [-3.5, 1.4, -4.6] },
    ],
    hotspots: [
      {
        p: [-7.95, 1.6, 4.5],
        title: 'Muro de travertino',
        body: 'Travertino romano en piezas de 3 cm con juntas de 1 mm, sin rellenar.',
        kind: 'material',
      },
    ],
  },
  {
    id: 'banio-visitas',
    name: 'Baño de visitas',
    floor: 0,
    rects: [{ x0: -5, x1: -2, z0: -8, z1: -5 }],
    description: 'Una caja de piedra oscura con un lavabo tallado en un único bloque y luz rasante.',
    mood: 'Penumbra',
    view: [-3.5, y1, -5.6],
    yaw: Math.PI,
    links: [{ to: 'sala-estar', p: [-3.5, 1.4, -4.6] }],
    hotspots: [
      {
        p: [-3.5, 0.9, -7.7],
        title: 'Lavabo monolítico',
        body: 'Basalto negro tallado a partir de un único bloque de 380 kg.',
        kind: 'material',
      },
    ],
  },
  {
    id: 'lavadero',
    name: 'Lavadero',
    floor: 0,
    rects: [{ x0: -14, x1: -10, z0: -8, z1: -3 }],
    description: 'Lavadero y planchado con luz cenital, muebles en roble y mesada de Dekton.',
    mood: 'Orden',
    view: [-12, y1, -4],
    yaw: Math.PI,
    links: [{ to: 'sala-estar', p: [-9.9, 1.4, -4] }],
  },
  {
    id: 'huespedes',
    name: 'Habitación de huéspedes',
    floor: 0,
    rects: [{ x0: -14, x1: -8, z0: 1, z1: 8 }],
    description: 'Suite en planta baja con salida directa al jardín y vista a la piscina.',
    mood: 'Hospitalidad',
    view: [-10.5, y1, 2],
    yaw: Math.PI * 0.1,
    links: [
      { to: 'sala-estar', p: [-9, 1.4, 1.4] },
      { to: 'banio-huespedes', p: [-12, 1.4, 1.4] },
    ],
  },
  {
    id: 'banio-huespedes',
    name: 'Baño privado',
    floor: 0,
    rects: [{ x0: -14, x1: -10, z0: -3, z1: 1 }],
    description: 'Ducha de lluvia de piso a techo revestida en microcemento color arena.',
    mood: 'Agua',
    view: [-12, y1, 0.3],
    yaw: Math.PI,
    links: [{ to: 'huespedes', p: [-12, 1.4, 1.2] }],
  },
  {
    id: 'galeria',
    name: 'Galería exterior',
    floor: 0,
    exterior: true,
    rects: [{ x0: -14, x1: 14, z0: 8, z1: 12 }],
    description: 'Una galería de 28 m protegida por el voladizo de la planta alta: interior y exterior se funden.',
    mood: 'Umbral al mar',
    view: [4.5, y1, 10],
    yaw: Math.PI * 0.05,
    links: [
      { to: 'living', p: [4.5, 1.4, 8.4] },
      { to: 'piscina', p: [0, 1.0, 12.6] },
      { to: 'terraza', p: [12, 1.0, 12.6] },
    ],
    hotspots: [
      {
        p: [4, 3.35, 10],
        title: 'Voladizo de 4 m',
        body: 'Losa postensada que se proyecta 4 m sin columnas intermedias; cielorraso en listones de cumarú.',
        kind: 'detail',
      },
    ],
  },
  {
    id: 'piscina',
    name: 'Piscina infinita',
    floor: 0,
    exterior: true,
    rects: [{ x0: -11, x1: 11, z0: 13.5, z1: 18 }],
    description: 'Veintidós metros de agua que se derraman sobre el borde y se confunden con el océano.',
    mood: 'Horizonte líquido',
    view: [-9.5, y1, 12.8],
    yaw: Math.PI * 0.42,
    links: [
      { to: 'galeria', p: [-4, 1.0, 12.2] },
      { to: 'terraza', p: [12, 1.0, 15] },
    ],
    hotspots: [
      {
        p: [0, 0.1, 18],
        title: 'Borde infinito',
        body: '22 × 4,5 m, profundidad 1,4 m. Borde desbordante de 22 m con canal de recuperación oculto.',
        kind: 'detail',
      },
      {
        p: [-6, 0.02, 13.4],
        title: 'Piedra de Bali',
        body: 'Revestimiento de piedra verde Sukabumi: tiñe el agua de un turquesa natural.',
        kind: 'material',
      },
    ],
  },
  {
    id: 'terraza',
    name: 'Terraza con vista al mar',
    floor: 0,
    exterior: true,
    rects: [{ x0: 11, x1: 16, z0: 12, z1: 20 }],
    description: 'Deck de cumarú con fogón y camastros, suspendido sobre el acantilado.',
    mood: 'Brisa',
    view: [13, y1, 14],
    yaw: -Math.PI * 0.12,
    links: [
      { to: 'piscina', p: [10.6, 1.0, 15.5] },
      { to: 'galeria', p: [12, 1.0, 11.8] },
    ],
    hotspots: [
      {
        p: [13.5, 0.3, 18],
        title: 'Deck de cumarú',
        body: 'Madera dura tropical con fijación oculta. Clase 1 de durabilidad, sin tratamiento químico.',
        kind: 'material',
      },
    ],
  },

  // ───────────────────────── PLANTA ALTA ─────────────────────────
  {
    id: 'sala-privada',
    name: 'Sala de estar privada',
    floor: 1,
    rects: [{ x0: -0.2, x1: 8, z0: -8, z1: -2 }],
    description: 'Biblioteca y estar familiar abiertos a la escalera, con un lucernario lineal sobre los libros.',
    mood: 'Pausa',
    view: [3.8, y2, -4],
    yaw: Math.PI * 0.6,
    links: [
      { to: 'hall', p: [-1.1, FLOOR_2 + 0.6, -6] },
      { to: 'puente', p: [3.5, FLOOR_2 + 1.4, -2.2] },
    ],
    hotspots: [
      {
        p: [7.9, 2.0 + FLOOR_2, -5],
        title: 'Biblioteca a medida',
        body: 'Estantería de roble ahumado de 6 m y 1.200 volúmenes, con iluminación integrada.',
        kind: 'material',
      },
    ],
  },
  {
    id: 'puente',
    name: 'Puente sobre el living',
    floor: 1,
    rects: [{ x0: -2, x1: 8, z0: -2, z1: 0 }],
    description: 'Una pasarela de vidrio y roble suspendida sobre el living: la mejor vista de la casa.',
    mood: 'Vértigo sereno',
    view: [3, y2, -1],
    yaw: 0,
    links: [
      { to: 'sala-privada', p: [3.5, FLOOR_2 + 1.4, -2.4] },
      { to: 'dormitorio-principal', p: [-2.85, FLOOR_2 + 1.4, 1.7] },
      { to: 'dormitorio-secundario', p: [8.4, FLOOR_2 + 1.4, -1] },
    ],
  },
  {
    id: 'dormitorio-principal',
    name: 'Dormitorio principal',
    floor: 1,
    rects: [
      { x0: -10, x1: -2, z0: 2, z1: 9.5 },
      { x0: -8, x1: -2, z0: -8, z1: 2 },
    ],
    description: 'Una suite que despierta mirando el océano: cama flotante, lino lavado y muro de nogal.',
    mood: 'Amanecer privado',
    view: [-6, y2, 3.2],
    yaw: 0,
    links: [
      { to: 'vestidor', p: [-9, FLOOR_2 + 1.4, 2.4] },
      { to: 'puente', p: [-2.85, FLOOR_2 + 1.4, 2.3] },
      { to: 'balcon', p: [-6, FLOOR_2 + 1.4, 9.2] },
      { to: 'banio-principal', p: [-9.7, FLOOR_2 + 1.4, 6] },
    ],
    hotspots: [
      {
        p: [-6, 1.0 + FLOOR_2, 3.0],
        title: 'Respaldo de nogal',
        body: 'Muro-respaldo de nogal con iluminación indirecta y mesas de luz suspendidas.',
        kind: 'material',
      },
    ],
  },
  {
    id: 'vestidor',
    name: 'Vestidor',
    floor: 1,
    rects: [{ x0: -14, x1: -8, z0: -8, z1: 2 }],
    description: 'Un vestidor tipo galería con vitrinas iluminadas e isla central de cuero y vidrio.',
    mood: 'Ritual',
    view: [-11, y2, 0.8],
    yaw: Math.PI,
    links: [
      { to: 'dormitorio-principal', p: [-9, FLOOR_2 + 1.4, 1.6] },
      { to: 'banio-principal', p: [-12, FLOOR_2 + 1.4, 1.6] },
    ],
  },
  {
    id: 'banio-principal',
    name: 'Baño principal',
    floor: 1,
    rects: [{ x0: -14, x1: -10, z0: 2, z1: 9.5 }],
    description: 'Bañera exenta de piedra frente a un ventanal panorámico: bañarse mirando el horizonte.',
    mood: 'Spa',
    view: [-12, y2, 3],
    yaw: 0,
    links: [
      { to: 'vestidor', p: [-12, FLOOR_2 + 1.4, 2.4] },
      { to: 'dormitorio-principal', p: [-10.3, FLOOR_2 + 1.4, 6] },
    ],
    hotspots: [
      {
        p: [-12, 0.55 + FLOOR_2, 8.2],
        title: 'Bañera panorámica',
        body: 'Bañera exenta tallada en piedra de 1,9 m frente a un paño fijo de vidrio de 4 m.',
        kind: 'material',
      },
    ],
  },
  {
    id: 'dormitorio-secundario',
    name: 'Dormitorio secundario',
    floor: 1,
    rects: [{ x0: 8, x1: 14, z0: 2.5, z1: 9.5 }],
    description: 'Dormitorio en esquina con dos frentes vidriados y acceso al balcón.',
    mood: 'Luz de esquina',
    view: [10.5, y2, 3.5],
    yaw: Math.PI * 0.08,
    links: [
      { to: 'puente', p: [8.7, FLOOR_2 + 1.4, 2.2] },
      { to: 'balcon', p: [11, FLOOR_2 + 1.4, 9.2] },
      { to: 'dormitorio-terciario', p: [11.5, FLOOR_2 + 1.4, 2.2] },
    ],
  },
  {
    id: 'dormitorio-terciario',
    name: 'Dormitorio terciario',
    floor: 1,
    rects: [
      { x0: 9.4, x1: 14, z0: -4, z1: 2.5 },
      { x0: 8, x1: 9.4, z0: -4, z1: 2.5 },
    ],
    description: 'Orientado al este para recibir la primera luz; escritorio de roble frente al jardín.',
    mood: 'Primera luz',
    view: [11, y2, 1.6],
    yaw: -Math.PI * 0.6,
    links: [
      { to: 'dormitorio-secundario', p: [11.5, FLOOR_2 + 1.4, 2.8] },
      { to: 'banio-compartido', p: [10.5, FLOOR_2 + 1.4, -3.8] },
    ],
  },
  {
    id: 'banio-compartido',
    name: 'Baño compartido',
    floor: 1,
    rects: [{ x0: 8, x1: 14, z0: -8, z1: -4 }],
    description: 'Doble vanitory de piedra arena y ducha pasante bajo un lucernario.',
    mood: 'Claridad',
    view: [11, y2, -4.6],
    yaw: Math.PI,
    links: [{ to: 'dormitorio-terciario', p: [10.5, FLOOR_2 + 1.4, -3.6] }],
  },
  {
    id: 'balcon',
    name: 'Balcón panorámico',
    floor: 1,
    exterior: true,
    rects: [{ x0: -14, x1: 14, z0: 9.5, z1: 12 }],
    description: 'Veintiocho metros de balcón sobre la piscina: el final del recorrido y el comienzo del horizonte.',
    mood: 'Infinito',
    view: [2, y2, 10.6],
    yaw: 0,
    links: [
      { to: 'dormitorio-principal', p: [-6, FLOOR_2 + 1.4, 9.8] },
      { to: 'dormitorio-secundario', p: [11, FLOOR_2 + 1.4, 9.8] },
    ],
    hotspots: [
      {
        p: [2, 1.05 + FLOOR_2, 11.95],
        title: 'Baranda de vidrio',
        body: 'Vidrio laminado templado de 21,5 mm empotrado en la losa: nada interrumpe la vista.',
        kind: 'material',
      },
    ],
  },
]

export const ROOM_BY_ID: Record<string, Room> = Object.fromEntries(ROOMS.map((r) => [r.id, r]))

export function roomArea(r: Room) {
  return r.rects.reduce((a, q) => a + (q.x1 - q.x0) * (q.z1 - q.z0), 0)
}

export function roomDims(r: Room) {
  const q = r.rects[0]
  return { w: q.x1 - q.x0, d: q.z1 - q.z0 }
}

/** Encuentra el ambiente en el que se encuentra un punto del mundo */
export function roomAt(x: number, y: number, z: number): Room | undefined {
  const floor: FloorId = y > FLOOR_2 - 0.4 ? 1 : 0
  // los ambientes interiores tienen prioridad sobre los exteriores
  const candidates = ROOMS.filter((r) => r.floor === floor).sort(
    (a, b) => Number(!!a.exterior) - Number(!!b.exterior),
  )
  for (const r of candidates) {
    for (const q of r.rects) if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1) return r
  }
  if (floor === 1 && z > 12) return ROOM_BY_ID['balcon']
  return undefined
}

export const PROPERTY = {
  name: 'Casa Horizonte',
  location: 'Costa Atlántica',
  headline: 'WHERE ARCHITECTURE MEETS THE OCEAN',
  subtitle: 'Una residencia diseñada para vivir entre la arquitectura, la naturaleza y el horizonte.',
  stats: [
    { v: '650', u: 'm²', l: 'construidos' },
    { v: '2', u: '', l: 'plantas' },
    { v: '5', u: '', l: 'habitaciones' },
    { v: '4', u: '', l: 'baños' },
    { v: '22', u: 'm', l: 'piscina infinita' },
    { v: '180', u: '°', l: 'vista al océano' },
  ],
}
