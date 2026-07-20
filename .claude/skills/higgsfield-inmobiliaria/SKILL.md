---
name: higgsfield-inmobiliaria
description: Pipeline completo de contenido inmobiliario con IA usando el MCP de Higgsfield — walkthroughs cinematográficos por habitación, vídeos aéreos tipo drone, staging virtual (foto y vídeo "antes/después" amoblado), plano interactivo por habitación y mapa interactivo de barrio. Usar SIEMPRE que el usuario quiera crear vídeo o contenido visual para una propiedad, listing o anuncio inmobiliario — aunque diga solo "hacé un vídeo de esta casa", "amoblá esta foto", "armá el tour", "hacé el plano interactivo" o "el mapa del barrio" — y también para preguntas de precios/paquetes/outreach de este servicio. Cubre el flujo técnico real del MCP de Higgsfield (upload → get_cost → generate → poll → download), los errores comunes de plan/parámetros, y el ensamblaje final con ffmpeg.
---

# Vídeos y contenido con IA para inmobiliarias (Higgsfield + Claude Code)

Pipeline para producir entregables profesionales de marketing inmobiliario a partir de fotos reales de una propiedad, usando el MCP de Higgsfield para generación y ffmpeg para ensamblaje.

**El manual completo está en `references/manual-completo.md`** — leerlo (o la sección relevante) antes de ejecutar un formato por primera vez en la sesión. Este SKILL.md resume lo operativo; el manual tiene el detalle de cada formato, precios, outreach y optimización de tokens.

## Los 5 entregables

| # | Entregable | Qué es | Detalle en el manual |
|---|---|---|---|
| 1 | **Walkthrough cinematográfico** | Recorrido interior habitación por habitación: N clips de ~5s (imagen→vídeo) unidos con ffmpeg | Sección 5 |
| 2 | **Drone / aéreo** | Tomas de fachada, terreno y entorno a partir de una foto exterior | Sección 6 |
| 3 | **Plano interactivo** (web) | Página HTML autocontenida: plano con hotspots clicables por habitación | Sección 7 + `assets/plano-interactivo.html` |
| 4 | **Mapa de barrio** (web) | Mapa Leaflet/OSM con el pin de la propiedad y puntos de interés reales | Sección 8 + `assets/mapa-barrio.html` |
| 5 | **Staging virtual** | Foto vacía → foto amoblada (imagen), y vídeo de transición vacío→amoblado con `start_image`+`end_image` | Sección 9 |

## Flujo técnico del MCP de Higgsfield (siempre en este orden)

1. **Chequear cuenta antes de generar nada:** `balance` (créditos + plan) y `list_workspaces` (seleccionar el workspace con plan pago vía `select_workspace` si aplica). Casi todos los modelos de vídeo requieren plan pago: el error `Requires basic plan or higher` significa cuenta free conectada, NO falta de créditos.
2. **Subir medios:** `media_upload` → `curl -X PUT --data-binary @archivo '<upload_url>'` → `media_confirm`. Reutilizar `media_id` ya confirmados; no volver a subir la misma foto.
3. **Preflight de costo:** llamar a `generate_video`/`generate_image` con `params.get_cost: true` antes de cualquier tanda. Ojo: el preflight NO detecta el bloqueo por plan.
4. **Generar:** `generate_video`/`generate_image`. **Todos los parámetros van anidados en `params`** (`params.model`, `params.prompt`, `params.medias`) — pasarlos sueltos falla con "expected string, received undefined".
5. **Poll:** `job_display` con el `id` cada 15-20s hasta `status: "completed"`.
6. **Descargar:** `curl -s -o archivo '<results.rawUrl>'`.

Modelos clave: **Seedance 2.0** y **Kling 3.0** aceptan `start_image` + `end_image` (interpolación — así se hace el vídeo de staging y las transiciones entre habitaciones). Ver tablas de modelos y costos en el manual, sección 3.

## Reglas de prompting que definen la calidad

- **Prompt = cámara + luz, nunca redescribir la escena.** La foto ya trae el contenido; redescribirlo deforma la geometría (paredes dobladas, muebles derretidos).
- **Un solo movimiento de cámara por clip, siempre lento.**
- **Máster en 16:9**; el corte 9:16 para redes se hace con `reframe` sobre el máster terminado — nunca regenerar en otra relación de aspecto.
- **Orden de fotos como si alguien caminara la propiedad:** exterior → entrada → salón → cocina → pasillos → habitaciones → baño → exterior final.
- Tabla habitación→movimiento de cámara: manual, sección 5.
- En staging: **nunca alterar la estructura real** (paredes, ventanas, pisos) — solo mobiliario y decoración.

## Formatos web (3 y 4)

- Partir SIEMPRE de las plantillas en `assets/` — nunca entregarlas sin personalizar: paleta/tipografía del cliente en las variables `--brand-*` (la misma identidad en todos los entregables del cliente), datos reales, probado en móvil.
- Plano interactivo: hotspots en % sobre el plano (no píxeles), rellenar el array `ROOMS`.
- Mapa de barrio: coordenadas y puntos de interés reales y verificados — nunca inventar distancias. Necesita internet (CDN + teselas OSM), se entrega como archivo.

## Ensamblaje y verificación (walkthrough)

Normalizar cada clip a 1080p/30fps/h264 con ffmpeg, concatenar en orden (`room-01-`, `room-02-`...), cortes secos por defecto. Verificar con `ffprobe` que la duración final ≈ suma de clips. Comandos exactos: manual, sección 5.

## Estándar antes de entregar cualquier cosa

¿Coincide con la identidad visual del cliente? ¿1080p mínimo? ¿cero artefactos de IA visibles (si un clip sale mal, se regenera)? ¿probado en móvil si es web? ¿el nombre del entregable es honesto ("walkthrough cinematográfico", no "3D real"; "plano interactivo", no "Matterport")?

## Negocio (precios, paquetes, outreach)

Para preguntas de cuánto cobrar, qué paquetes armar o cómo conseguir clientes: manual, secciones 11 y 12. Para trabajar varias propiedades sin quemar tokens (fichas por propiedad, lecturas en paralelo, sesión nueva por propiedad): sección 13.

## Skills relacionadas (colección marketingskills)

Este skill produce los entregables; para venderlos y escalar el servicio, combinarlo con las skills de marketing instaladas en este proyecto. Al trabajar la parte comercial, leer primero `product-marketing` (fundación de todas) y luego la que aplique:

- **`prospecting`** — encontrar agencias y listings sin vídeo (el argumento de venta del manual, sección 12).
- **`cold-email`** — redactar el email en frío con asunto = dirección del inmueble.
- **`offers` + `pricing`** — armar y afinar los paquetes Starter/Growth/Full.
- **`social` + `video`** — distribuir los cortes 9:16 del walkthrough en redes.
- **`emails`** — secuencias de seguimiento a agencias interesadas.
- **`marketing-plan`** — plan de crecimiento del servicio completo.
