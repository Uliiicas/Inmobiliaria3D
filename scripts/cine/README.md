# Recorrido cinematográfico (`/cine/`)

Una página aparte donde el scroll avanza por escenas de la casa, al estilo de los reels de arquitectura
hechos con IA: **render fijo exacto → animación con IA → web que recorre los clips con el scroll**.

```
Blender Cycles (scripts/blender/hero.py)      renders 1920×1080 de las mejores vistas
        │
        ▼
Kling / Hailuo / Higgsfield (image-to-video)  5 s de movimiento de cámara por vista
        │
        ▼
scripts/cine/encode.sh                        keyframe cada 4 cuadros para recorrerlo con el scroll
        │
        ▼
public/cine/clips/<id>.mp4  →  /cine/         la página lo detecta solo
```

Mientras una escena no tiene clip, la página muestra su render con un movimiento Ken Burns que imita el
mismo movimiento de cámara del prompt, así que el sitio funciona desde el primer día y cada clip que
llega lo mejora sin tocar código. `?stills` fuerza las imágenes fijas para comparar.

## Escenas

Se definen en `public/cine/escenas.json` (texto, imagen, movimiento Ken Burns). Para agregar una vista:
sumarla a `VIEWS` en `scripts/blender/hero.py`, renderizarla, copiar el JPG a `public/cine/stills/` y
agregar su entrada al JSON.

## 1. Renders

```bash
cd scripts/blender
HOUSE_WORK=~/work python hero.py                                   # 4 vistas, 1920×1080, 128 muestras (~8 min c/u en 4 núcleos)
HERO_VIEWS=living HERO_RES=640x360 HERO_SAMPLES=16 HERO_TAG=test python hero.py   # prueba de encuadre en segundos
```

`hero.py` agrega lo que la web dibuja con shaders propios (agua de la pileta y mar), enciende las
luminarias y corrige dos defectos de la geometría procedural que sólo se ven en un render directo
(normales invertidas y muros superpuestos en el mismo plano, que salían negros).

## 2. Animar con IA (gratis)

Kling y Hailuo regalan créditos todos los días (alcanzan para unos pocos clips por día; las cantidades cambian seguido).
En los dos: **Image to Video**, subir el render, pegar el prompt, duración **5 s**, formato **16:9**,
modo estándar. Si hay campo de *negative prompt*, pegar el de abajo. Conviene generar 2 versiones de
cada escena y quedarse con la que no deforme la arquitectura.

El movimiento de cada prompt coincide con el Ken Burns de la página, así el clip reemplaza a la imagen
sin cambiar la sensación del scroll.

**Negative prompt (todas):**
`morphing, warping, melting walls, bending lines, extra furniture, new objects, people, text, watermark, flicker, fast camera, zoom burst, distorted geometry`

| Escena | Imagen | Prompt |
| --- | --- | --- |
| `fachada` | `stills/fachada.jpg` | Slow cinematic drone push-in toward a modern beachfront villa at golden hour. The camera glides forward and slightly down over the infinity pool, with gentle parallax between the trees and the house. Warm low sunset light, a light breeze moving the tree leaves, soft ripples on the pool water. The architecture stays perfectly rigid and unchanged. Photorealistic, smooth steady motion. |
| `living` | `stills/living.jpg` | Slow lateral dolly from left to right inside a double-height modern living room with floor-to-ceiling glass facing the ocean. Gentle parallax between the armchairs in the foreground and the window wall. Warm late-afternoon sunlight, the fireplace flame flickers softly, bright ocean light pours through the glass. Furniture and architecture stay rigid and unchanged. Photorealistic interior, smooth gimbal motion. |
| `comedor` | `stills/comedor.jpg` | Slow push-in past a long walnut dining table toward the floor-to-ceiling windows with an ocean view in the afternoon. Subtle parallax over the chairs, sunlight shimmering softly on the stone floor, calm sea outside. Architecture and furniture remain rigid, no morphing. Photorealistic, steady cinematic camera. |
| `piscina` | `stills/piscina.jpg` | Low camera gliding slowly forward along an infinity pool toward the ocean horizon at sunset. Gentle ripples and moving reflections on the water, the tree sways slightly in the breeze. The modern villa on the left stays rigid. Photorealistic, smooth steady motion, warm golden light. |

Higgsfield (si algún día hay créditos): mismo prompt con el modelo *DoP* o *Seedance image-to-video*.

## 3. Publicar un clip

```bash
scripts/cine/encode.sh ~/Descargas/clip-de-kling.mp4 living   # → public/cine/clips/living.mp4
```

Necesita `ffmpeg`. Cada clip recodificado pesa 4–8 MB.
