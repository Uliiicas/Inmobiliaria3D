/**
 * Guion de cámara del recorrido cinematográfico.
 * Cada fotograma clave es una posición de cámara (p) y un punto de mira (t).
 * El scroll recorre una curva Catmull-Rom que pasa por todos ellos.
 */
export interface Shot {
  p: [number, number, number]
  t: [number, number, number]
  fov?: number
}

const E1 = 1.65
const E2 = 3.71 + 1.62

export const SHOTS: Shot[] = [
  // 0-3 · fachada y acceso
  { p: [17, 7.5, -42], t: [1.5, 3.2, -6], fov: 38 },
  { p: [9, 3.4, -29], t: [2, 2.8, -8], fov: 42 },
  { p: [2.4, 1.75, -19], t: [2, 1.9, -8], fov: 48 },
  { p: [2, E1, -11.6], t: [2, 1.7, -4], fov: 52 },
  // 4-5 · hall
  { p: [2, E1, -6.8], t: [2.6, 2.0, 0], fov: 56 },
  { p: [4.4, E1, -4.6], t: [-1.0, 2.3, -4.8], fov: 56 },
  // 6-7 · living
  { p: [3.8, E1, -1.2], t: [3.2, 2.9, 8], fov: 58 },
  { p: [1.6, 1.9, 0.6], t: [3.4, 4.8, 6.5], fov: 62 },
  // 8 · comedor · 9 · cocina
  { p: [6.4, E1, 2.6], t: [11.5, 1.1, 5], fov: 56 },
  { p: [8.8, E1, 1.0], t: [11.6, 0.9, -3.2], fov: 56 },
  // 10-11 · ventanales
  { p: [6.6, 1.6, 5.4], t: [5, 1.3, 30], fov: 55 },
  { p: [4.5, 1.6, 7.4], t: [4.5, 1.1, 20], fov: 55 },
  // 12-15 · exteriores
  { p: [4.5, E1, 10.4], t: [0, 0.3, 16], fov: 56 },
  { p: [-3, 1.25, 12.9], t: [-11, -0.3, 18.6], fov: 54 },
  { p: [-13.2, 2.1, 18.8], t: [0, 3.0, 6], fov: 50 },
  { p: [2, 3.1, 21.2], t: [2.5, 3.2, 7], fov: 52 },
  // 16-20 · regreso al interior y escalera
  { p: [4.5, E1, 10.4], t: [4.5, 1.7, 0], fov: 56 },
  { p: [4.2, E1, 6.4], t: [0, 1.8, -1.5], fov: 56 },
  { p: [-0.9, E1, -0.7], t: [-1.1, 2.9, -6], fov: 58 },
  { p: [-1.1, 2.6, -3.4], t: [-1.1, 4.4, -7.6], fov: 58 },
  { p: [-1.1, 4.35, -5.7], t: [-1.0, 5.4, -8], fov: 58 },
  // 21-22 · sala privada
  { p: [-0.7, E2, -7.35], t: [4, 5.1, -5.6], fov: 58 },
  { p: [3.4, E2, -4.4], t: [7.6, 4.9, -4.8], fov: 58 },
  // 23 · puente
  { p: [3.0, E2, -1.0], t: [3, 4.0, 9], fov: 60 },
  // 24-30 · suite principal
  { p: [-1.4, E2, -1.0], t: [-3.2, E2, 1.4], fov: 58 },
  { p: [-2.85, E2, 0.6], t: [-3.4, 5.0, 6], fov: 58 },
  { p: [-3.1, E2, 3.9], t: [-6.3, 4.3, 3.4], fov: 58 },
  { p: [-4.6, E2, 6.6], t: [-12, 4.6, 7.4], fov: 58 },
  { p: [-11.3, E2, 5.7], t: [-12.2, 4.1, 9.6], fov: 58 },
  { p: [-8.0, E2, 6.0], t: [-2, 5.2, 4], fov: 58 },
  { p: [-2.95, E2, 1.4], t: [-2.6, E2, -1], fov: 58 },
  // 31-34 · dormitorios
  { p: [-1.0, E2, -1.0], t: [8, 5.2, -1], fov: 58 },
  { p: [8.7, E2, -0.5], t: [8.7, E2, 4], fov: 58 },
  { p: [9.4, E2, 4.6], t: [11.6, 4.8, 9.6], fov: 58 },
  { p: [11, E2, 8.5], t: [11, 5.0, 20], fov: 56 },
  // 35-36 · balcón panorámico
  { p: [9.4, 5.4, 11.0], t: [0, 3.2, 30], fov: 54 },
  { p: [6.5, 6.4, 11.5], t: [-5, 1.6, 42], fov: 52 },
]

export interface Chapter {
  from: number
  to: number
  kicker: string
  title: string
  text: string
  room?: string
}

/** Capítulos: índices de fotogramas clave en los que el texto acompaña al recorrido */
export const CHAPTERS: Chapter[] = [
  { from: 1.2, to: 3.2, kicker: '01 · Acceso', title: 'Llegar sobre el agua', text: 'Un muelle de piedra suspendido sobre un espejo de agua anticipa la calma del interior.', room: 'acceso' },
  { from: 3.6, to: 5.6, kicker: '02 · Hall', title: 'Umbral de piedra', text: 'Caliza apomazada, hormigón de tabla y una escalera que parece flotar.', room: 'hall' },
  { from: 5.8, to: 7.7, kicker: '03 · Living', title: 'Siete metros de luz', text: 'La doble altura convierte el horizonte en un muro vivo de diez metros.', room: 'living' },
  { from: 7.8, to: 8.7, kicker: '04 · Comedor', title: 'La mesa frente al mar', text: 'Nogal macizo de 3,6 m bajo una lámpara lineal de bronce.', room: 'comedor' },
  { from: 8.7, to: 9.7, kicker: '05 · Cocina', title: 'Mármol y precisión', text: 'Isla monolítica de Calacatta y frentes de roble sin tiradores.', room: 'cocina' },
  { from: 9.8, to: 11.6, kicker: '06 · Ventanales', title: 'El océano entra en casa', text: 'Vidrio low-e de piso a techo con perfilería mínima de 50 mm.', room: 'living' },
  { from: 11.7, to: 13.4, kicker: '07 · Galería', title: 'Interior y exterior, un solo plano', text: 'El mismo solado continúa bajo un voladizo de cuatro metros.', room: 'galeria' },
  { from: 13.4, to: 15.6, kicker: '08 · Piscina infinita', title: 'Un horizonte líquido', text: '22 metros de agua que se derraman hasta confundirse con el océano.', room: 'piscina' },
  { from: 16.4, to: 20.4, kicker: '09 · Escalera', title: 'Ascender en silencio', text: 'Diecisiete peldaños de roble macizo anclados al hormigón, sin zancas.', room: 'hall' },
  { from: 20.6, to: 22.6, kicker: '10 · Sala privada', title: 'Biblioteca bajo la luz', text: 'Un estar familiar con 1.200 volúmenes y un lucernario lineal.', room: 'sala-privada' },
  { from: 22.6, to: 23.8, kicker: '11 · Puente', title: 'Suspendidos sobre el living', text: 'La pasarela de roble y vidrio regala la vista más amplia de la casa.', room: 'puente' },
  { from: 24.2, to: 27.4, kicker: '12 · Suite principal', title: 'Despertar frente al mar', text: 'Cama flotante, lino lavado y un respaldo continuo de nogal.', room: 'dormitorio-principal' },
  { from: 27.4, to: 29.2, kicker: '13 · Baño principal', title: 'Bañarse mirando el horizonte', text: 'Bañera exenta de piedra frente a un paño fijo de cuatro metros.', room: 'banio-principal' },
  { from: 31.2, to: 34.2, kicker: '14 · Dormitorios', title: 'Luz de esquina', text: 'Dos frentes vidriados y acceso directo al balcón.', room: 'dormitorio-secundario' },
  { from: 34.6, to: 36.2, kicker: '15 · Balcón panorámico', title: 'Donde termina la casa, empieza el horizonte', text: 'Veintiocho metros de balcón suspendidos sobre la piscina.', room: 'balcon' },
]

/** Progreso de scroll (0..1) correspondiente a un fotograma */
export const shotToProgress = (i: number) => i / (SHOTS.length - 1)
