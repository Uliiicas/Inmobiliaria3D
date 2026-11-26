# Casa Horizonte — experiencia inmersiva 3D

Sitio para una residencia contemporánea de lujo frente al mar. No es un catálogo: es una vivienda
modelada en 3D que se recorre con el scroll, se explora libremente en 360° y cambia de luz según la hora del día.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de producción en dist/
```

Parámetros útiles en la URL: `?quality=high|medium|low`, `?hour=19.2`, `?room=cocina` (entra directo al modo 360°).

## Los tres pilares

| Pilar | Qué hace | Dónde está |
| --- | --- | --- |
| Recorrido cinematográfico | 37 tomas de cámara sobre dos curvas Catmull-Rom (posición y mirada) unidas al scroll con GSAP ScrollTrigger. Amortiguación exponencial, FOV por toma, puerta pivotante que se abre al llegar, profundidad de campo con foco dinámico. | `src/data/tour.ts`, `src/scene/TourRig.tsx` |
| Exploración 360° | Cámara a la altura de los ojos dentro de cada ambiente: arrastrar para mirar (incluye techo y suelo), rueda o pinza para acercar, flechas del teclado, indicadores para pasar de ambiente, plano interactivo de las dos plantas, fichas con superficie y medidas, puntos de información de materiales y cotas en 3D. | `src/scene/ExploreRig.tsx`, `src/scene/Markers.tsx`, `src/ui/ExploreOverlay.tsx` |
| Hora del día (06:00–21:00) | Posición solar real (el sol se pone sobre el mar), intensidad y temperatura de color, cielo físico Preetham, sombras dinámicas, mapa de entorno regenerado (reflejos en vidrio, agua y mármol), exposición, niebla, estrellas, y luces arquitectónicas, de piscina y jardín que se encienden al anochecer. Transiciones continuas. | `src/lib/daylight.ts`, `src/scene/Atmosphere.tsx` |

## Arquitectura

```
src/
  data/rooms.ts        Fuente única de la casa: 21 ambientes, rectángulos del plano, puntos de vista 360°, vínculos, hotspots
  data/tour.ts         Guion de cámara y capítulos del recorrido
  scene/house.ts       Construcción procedural: estructura, fachadas, escalera en voladizo, mobiliario y paisaje
  scene/builder.ts     Primitivas con UV en metros reales; todo se fusiona por material (pocas draw calls)
  scene/textures.ts    Texturas PBR procedurales tileables (color, rugosidad, normales): hormigón de tabla, roble, nogal, travertino, mármol…
  scene/materials.ts   Materiales físicos + reemplazo opcional por texturas fotográficas
  scene/World.tsx      Carga por etapas, puerta, piscina, océano y gramíneas instanciadas
  scene/Effects.tsx    AO, bloom, profundidad de campo, tone mapping y viñeta (según calidad)
  ui/                  Portada, capítulos, control horario, plano, minimapa, contacto, versión sin WebGL
  lib/quality.ts       Perfiles de calidad y detección del dispositivo
  lib/higgsfield.ts    Lectura (opcional) del manifiesto de recursos generados
scripts/higgsfield/    Generador server-side con la API oficial de Higgsfield
```

El plano, el minimapa, el modo 360° y la geometría leen los mismos datos, así que un cambio de distribución se refleja en todo.

## Rendimiento

- Geometría fusionada por material (~35 draw calls para toda la casa) y texturas generadas en el cliente: no hay descargas de modelos.
- Carga por etapas con progreso real; la escena 3D y la postproducción se cargan en chunks diferidos.
- Tres perfiles (`Cinemática`, `Equilibrada`, `Ligera`) que cambian resolución, sombras, luces, postproducción y vegetación.
  Se elige por dispositivo y `PerformanceMonitor` baja un escalón si los FPS caen. El usuario puede fijarlo desde el menú.
- Sin WebGL: versión editorial con plano interactivo y renders (si existen).
- `prefers-reduced-motion`: sin respiración de cámara, sin DoF, transiciones instantáneas con fundido.

## Higgsfield AI (opcional)

Investigación: Higgsfield publica una API REST oficial (`https://api.higgsfield.ai`, documentación en
[docs.higgsfield.ai](https://docs.higgsfield.ai)). Se autentica con `Authorization: Key <id>:<secret>`, las solicitudes son
asíncronas (cola → `status_url` → resultado) y las URLs de resultado caducan a los 7 días. La documentación pide usarla
sólo desde el servidor. El conector de Higgsfield disponible en este entorno sólo permite consultar el catálogo y el historial;
no genera.

Por eso la integración es **server-side y opcional**:

1. Cree una clave en la consola de Higgsfield y copie `.env.example` a `.env` con `HF_API_KEY_ID` y `HF_API_KEY_SECRET`.
2. Revise `scripts/higgsfield/prompts.json` (modelos, prompts por ambiente, videos encadenados a imágenes, texturas).
3. `npm run higgsfield:generate -- --dry-run` para ver las solicitudes; luego sin `--dry-run`. Agregue `--textures` para texturas tileables.
4. Los archivos se descargan a `public/higgsfield/` y se registra `public/higgsfield/manifest.json`.

Sin API: exporte imágenes o videos desde higgsfield.ai como `public/higgsfield/<id>.jpg|mp4` (ids en `prompts.json`)
y ejecute `npm run higgsfield:generate -- --scan`.

Con manifiesto, la web muestra renders fotorrealistas en la ficha de cada ambiente (modo 360°), al final del recorrido y
en la versión sin WebGL, y reemplaza texturas procedurales por las generadas. Sin manifiesto, todo funciona igual.
Las claves nunca se envían al navegador (no use el prefijo `VITE_`).

> La integración se escribió siguiendo la documentación pública; no pudo probarse contra la API real porque no hay
> credenciales en este entorno. Los nombres de modelo de `prompts.json` deben confirmarse en su consola.

## Contacto

El botón "Agendar visita" abre un formulario. Defina `VITE_CONTACT_ENDPOINT` (Formspree, CRM o función serverless) para
recibir las solicitudes por POST JSON; sin él funciona en modo demostración.

## Limitaciones conocidas

- La casa está modelada con geometría procedural (no un GLB de un estudio de 3D). El pipeline de materiales acepta
  texturas fotográficas y el código de escena puede cargar un GLB si en el futuro se dispone de uno.
- La iluminación global se aproxima con mapa de entorno dinámico, luz hemisférica y oclusión ambiental en pantalla; no hay
  GI horneada.
