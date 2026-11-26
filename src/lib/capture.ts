/**
 * Modo captura (`?capture`): sólo la escena 3D, sin interfaz ni amortiguaciones.
 * Lo usa scripts/video/capture.mjs para renderizar el recorrido cuadro a cuadro como
 * "video guía" (misma ruta de cámara que la página principal) que luego se pasa por Seedance.
 */
export const CAPTURE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('capture')
