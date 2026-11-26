/**
 * Luminarias de la residencia. Las usan la escena en tiempo real (Atmosphere) y el horneado
 * de luz en Blender (scripts/blender), que las convierte en luces de área cálidas.
 */
/** Luces artificiales: [x, y, z, color, intensidad, alcance]. Ordenadas por prioridad */
export const LAMPS: [number, number, number, string, number, number][] = [
  [3, 5.0, 3.6, '#ffc98f', 9, 14], // living (anillo)
  [2, 3.0, 10.2, '#ffcf9c', 5, 12], // galería
  [0, -0.6, 15.7, '#6fd6e6', 6, 14], // piscina
  [11, 2.2, -2.6, '#ffd2a1', 5, 9], // cocina
  [11, 2.2, 5, '#ffc68a', 5, 9], // comedor
  [3, 3.0, -5, '#ffd3a3', 4, 9], // hall
  [-6, 6.3, 5, '#ffc48a', 4, 9], // dormitorio principal
  [3.6, 6.4, -5, '#ffcb94', 4, 9], // sala privada
  [-5, 2.9, 4.5, '#ffc48a', 3.5, 8], // sala de estar
  [11, 6.4, 6, '#ffc48a', 3.5, 8], // dormitorio secundario
  [13.5, 0.9, 16.4, '#ff8a3c', 4, 7], // fogón
  [2, 3.0, -9.6, '#ffd2a0', 5, 10], // acceso
]
