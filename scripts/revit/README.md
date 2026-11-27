# Revit + Claude por MCP

Para cuando haya un proyecto real en Revit: Claude abre el modelo, elige y exporta las vistas, y esas
imágenes entran al mismo flujo que hoy usan los renders de Blender (`scripts/cine/README.md`).
Las formas quedan exactas porque salen del modelo del arquitecto.

## Qué hace falta

- **Windows con Revit 2027.2** (por ahora la única versión que soporta el servidor oficial) y su licencia.
- El complemento **Revit Public MCP Server** de Autodesk (Technical Preview; Autodesk no le pone un
  precio aparte). Se descarga desde [accounts.autodesk.com](https://accounts.autodesk.com), entre los
  productos incluidos en la licencia de Revit 2027. Hay tres variantes; se instala **una sola**:
  - **Read-Tools**: sólo lee y exporta. Es la recomendada para este flujo, porque no puede cambiar el modelo.
  - **Write-Tools**: además mueve, rota y cambia parámetros.
  - **Experimental-Tools**: además crea cortes, planos, láminas, tablas y exporta IFC.
- **Claude Desktop** (también funciona con Claude Code, ver abajo).

Documentación oficial:
[anuncio](https://www.autodesk.com/blogs/aec/2026/06/17/revit-public-mcp-server/) ·
[ayuda](https://help.autodesk.com/cloudhelp/ENU/ADSKMCP-RevitMcp/files/ADSKMCP_RevitMcp_revit_mcp_server_html.html) ·
[herramientas](https://help.autodesk.com/cloudhelp/ENU/ADSKMCP-RevitMcp/files/revitmcp_tools.html)

## Instalación (5 minutos)

1. Instalar el complemento Read-Tools para Revit 2027.2.
2. En Claude Desktop: *Settings → Developer* (activar el modo desarrollador) *→ Edit Config*. Se abre
   `claude_desktop_config.json`; pegar el contenido de [`claude_desktop_config.json`](./claude_desktop_config.json)
   de esta carpeta (si ya tenía otros servidores, agregar sólo la entrada dentro de `mcpServers`).
3. Guardar y reiniciar Claude Desktop. Ojo: en Windows las barras van dobles (`\\`) y no puede
   quedar una coma al final de la última entrada, si no el archivo no carga.
4. Abrir Revit 2027.2 con el modelo.
5. Probar en Claude: *"Listá las herramientas de Revit MCP disponibles"*.

**Claude Code** (en la misma PC con Windows), una sola vez en una terminal:

```powershell
claude mcp add revit-read -- "C:\Program Files\Autodesk\Revit 2027 MCP Server Read-Tools Technical Preview\Autodesk.RevitMcpServer.Stdio.exe" --ManageConfigurationWithAutodeskRevitPluginInstaller=true
```

Autodesk sólo documenta Claude Desktop y Cursor; el comando de Claude Code usa el mismo ejecutable
(servidor local por STDIO), pero no está probado todavía.

## Herramientas útiles para este flujo

| Herramienta | Para qué |
| --- | --- |
| `get_active_context`, `query_model`, `get_element_data` | Entender el modelo: niveles, ambientes, materiales |
| `open_view`, `show_elements` | Abrir una vista y encuadrar elementos |
| `export_views` | Exportar vistas a PNG/JPG/TIFF (o PDF) en una carpeta |
| `create_section_view` (Experimental) | Crear un corte para el "video de corte de sección" |
| `get_rooms`, `get_room_boundaries` (Experimental) | Ambientes y superficies para los textos de la página |

No hay herramienta para crear cámaras 3D ni para renderizar: las vistas en perspectiva tienen que
existir en el modelo (las cámaras que arma el arquitecto). Claude las lista, las abre y las exporta.

## Pedido tipo para Claude

> Con el modelo abierto en Revit: listá las vistas 3D en perspectiva, elegí las 3 o 4 que mejor
> muestren la fachada, el living, la cocina y el exterior, exportalas a PNG en 1920×1080 en
> `C:\Proyectos\Casa\cine\` y armá un corte longitudinal por el living. Después escribí, para cada
> imagen, un prompt de movimiento de cámara de 5 s para Kling.

Después las imágenes van a `public/cine/stills/` y se siguen los pasos 2 y 3 de `scripts/cine/README.md`.
Para más realismo que el render de Revit, la imagen exportada puede pasar primero por un render en
Blender o Enscape con las mismas cámaras; el resto del flujo no cambia.
