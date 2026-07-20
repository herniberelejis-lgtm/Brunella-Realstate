# Manual completo: Vídeos y contenido con IA para Inmobiliarias (Higgsfield + Claude Code)

> Un solo documento con todo: setup, los 4 formatos de entregable, cómo usar el MCP de Higgsfield en la práctica (con los problemas reales que aparecen y cómo resolverlos), staging virtual, pricing, outreach, y cómo usar Claude Code de forma eficiente para este flujo de trabajo. Pensado para copiar/pegar en cualquier Claude Code nuevo.

---

## Índice

1. [Por qué esto es un negocio real](#1-por-qué-esto-es-un-negocio-real)
2. [Stack de herramientas](#2-stack-de-herramientas)
3. [Todo lo que hay que saber de Higgsfield](#3-todo-lo-que-hay-que-saber-de-higgsfield)
4. [Setup: conectar Higgsfield con Claude](#4-setup-conectar-higgsfield-con-claude)
5. [Formato 1 — Walkthrough cinematográfico](#5-formato-1--walkthrough-cinematográfico)
6. [Formato 2 — Drone / aéreo](#6-formato-2--drone--aéreo)
7. [Formato 3 — Plano interactivo por habitación (web)](#7-formato-3--plano-interactivo-por-habitación-web)
8. [Formato 4 — Mapa interactivo de barrio (web)](#8-formato-4--mapa-interactivo-de-barrio-web)
9. [Staging virtual (fotos y vídeo de "antes/después" amoblado)](#9-staging-virtual-fotos-y-vídeo-de-antesdespués-amoblado)
10. [El estándar de profesionalismo (aplica a todos los formatos)](#10-el-estándar-de-profesionalismo-aplica-a-todos-los-formatos)
11. [Precios, paquetes y economía del negocio](#11-precios-paquetes-y-economía-del-negocio)
12. [Cómo conseguir clientes (outreach)](#12-cómo-conseguir-clientes-outreach)
13. [Usar Claude Code de forma eficiente para este flujo (optimización de tokens)](#13-usar-claude-code-de-forma-eficiente-para-este-flujo-optimización-de-tokens)
14. [Fuentes](#fuentes)

---

## 1. Por qué esto es un negocio real

- El vídeo es el factor que más diferencia un anuncio inmobiliario: más visualizaciones → más visitas → venta/alquiler más rápido.
- Las agencias y gestores de propiedades (venta, alquiler, alojamiento turístico) ya pagan cientos de euros/dólares al mes por vídeo profesional. La IA no crea la demanda: la abarata brutalmente (de cientos de dólares por vídeo a unos pocos dólares en créditos).
- La oportunidad no es "vender IA", es vender el mismo resultado (más visitas, venta más rápida) mucho más barato y rápido que un fotógrafo/videógrafo tradicional.
- El valor real está en el **flujo de trabajo repetible**, no en el vídeo suelto. El mismo pipeline sirve para inmuebles, Airbnb, e-commerce, turismo, etc.

---

## 2. Stack de herramientas

| Herramienta | Para qué | Obligatoria |
|---|---|---|
| **Higgsfield** (plan de pago) | Generación de vídeo/imagen (Seedance 2.0, Kling 3.0, Veo 3.1, Nano Banana, GPT-Image, etc.) | Sí |
| **Claude** (Desktop / Code / Cowork) | Orquestador: conecta con Higgsfield vía MCP y ejecuta el flujo completo | Sí |
| ElevenLabs | Voz en off y música para anuncios cinematográficos completos | Opcional |
| Airtable | Trackear proyectos: dirección creativa, guion, escenas, inputs/outputs | Opcional |
| FFmpeg | Ensamblar clips en el vídeo final | Recomendado |
| Leaflet + OpenStreetMap | Mapa interactivo de barrio (gratis, sin API key) | Solo formato 4 |
| CapCut | Edición manual rápida cuando se generan clips por separado | Recomendado |

---

## 3. Todo lo que hay que saber de Higgsfield

Esta sección es la más importante y la que menos se documenta en tutoriales — son los detalles reales que aparecen al usar el MCP de Higgsfield desde Claude Code.

### 3.1 Planes y el bloqueo que nadie menciona

Higgsfield tiene un plan **free** y planes de pago (Plus/Ultra, o "Basic" en adelante). El plan free da unos créditos de cortesía (~10), pero **el bloqueo real no es de créditos, es de plan**:

> Prácticamente todos los modelos de vídeo (Seedance 2.0, Kling 3.0) y varios modelos de imagen premium (GPT-Image 2) devuelven el error `Requires basic plan or higher` / `job_minimum_basic_plan_required` en cuanto intentás generar algo real — **incluso si tenés créditos de sobra**. El `get_cost` (preflight de costo) SÍ funciona en plan free y no avisa de este bloqueo; el error solo aparece al lanzar la generación real.

Qué modelo sí funciona en plan free (para pruebas rápidas sin pagar):
- `nano_banana_2` (imagen) — el backend lo redirige automáticamente a una variante gratuita llamada `nano_banana_flash`. Cuesta ~1.5 créditos por imagen real (aunque el preflight de costo puede mostrar 2).

**Moraleja:** si conectás Higgsfield a un Claude Code nuevo y algo fallla con "requires basic plan", **no es un bug ni un tema de créditos — hay que confirmar que la cuenta conectada al MCP sea la cuenta con el plan pago**, revisando en Claude → Configuración → Connectors → Higgsfield (desconectar/reconectar si hace falta).

### 3.2 Cómo consultar el estado de la cuenta

Antes de generar nada en un proyecto nuevo, conviene chequear:

- **Balance y plan:** la herramienta `balance` devuelve `{"credits": N, "subscription_plan_type": "free"|"plus"|...}`.
- **Workspaces:** `list_workspaces` lista todos los workspaces (personal + de equipo) con sus créditos y plan; `is_selected` indica cuál está activo. Si el usuario pertenece a un workspace de equipo con plan pago, hay que seleccionarlo con `select_workspace` antes de generar (si no, se factura contra el workspace personal, que puede ser el gratuito).

### 3.3 Modelos de vídeo — tabla de referencia

| Modelo | Uso principal | Soporta start+end image (interpolación) | Costo aprox. (5s) |
|---|---|---|---|
| **Seedance 2.0** | Walkthrough, identidad consistente, multi-SKU | Sí (`start_image`, `end_image`) | 1080p std: ~45cr · 720p fast: ~17.5cr · 480p fast: ~7.5cr |
| **Kling 3.0** | Multi-shot, transferencia de movimiento, **interpolación start→end** | Sí — ideal para "de vacío a amoblado" en un solo clip | std sin sonido: ~7.5cr |
| **Google Veo 3.1** | Máxima calidad cinematográfica | No (solo start_image) | variable según `quality` |
| **Grok Video 1.5** | Image-to-video con dirección de audio nativa | No (solo start_image) | variable |
| **Cinema Studio Video (Higgsfield)** | Cámara y color refinados, múltiples tomas | Sí | variable |

**Dato clave:** tanto Seedance 2.0 como Kling 3.0 aceptan roles `start_image` **y** `end_image` en el mismo clip. Esto significa que se puede pedir literalmente "empieza en la foto vacía, termina en la foto amoblada" y el modelo genera la transición — es la forma correcta de hacer un vídeo de "antes/después" de staging, en vez de intentar animar dos vídeos separados.

### 3.4 Modelos de imagen — tabla de referencia

| Modelo | Uso principal | Plan mínimo | Costo aprox. |
|---|---|---|---|
| `nano_banana_2` | Edición/generación rápida, funciona en free (como `nano_banana_flash`) | Free (versión flash) / Plus para la versión completa | ~1.5-2cr |
| `gpt_image_2` | Edición fiel a instrucciones, texto y diagramas | Basic+ | ~2cr |
| `nano_banana_pro` | Máxima calidad, 4K, texto/diagramas | Basic+ | variable |
| `kling_omni_image` | Generación fotorrealista versátil | Basic+ | variable |

### 3.5 Flujo técnico real para generar algo (paso a paso, tal cual funciona)

Esto es lo que hay que hacer en cada generación, en orden:

1. **(Opcional) Elegir modelo:** `models_explore` con `action: "recommend"`, pasando `input` (`image` o `text`), `type` (`image`/`video`/`audio`/`3d`) y una `query` describiendo el caso de uso. Devuelve modelos rankeados con sus parámetros exactos (duración, resolución, roles de media aceptados).
2. **Subir la imagen de referencia** (si Claude Code tiene el archivo en disco, cosa que un cliente de chat normal no puede hacer):
   - `media_upload` con `filename` + `content_type` (o `files: [...]` para subir varias en paralelo) → devuelve `upload_url` (URL presignada), `media_id`, e instrucciones de `curl`.
   - Subir los bytes reales con `curl -X PUT -H "Content-Type: ..." --data-binary @archivo.jpg '<upload_url>'` (no hace falta un cliente HTTP especial, un `curl` normal desde Bash alcanza).
   - Confirmar con `media_confirm` pasando `media_id` (o `media_ids: [...]` para varias) y `type: "image"`.
3. **(Recomendado) Preflight de costo:** llamar a `generate_video`/`generate_image` con `params.get_cost: true` y el resto de parámetros — devuelve `{"cost": {"credits": N}}` sin gastar nada ni encolar ningún trabajo. Hacer esto SIEMPRE antes de una tanda grande.
4. **Generar:** `generate_video` o `generate_image` con `params.model`, `params.prompt`, y `params.medias: [{role: "start_image", value: "<media_id>"}]` (agregar `end_image` si se quiere interpolación). El resultado vuelve con `status: "pending"|"queued"|"in_progress"|"completed"` y un `id` de trabajo.
5. **Poll del resultado:** `job_display` con el `id` — repetir cada 15-20s hasta `status: "completed"`. El resultado trae `results.rawUrl` (o `minUrl` para preview liviana).
6. **Descargar:** un `curl -s -o archivo.png '<rawUrl>'` normal desde Bash.

**Nota importante de esquema:** en todas estas herramientas, los parámetros van **anidados dentro de `params`**, no sueltos en el nivel superior de la llamada (por ejemplo `params.model`, `params.prompt`, `params.medias`, no `model`/`prompt`/`medias` sueltos) — es un error común al primer intento.

### 3.6 Errores comunes y qué significan

| Error | Causa real | Solución |
|---|---|---|
| `Requires basic plan or higher` / `job_minimum_basic_plan_required` | La cuenta conectada al MCP está en plan free | Reconectar la cuenta correcta en Connectors, o upgradear el plan |
| `prompt is required for <modelo>` | Se llamó con `get_cost: true` pero sin `prompt`, y ese modelo lo exige incluso para el preflight | Agregar un `prompt` (puede ser genérico) al preflight |
| Falla de validación "expected string, received undefined" en `model`/`prompt` | Se pasaron esos campos fuera de `params` | Anidarlos dentro de `params` |
| Video/imagen con geometría rara (muebles derretidos, puertas dobladas) | Prompt redescribiendo la escena en vez de solo cámara+luz, o movimiento de cámara demasiado agresivo | Ver sección 5 — prompt = cámara + luz, un solo movimiento, lento |

---

## 4. Setup: conectar Higgsfield con Claude

### 4.1 Conexión MCP (Claude Desktop / Cowork — uso conversacional)

1. Crear cuenta en Higgsfield y confirmar plan de pago activo (ver sección 3.1 — esto es lo que más falla).
2. En Higgsfield: **MCP y CLI** → copiar la URL del MCP.
3. Claude Desktop → **Customize/Configuración** → **Connectors** → **Add custom connector** → pegar la URL, darle nombre (ej. "Higgsfield") → **Allow**.
4. Configurar aprobación manual antes de generar (evita gastar créditos por error mientras se aprende el flujo).

### 4.2 Conexión CLI (Claude Code — pipelines automatizados)

1. Instalar el **Higgsfield CLI** (comando oficial en su web) y ejecutar `higgsfield auth login`.
2. Instalar la **skill oficial de Higgsfield** para Claude Code si está disponible.
3. Para proyectos grandes: darle a Claude Code un documento de plan técnico (marca, modelo de vídeo, proveedor) y pedirle que lea el plan, identifique riesgos, y construya por fases.

### 4.3 Seguridad de API keys

- Nunca pegar keys directo en el chat ni en capturas compartidas.
- Guardarlas en `.env`, nunca hardcodeadas.
- Si se expone una key sin querer, revocarla y generar una nueva de inmediato.

---

## 5. Formato 1 — Walkthrough cinematográfico

El formato base: recorrido interior habitación por habitación.

### La restricción que lo explica todo

Los modelos de vídeo de Higgsfield son **imagen→vídeo**: animan un movimiento de cámara sobre UNA foto fija, en clips cortos (~5s). No reconstruyen el espacio 3D ni "caminan" por toda la casa en una sola generación. Por eso:

- Un walkthrough completo = **N clips por habitación**, unidos después con ffmpeg.
- Nunca prometer "3D real" o "estilo Matterport" — se vende honestamente como **"walkthrough cinematográfico"**.

### Regla de oro: prompt = cámara + luz, no la escena

La foto ya trae el contenido (muebles, distribución, estilo). Si se describe la habitación en el prompt, se compite con la propia imagen y el resultado se desvía (paredes dobladas, muebles derretidos). En el prompt solo hay que especificar:
1. El **movimiento de cámara**.
2. La **luz / momento del día** (como capa, no redescribiendo la habitación).
3. Si el estilo es cinematográfico: una capa de **look de color/atmósfera**.

### Tabla: tipo de habitación → movimiento de cámara

| Habitación / toma | Movimiento recomendado |
|---|---|
| Exterior / fachada | Aproximación aérea lenta o barrido lateral a lo largo de la fachada |
| Entrada / recibidor | Revelado en el umbral → steadicam hacia dentro |
| Pasillo | Steadicam a paso humano, muy suave |
| Salón / sala principal | Órbita suave o barrido de gimbal |
| Cocina | Barrido de gimbal (flujo de encimera) u órbita (isla) |
| Comedor | Barrido de gimbal (acercamiento a la mesa) |
| Habitación principal | Steadicam o barrido de gimbal suave |
| Baño principal / spa | Revelado en el umbral → push-in corto |
| Habitación secundaria | Barrido de gimbal |
| Baño de invitados | Revelado al doblar la esquina o push-in corto |
| Despacho / biblioteca | Pullback o push-in revelador |
| Especial (gimnasio, cine, bodega) | Pullback/push-in u órbita |
| Ventana / vista destacada | Aproximación a la ventana y revelado de la vista |
| Techo alto / doble altura | Tilt vertical de suelo a techo |
| Exterior/jardín/piscina | Aproximación aérea o grúa lateral, revelado ascendente |
| Detalle (mármol, herrajes) | Pullback/push-in + cambio de foco sutil |

### Reglas de prompting

- **Un solo movimiento por clip.** Los compuestos deforman la geometría.
- **Lento vence a rápido.** Rápido expone artefactos de IA.
- **La relación de aspecto = la del máster.** 16:9 para el máster, reencuadrar a 9:16 después con `reframe` — nunca regenerar dos veces.

### Ejemplo de prompt real (una habitación)

```
Camera move: slow gimbal glide across the kitchen island, subtle push-in
toward the window at the end. Warm late-afternoon light, soft shadows.
Keep the move slow and steady — no re-description of the room's contents.
Duration: ~5s.
```

### Orden de fotos (el factor #1 de calidad)

Nunca subir las fotos en orden aleatorio. Ordenarlas como si alguien caminara por la propiedad:

```
exterior/fachada → entrada → salón → cocina → pasillo/escaleras →
habitaciones → baño → terraza/jardín/vista exterior final
```

### Técnica alternativa — pares de imágenes superpuestos (Kling 3.0)

Para que la transición ENTRE dos fotos se sienta continua: generar (foto1+foto2), luego (foto2+foto3), luego (foto3+foto4)... La superposición conecta cada escena con la siguiente.

```
Smoothly blend from the first image into the second image.
Keep the camera stable and make the transition seamless (no jump cuts).
Camera direction: [empuje hacia entrada / giro leve derecha / paneo hacia atrás...]
```

### Ensamblaje con ffmpeg

```bash
# 1. Normalizar cada clip a 1080p/30fps/h264
for f in escenas/room-*.mp4; do
  ffmpeg -y -i "$f" -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30" \
    -c:v libx264 -pix_fmt yuv420p -an "norm-$(basename "$f")"
done
# 2. Concatenar en orden (nombrar los clips room-01-, room-02-... para que el sort quede bien)
ls norm-room-*.mp4 | sort | sed "s/^/file '/;s/$/'/" > concat.txt
ffmpeg -y -f concat -safe 0 -i concat.txt -c:v libx264 -pix_fmt yuv420p -an final/walkthrough-16x9.mp4
```

- Cortes secos entre habitaciones por defecto (transiciones largas se ven a screensaver).
- Corte 9:16 para redes: usar `reframe` de Higgsfield sobre el máster terminado — **nunca regenerar los clips en 9:16** (duplica el gasto de créditos).
- Verificar antes de entregar: `ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 final/walkthrough-16x9.mp4` — la duración debe ser ≈ la suma de las escenas (si no, un clip se perdió en el concat).

### Coste y tiempos

- Walkthrough completo (8-10 clips): entre 60 y 450 créditos según modelo/resolución elegidos (ver tabla de la sección 3.3).
- Truco de coste: bajar resolución corta el gasto significativamente (ver tabla de costos).

---

## 6. Formato 2 — Drone / aéreo

Vende **el terreno, la fachada y el entorno** — ideal para villas/chalets con parcela o vistas, o como apertura/cierre de un vídeo más largo.

### De dónde sacar la imagen fuente (en orden de preferencia)

1. Foto aérea real (dron real o del portal/agente).
2. Foto de fachada/exterior a nivel de calle (animar una aproximación desde ese ángulo — no forzar una "vista de pájaro" que la foto no permite).
3. Imagen generada con IA a partir de la foto real, solo como último recurso, **anotando que es una recreación, no una foto real**.

### Secuencia recomendada

| # | Toma | Movimiento |
|---|---|---|
| 1 | Establishing wide | Aproximación aérea lenta y amplia |
| 2 | Acercamiento a fachada/entrada | Descenso + avance hacia la puerta — puente al walkthrough interior si lo hay |
| 3 (opcional) | Órbita alrededor de la propiedad | 90-180° lentos |
| 4 (cierre) | Exterior/jardín/piscina | Revelado ascendente, alejándose lentamente |

```
Camera move: slow aerial approach descending toward the property entrance,
gentle forward drift. Golden hour lighting, soft warm tones, light haze.
Single slow move, no re-description of the building or landscape. ~5s clip.
```

**Cuándo NO usarlo:** pisos en bloque sin fachada/terreno propio, o sin ninguna imagen fuente que permita un ángulo elevado honesto.

---

## 7. Formato 3 — Plano interactivo por habitación (web)

No es un vídeo: es una página web donde el cliente ve el plano de la propiedad y hace clic en cada habitación para ver su foto/clip. Autocontenida (un solo archivo HTML, sin dependencias externas).

**Cómo se arma:**
1. Reunir el floor plan (imagen/render) + las fotos/clips ya generados de cada habitación.
2. Personalizar la paleta/tipografía (variables `--brand-*`) con la identidad visual del cliente — **la misma que en el mapa de barrio y en los vídeos**.
3. Rellenar el array `ROOMS` en el script: una entrada por hotspot con posición en % sobre el plano (no píxeles) y ruta a su media.
4. Probar en móvil antes de entregar (se comparte por WhatsApp).

<details>
<summary>Plantilla HTML completa (clic para expandir)</summary>

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{DIRECCION_PROPIEDAD}} — Plano interactivo</title>
<style>
  :root {
    --brand-primary: #1c2b24;
    --brand-accent: #c9a769;
    --brand-text: #f5f2ec;
    --brand-text-muted: #b9b3a6;
    --brand-surface: #24352c;
    --brand-font-display: Georgia, 'Times New Roman', serif;
    --brand-font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --radius: 14px;
    --shadow-soft: 0 12px 40px rgba(0,0,0,0.35);
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--brand-primary); color: var(--brand-text); font-family: var(--brand-font-body); min-height: 100vh; }
  header { padding: clamp(1.5rem, 4vw, 3rem) clamp(1rem, 5vw, 4rem) 1rem; }
  header .eyebrow { text-transform: uppercase; letter-spacing: 0.16em; font-size: 0.72rem; color: var(--brand-accent); margin: 0 0 0.5rem; }
  header h1 { font-family: var(--brand-font-display); font-weight: 400; font-size: clamp(1.6rem, 4vw, 2.6rem); margin: 0 0 0.35rem; }
  header p { color: var(--brand-text-muted); margin: 0; font-size: 0.95rem; }
  .plan-wrap { position: relative; max-width: 980px; margin: 1rem auto clamp(2rem, 6vw, 4rem); padding: 0 clamp(1rem, 5vw, 4rem); }
  .plan-frame { position: relative; border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-soft); border: 1px solid rgba(255,255,255,0.08); }
  .plan-frame img { display: block; width: 100%; height: auto; }
  .hotspot { position: absolute; width: 34px; height: 34px; border-radius: 50%; background: var(--brand-accent); border: 2px solid var(--brand-text); color: var(--brand-primary); font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%); cursor: pointer; transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1); }
  .hotspot::after { content: ''; position: absolute; inset: -8px; border-radius: 50%; border: 1px solid rgba(201,167,105,0.55); animation: pulse 2.4s ease-out infinite; }
  @keyframes pulse { 0% { transform: scale(0.7); opacity: 0.9; } 100% { transform: scale(1.6); opacity: 0; } }
  .hotspot:hover, .hotspot:focus-visible { transform: translate(-50%, -50%) scale(1.15); outline: none; }
  .room-legend { max-width: 980px; margin: 0 auto; padding: 0 clamp(1rem, 5vw, 4rem) clamp(2rem, 5vw, 3rem); display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.6rem; }
  .room-chip { background: var(--brand-surface); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 0.6rem 0.8rem; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: background 150ms; }
  .room-chip:hover { background: rgba(201,167,105,0.12); }
  .room-chip .num { width: 22px; height: 22px; border-radius: 50%; background: var(--brand-accent); color: var(--brand-primary); font-weight: 700; font-size: 0.75rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(10,14,11,0.82); display: none; align-items: center; justify-content: center; padding: 1.5rem; z-index: 50; }
  .modal-backdrop.open { display: flex; }
  .modal { background: var(--brand-surface); border-radius: var(--radius); max-width: 720px; width: 100%; max-height: 90vh; overflow: auto; box-shadow: var(--shadow-soft); border: 1px solid rgba(255,255,255,0.08); }
  .modal-media { width: 100%; aspect-ratio: 16 / 10; background: #000; }
  .modal-media img, .modal-media video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .modal-body { padding: 1.2rem 1.4rem 1.5rem; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .modal-body h2 { font-family: var(--brand-font-display); font-weight: 400; margin: 0 0 0.3rem; font-size: 1.3rem; }
  .modal-body p { margin: 0; color: var(--brand-text-muted); font-size: 0.9rem; }
  .modal-close { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: var(--brand-text); border-radius: 50%; width: 34px; height: 34px; flex-shrink: 0; cursor: pointer; font-size: 1rem; }
  .modal-close:hover { background: rgba(255,255,255,0.08); }
  @media (prefers-color-scheme: light) {
    :root { --brand-primary: #f7f5f0; --brand-text: #1c2b24; --brand-text-muted: #5c6960; --brand-surface: #ffffff; }
  }
</style>
</head>
<body>
<header>
  <p class="eyebrow">{{NOMBRE_AGENCIA}}</p>
  <h1>{{DIRECCION_PROPIEDAD}}</h1>
  <p>Plano interactivo — haz clic en cada punto para ver la habitación</p>
</header>
<div class="plan-wrap">
  <div class="plan-frame">
    <img id="floorplan-img" src="{{RUTA_IMAGEN_PLANO}}" alt="Plano de {{DIRECCION_PROPIEDAD}}">
  </div>
</div>
<div class="room-legend" id="room-legend"></div>
<div class="modal-backdrop" id="modal-backdrop">
  <div class="modal">
    <div class="modal-media" id="modal-media"></div>
    <div class="modal-body">
      <div><h2 id="modal-title"></h2><p id="modal-caption"></p></div>
      <button class="modal-close" id="modal-close" aria-label="Cerrar">✕</button>
    </div>
  </div>
</div>
<script>
  const ROOMS = [
    { id: 1, label: "Entrada",   xPercent: 50, yPercent: 88, media: [{ type: "image", src: "media/01-entrada.jpg", caption: "Recibidor" }] },
    { id: 2, label: "Salón",     xPercent: 62, yPercent: 55, media: [{ type: "video", src: "media/02-salon.mp4",   caption: "Salón principal" }] },
    { id: 3, label: "Cocina",    xPercent: 30, yPercent: 45, media: [{ type: "image", src: "media/03-cocina.jpg", caption: "Cocina" }] },
    // ... añadir el resto de habitaciones aquí
  ];
  const planImg = document.getElementById('floorplan-img');
  const planFrame = planImg.parentElement;
  const legend = document.getElementById('room-legend');
  const backdrop = document.getElementById('modal-backdrop');
  const modalMedia = document.getElementById('modal-media');
  const modalTitle = document.getElementById('modal-title');
  const modalCaption = document.getElementById('modal-caption');
  function openRoom(room) {
    const m = room.media[0];
    modalMedia.innerHTML = m.type === 'video'
      ? `<video src="${m.src}" controls autoplay muted loop></video>`
      : `<img src="${m.src}" alt="${room.label}">`;
    modalTitle.textContent = room.label;
    modalCaption.textContent = m.caption || '';
    backdrop.classList.add('open');
  }
  ROOMS.forEach(room => {
    const dot = document.createElement('button');
    dot.className = 'hotspot';
    dot.style.left = room.xPercent + '%';
    dot.style.top = room.yPercent + '%';
    dot.textContent = room.id;
    dot.setAttribute('aria-label', room.label);
    dot.addEventListener('click', () => openRoom(room));
    planFrame.appendChild(dot);
    const chip = document.createElement('button');
    chip.className = 'room-chip';
    chip.innerHTML = `<span class="num">${room.id}</span><span>${room.label}</span>`;
    chip.addEventListener('click', () => openRoom(room));
    legend.appendChild(chip);
  });
  document.getElementById('modal-close').addEventListener('click', () => {
    backdrop.classList.remove('open'); modalMedia.innerHTML = '';
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) { backdrop.classList.remove('open'); modalMedia.innerHTML = ''; }
  });
</script>
</body>
</html>
```

</details>

---

## 8. Formato 4 — Mapa interactivo de barrio (web)

Un mapa de la zona con el pin de la propiedad y los puntos de interés cercanos (colegios, transporte, comercio, ocio, salud) — vende el barrio, no el interior.

**Cómo se arma:**
1. Obtener coordenadas reales de la propiedad (Google Maps → clic derecho → "¿Qué hay aquí?").
2. Investigar y verificar los puntos de interés reales — nunca inventar datos ni distancias.
3. Usar exactamente la misma paleta/tipografía que en el plano interactivo (formato 3).
4. Esta plantilla necesita internet (CDN + teselas de OpenStreetMap) — se entrega como archivo, no es previsualizable dentro de un Artifact de Claude por la política de seguridad de esa herramienta (bloquea peticiones externas).

<details>
<summary>Plantilla HTML completa (clic para expandir)</summary>

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{DIRECCION_PROPIEDAD}} — Mapa del barrio</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<style>
  :root {
    --brand-primary: #1c2b24; --brand-accent: #c9a769; --brand-text: #f5f2ec;
    --brand-text-muted: #b9b3a6; --brand-surface: #24352c;
    --brand-font-display: Georgia, 'Times New Roman', serif;
    --brand-font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    --radius: 14px; --shadow-soft: 0 12px 40px rgba(0,0,0,0.35);
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--brand-primary); color: var(--brand-text); font-family: var(--brand-font-body); min-height: 100vh; display: flex; flex-direction: column; }
  header { padding: clamp(1.2rem, 4vw, 2.2rem) clamp(1rem, 5vw, 3rem) 0.8rem; }
  header .eyebrow { text-transform: uppercase; letter-spacing: 0.16em; font-size: 0.72rem; color: var(--brand-accent); margin: 0 0 0.4rem; }
  header h1 { font-family: var(--brand-font-display); font-weight: 400; font-size: clamp(1.4rem, 3.4vw, 2.2rem); margin: 0 0 0.3rem; }
  header p { color: var(--brand-text-muted); margin: 0; font-size: 0.9rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 1rem; padding: 0.8rem clamp(1rem, 5vw, 3rem) clamp(1.5rem, 4vw, 2.5rem); flex: 1; min-height: 520px; }
  @media (max-width: 780px) { .layout { grid-template-columns: 1fr; } #map { height: 380px; } }
  #map { border-radius: var(--radius); box-shadow: var(--shadow-soft); border: 1px solid rgba(255,255,255,0.08); overflow: hidden; height: 100%; min-height: 380px; }
  .sidebar { background: var(--brand-surface); border-radius: var(--radius); border: 1px solid rgba(255,255,255,0.08); padding: 1rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }
  .filter-group { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .filter-chip { border: 1px solid rgba(255,255,255,0.18); background: transparent; color: var(--brand-text); border-radius: 999px; padding: 0.35rem 0.75rem; font-size: 0.78rem; cursor: pointer; transition: background 150ms, border-color 150ms; }
  .filter-chip.active { background: var(--brand-accent); border-color: var(--brand-accent); color: var(--brand-primary); font-weight: 600; }
  .poi-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .poi-item { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; padding: 0.5rem 0.6rem; border-radius: 10px; cursor: pointer; transition: background 150ms; }
  .poi-item:hover { background: rgba(201,167,105,0.12); }
  .poi-item .name { font-size: 0.86rem; }
  .poi-item .dist { font-size: 0.76rem; color: var(--brand-text-muted); white-space: nowrap; }
  @media (prefers-color-scheme: light) {
    :root { --brand-primary: #f7f5f0; --brand-text: #1c2b24; --brand-text-muted: #5c6960; --brand-surface: #ffffff; }
  }
</style>
</head>
<body>
<header>
  <p class="eyebrow">{{NOMBRE_AGENCIA}}</p>
  <h1>{{DIRECCION_PROPIEDAD}} — el barrio</h1>
  <p>Colegios, transporte y servicios cerca de la propiedad</p>
</header>
<div class="layout">
  <div id="map"></div>
  <aside class="sidebar">
    <div class="filter-group" id="filters"></div>
    <div class="poi-list" id="poi-list"></div>
  </aside>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
  const PROPERTY_COORDS = [40.4168, -3.7038]; // [lat, lng] — CAMBIAR por la propiedad real
  const PROPERTY_LABEL = "{{DIRECCION_PROPIEDAD}}";
  const POIS = [
    { name: "Colegio Ejemplo",        category: "colegio",    coords: [40.4180, -3.7050], distance: "450 m" },
    { name: "Parada de metro Ejemplo", category: "transporte", coords: [40.4155, -3.7020], distance: "300 m" },
    { name: "Supermercado Ejemplo",    category: "comercio",   coords: [40.4175, -3.7010], distance: "600 m" },
    { name: "Parque Ejemplo",          category: "ocio",       coords: [40.4190, -3.7060], distance: "700 m" },
    // ... añadir el resto de puntos de interés reales aquí
  ];
  const CATEGORY_LABEL = { colegio: "🎓 Colegios", transporte: "🚇 Transporte", comercio: "🛒 Comercio", ocio: "🌳 Ocio", salud: "🏥 Salud" };
  const map = L.map('map', { zoomControl: true }).setView(PROPERTY_COORDS, 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  const brandAccent = getComputedStyle(document.documentElement).getPropertyValue('--brand-accent').trim();
  const propertyIcon = L.divIcon({ className: '', html: `<div style="width:22px;height:22px;border-radius:50%;background:${brandAccent};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
  L.marker(PROPERTY_COORDS, { icon: propertyIcon }).addTo(map).bindPopup(`<strong>${PROPERTY_LABEL}</strong>`).openPopup();
  const poiMarkers = [];
  POIS.forEach(poi => {
    const marker = L.marker(poi.coords).addTo(map).bindPopup(`<strong>${poi.name}</strong><br>${poi.distance}`);
    poiMarkers.push({ ...poi, marker });
  });
  function renderList(filter) {
    const list = document.getElementById('poi-list');
    list.innerHTML = '';
    poiMarkers.filter(p => filter === 'all' || p.category === filter).forEach(p => {
      const item = document.createElement('div');
      item.className = 'poi-item';
      item.innerHTML = `<span class="name">${CATEGORY_LABEL[p.category]?.split(' ')[0] || ''} ${p.name}</span><span class="dist">${p.distance}</span>`;
      item.addEventListener('click', () => { map.setView(p.coords, 17); p.marker.openPopup(); });
      list.appendChild(item);
    });
  }
  const categories = ['all', ...new Set(POIS.map(p => p.category))];
  const filtersEl = document.getElementById('filters');
  categories.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'filter-chip' + (cat === 'all' ? ' active' : '');
    chip.textContent = cat === 'all' ? 'Todo' : (CATEGORY_LABEL[cat] || cat);
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderList(cat);
      poiMarkers.forEach(p => { const show = cat === 'all' || p.category === cat; const el = p.marker.getElement(); if (el) el.style.display = show ? '' : 'none'; });
    });
    filtersEl.appendChild(chip);
  });
  renderList('all');
</script>
</body>
</html>
```

</details>

---

## 9. Staging virtual (fotos y vídeo de "antes/después" amoblado)

### 9.1 Staging fijo (foto → foto amoblada)

Con un modelo de imagen (`nano_banana_2`/`gpt_image_2`), se puede amoblar virtualmente una habitación vacía:

```
Virtually stage this empty [tipo de habitación] with high-end, luxury modern
furniture: [elementos concretos, ej. sofá, mesa de centro, alfombra].
Keep the room's architecture, walls, windows, doors, floor, and ceiling
exactly as in the original photo — do not alter structure or perspective.
Photorealistic, professional real estate listing photography style.
```

⚠️ **Nunca alterar la estructura real de la propiedad** — el objetivo es que se vea "como si un decorador la hubiera amoblado", no que el inmueble parezca distinto a la realidad (riesgo de publicidad engañosa).

### 9.2 Vídeo de "se van amoblando" (la técnica correcta)

Para el efecto de vídeo donde el ambiente pasa de vacío a amoblado: usar un modelo de vídeo que soporte **`start_image` + `end_image`** (Seedance 2.0 o Kling 3.0, ver sección 3.3):

1. Generar primero la imagen fija amoblada (paso 9.1) — esa es la `end_image`.
2. Llamar a `generate_video` con `medias: [{role: "start_image", value: "<foto vacía>"}, {role: "end_image", value: "<foto amoblada>"}]`.
3. Prompt: describir solo la transición/cámara, ej.:

```
Smooth transition as the empty room gradually becomes furnished.
Camera holds a static wide shot throughout. Warm, inviting light.
Elegant, premium furniture materializing naturally into place.
```

Esto es mucho más fiable que intentar que el modelo "invente" muebles solo con un prompt de texto sin imagen de referencia del resultado final.

### 9.3 Precios de staging

- Foto individual mejorada/amoblada: 30-100€ (o USD equivalente).
- Lote de fotos de un listing completo: 200-400€.
- Vídeo de "antes/después" amoblado: se puede vender como upsell premium dentro del paquete Growth/Full.

---

## 10. El estándar de profesionalismo (aplica a todos los formatos)

Con 4 formatos distintos, el riesgo es que cada uno se sienta hecho con un nivel de cuidado distinto — eso es lo que delata "prueba con IA" en vez de servicio serio.

1. **Identidad visual fijada por cliente, no por proyecto.** Antes del primer entregable de un cliente nuevo: definir paleta (2-3 colores), tipografía y tono (cálido/aspiracional vs. minimalista vs. lujo) — reutilizar en TODO lo que se le entregue.
2. **Estándar técnico mínimo, sin excepciones:** 1080p mínimo en cualquier vídeo final (720p solo para pruebas internas), un solo movimiento de cámara por clip siempre lento, cero artefactos de IA visibles (si un clip sale mal, se regenera), cortes secos entre escenas por defecto.
3. **Los formatos web también tienen estándar:** nunca entregar la plantilla sin personalizar, estados de interacción (hover/click) diseñados, responsive probado en móvil, imágenes optimizadas.
4. **Honestidad en el nombre de cada entregable:** "walkthrough cinematográfico" (no "3D real"), "plano interactivo" (no "tour Matterport").

**Checklist antes de entregar cualquier cosa:** ¿coincide con la identidad visual del cliente? ¿cumple el mínimo técnico? ¿cero artefactos visibles? ¿probado en móvil si es web? ¿el nombre es honesto sobre la tecnología?

---

## 11. Precios, paquetes y economía del negocio

| Paquete | Precio/mes | Incluye |
|---|---|---|
| Starter | ~500€ | Walkthrough cinematográfico de listings |
| Growth | ~1.250€ | Walkthrough + drone/aéreo (si aplica) + mejora/staging de fotos |
| Full | ~2.500€ | Todo lo anterior + plano interactivo + mapa de barrio + gestión de redes del agente |

- Coste real de generación: unos pocos dólares/euros en créditos por vídeo. Precio de venta: 200-500€ por pieza o dentro de un paquete mensual — el margen es el negocio.
- Plano interactivo o mapa de barrio sueltos: 100-250€ cada uno (coste real es casi solo tiempo).
- Vender primero **1 pieza de muestra gratis o a precio simbólico** sobre un listing real y llamativo — la forma más rápida de conseguir el primer "sí".

**Ejemplo de economía real:** con 10 clientes activos entregando ~10 vídeos/mes cada uno (100 vídeos/mes): ~35 horas de trabajo/mes, ingreso ~11.000-13.000€/mes, costes ~200-250€ en créditos + suscripción de Claude. No hace falta 100 clientes — hacen falta 10 buenos.

---

## 12. Cómo conseguir clientes (outreach)

- Buscar en portales (Idealista, Fotocasa, Zillow, Realtor.com según el mercado), Google Maps (agencias locales), Airbnb/Booking (para ofrecer el vídeo para la web propia del propietario).
- Buscar siempre **listings sin vídeo** — ahí está el argumento de venta: "tu competencia ya tiene vídeo, tú no".
- Plantilla de email en frío: **asunto = dirección exacta del inmueble** (mejora mucho la tasa de apertura). Cuerpo corto: mencionar que el anuncio lleva tiempo publicado, que se hizo un vídeo cinematográfico para atraer más visitas, pedir feedback/reunión. Generar el vídeo real solo cuando respondan (salvo el vídeo gancho de muestra inicial).

---

## 13. Usar Claude Code de forma eficiente para este flujo (optimización de tokens)

Estas son prácticas concretas para que una sesión de Claude Code no se vuelva lenta/cara innecesariamente al trabajar con muchas fotos y generaciones:

1. **No hagas que Claude "mire" todas las fotos si no hace falta.** Cada foto que se lee consume tokens de contexto de forma significativa (son imágenes, no texto). Si el ZIP tiene 30 fotos y la mitad son duplicados, primero renombralas/organizalas con `Bash` (sin leerlas) y recién ahí pedile a Claude que revise solo las que hacen falta, en tandas.
2. **Pedí varias lecturas en paralelo, no una por una.** Si hay que revisar 10 fotos, es mucho más eficiente pedir las 10 en un mismo turno que ir de a una — reduce vueltas de ida y vuelta (y por lo tanto tokens de "overhead" de cada mensaje).
3. **Usá `get_cost: true` antes de generar en lote.** Confirmar el costo de UN clip antes de lanzar 10 evita que Claude tenga que leer/relatar 10 errores si algo está mal configurado (modelo equivocado, plan insuficiente, parámetro inválido).
4. **No repitas el prompt completo del "camera-moves" en cada mensaje.** Guardá la tabla habitación→movimiento en un archivo (o en esta guía) y pedile a Claude que la lea una vez por sesión, no que se la repitas vos cada vez.
5. **Usá una carpeta de proyecto con una `FICHA.md` por propiedad** en vez de volver a explicar el contexto de la propiedad en cada mensaje nuevo — Claude puede leer el archivo en vez de que se lo cuentes de nuevo, y sirve como memoria persistente entre sesiones.
6. **Subida de medios: hacelo con `Bash`/`curl`, no pidiéndole a Claude que "suba" el archivo a mano describiéndolo.** El flujo `media_upload` → `curl -X PUT` → `media_confirm` es mecánico y no necesita razonamiento — cuanto más directo y con comandos concretos, menos tokens de exploración/tanteo gasta el modelo.
7. **Cerrá tareas explícitamente.** Si ya terminaste el walkthrough de una propiedad, decile a Claude que "esta propiedad está lista" antes de pasar a la siguiente — evita que arrastre contexto innecesario de la propiedad anterior a la nueva.
8. **Para sesiones muy largas (muchas propiedades seguidas):** conviene arrancar una sesión nueva por propiedad en vez de una sesión gigante para las 10 — cada sesión nueva parte de la `FICHA.md` + esta guía como contexto, no de todo el historial de generación de las propiedades anteriores.
9. **Preferí Bash para operaciones de archivos (mover, renombrar, copiar, hacer zip/unzip) en vez de pedirle a Claude que las razone paso a paso** — son operaciones mecánicas, no necesitan "pensar", y hacerlas por comando es más rápido y barato que hacerlas dialogando.
10. **No repitas media_id ya subidos.** Si una foto ya se subió a Higgsfield en la sesión (tiene un `media_id` confirmado), reutilizá ese id en generaciones posteriores en vez de subir el archivo de nuevo.

---

## Fuentes

Esta guía se armó combinando:
- Varios tutoriales en YouTube sobre Higgsfield + Claude Code para inmobiliarias (walkthrough básico, pipeline con Claude Code + Apify/Zillow, técnica de pares de imágenes en Kling 3.0, anuncios cinematográficos completos con voz/música).
- El skill open source (MIT) **re-walkthrough-pro** de Charles J Dove (github.com/charlesdove977/re-walkthrough-pro) — origen del mapeo habitación→movimiento de cámara, la regla "prompt = cámara + luz", y el pipeline de ffmpeg.
- Uso real y directo del MCP de Higgsfield desde Claude Code en esta sesión (sección 3) — incluyendo el hallazgo del bloqueo por plan (no por créditos), la tabla de costos real vía `get_cost`, y el flujo completo de subida/generación/descarga.