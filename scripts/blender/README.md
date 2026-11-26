# Pipeline de Blender

Reconstruye la residencia con Blender para que la web se vea casi fotorrealista sin perder fluidez:
texturas PBR reales, mobiliario modelado y modelos CC0 de Poly Haven, y la luz indirecta
(cielo, rebote del sol y luminarias) horneada con Cycles en un atlas de luz.

Todo corre sin interfaz gráfica, con Blender como módulo de Python (`pip install bpy`).

## Qué produce

| Archivo | Contenido |
| --- | --- |
| `public/models/house.glb` | Arquitectura y mobiliario (meshopt, UV de lightmap en el canal 1, texturas de modelos en KTX2) |
| `public/models/lightmap-4k.ktx2` / `-2k` | Atlas de luz. R = cielo, G = rebote del sol, B = luminarias. Codificación raíz cuadrada |
| `public/models/textures/<material>/` | Texturas en mosaico de cada material (color, normal y rugosidad en KTX2) |
| `public/models/house.json` | Manifiesto: rutas, escalas del atlas y metros por repetición de cada textura |

La web (`src/scene/baked.ts`) mezcla los tres canales del atlas en cada frame según la hora:
el cielo se tiñe con su color, el rebote sigue al sol y las luminarias se encienden al anochecer.
El sol directo y sus sombras siguen siendo en tiempo real. Si el manifiesto no existe o la carga
falla, la web vuelve sola a la casa procedural (también se fuerza con `?engine=procedural`).

## Cómo regenerarlo

```bash
# 0. entorno (una vez): Blender como módulo + utilidades
python3.13 -m venv ~/blenv && ~/blenv/bin/pip install bpy pillow numpy scipy
export HOUSE_WORK=~/house-work

# 1. volcar la geometría procedural etiquetada por pieza (muebles, árboles…)
npx tsx scripts/blender/export-geometry.ts $HOUSE_WORK/geo

# 2. descargar texturas y modelos de Poly Haven (CC0) y prepararlos
for t in concrete_wall_008 plastered_wall_04 marble_01 sandstone_blocks_08 stone_wall_04 granite_tile_03 \
         stone_tiles_02 oak_wood_planks walnut_veneer wood_floor_deck smoked_walnut_veneer rough_linen \
         poly_wool_herringbone fabric_leather_02 leafy_grass rock_face_03 sand_01 white_plaster_02; do
  ~/blenv/bin/python scripts/blender/phfetch.py tex $t 2k $HOUSE_WORK/tex; done
for m in mid_century_lounge_chair modern_arm_chair_01 coffee_table_round_01 modern_coffee_table_01 \
         potted_plant_01 potted_plant_02 potted_plant_04 marble_bust_01 lambis_shell ceramic_vase_01 \
         ceramic_vase_03 shrub_04 jacaranda_tree; do
  ~/blenv/bin/python scripts/blender/phfetch.py model $m 1k $HOUSE_WORK/models; done
~/blenv/bin/python scripts/blender/prepare_textures.py

# 3. Blender: escena, UV de lightmap, horneado y exportación
cd scripts/blender
~/blenv/bin/python build.py assemble
~/blenv/bin/python build.py uv
LM_SAMPLES=256 ~/blenv/bin/python build.py bake     # ~1 h en 4 núcleos
~/blenv/bin/python build.py export
~/blenv/bin/python build.py preview                 # renders de control (opcional)
cd ../..

# 4. optimizar para la web
node scripts/blender/optimize.mjs $HOUSE_WORK
```

Variables útiles: `LM_SIZE` (resolución del atlas, 4096 por defecto) y `LM_SAMPLES` (muestras del horneado).

## Dónde tocar

- Materiales, texturas y tintes: `MATS` en `common.py` (y `TEX` en `optimize.mjs` para la web).
- Muebles nuevos: `kit.py`. Qué pieza procedural se reemplaza por cuál: `assemble()` en `build.py`.
- Luminarias horneadas: `src/data/lighting.ts` (las mismas que usa la versión procedural).
- Balance entre canales del atlas en la web: `BAKE_GAIN` en `src/scene/Atmosphere.tsx`.

Las texturas y modelos son CC0 de [Poly Haven](https://polyhaven.com); no requieren atribución.
