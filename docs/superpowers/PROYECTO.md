# Segundo Cerebro — Brunella Real Estate

Documento maestro del proyecto: qué es, para qué existe, cómo está armado, qué se hizo, qué
falta y hacia dónde va. Pensado para dar contexto completo a cualquiera (vos, un desarrollador
nuevo, o para retomarlo en unos meses) sin tener que reconstruir la historia leyendo commits.

---

## 1. Qué es esto y para qué existe

Brunella Picone (Grupo Banker Córdoba) es asesora inmobiliaria y llevaba su seguimiento de
clientes y propiedades a mano — WhatsApp, notas sueltas, memoria. El "Segundo Cerebro" es un
CRM hecho a medida para reemplazar eso, con un principio de diseño central: **que cargar
información sea tan fácil como hablar**, no como llenar formularios.

Se construyó en dos fases:

- **Fase 1** — CRM interno: ella le manda una nota de voz a un bot de Telegram contando qué
  pasó con un cliente, y el sistema solo la escucha, entiende y guarda todo. Más un dashboard
  web para ver y editar todo prolijamente.
- **Fase 2** — Captación automática de clientes nuevos: gente que le escribe por Instagram o
  Facebook llega a un formulario propio, el sistema arma automáticamente qué propiedades le
  sirven, y se lo manda por WhatsApp — todo sin que Brunella tenga que escribir nada a mano,
  solo aprobar desde Telegram.

Después de Fase 2 se sumaron piezas más chicas pero igual de importantes: rediseño estético del
formulario público, más criterios de búsqueda (ambientes, baños, características), y un
importador de historial de conversaciones de WhatsApp para migrar la cartera vieja de clientes
al sistema nuevo.

---

## 2. Arquitectura

### Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript, Tailwind |
| Base de datos | Postgres vía `pg` directo (sin ORM), hosteado en Supabase (solo la base — no se usa su Auth ni su Storage) |
| IA / transcripción | Groq — Whisper para transcribir audio, Llama 3.3 70B para extraer datos estructurados y resumir texto |
| Mensajería | Telegram Bot API (interfaz principal de Brunella), Meta Graph API — Messenger Platform, Instagram Messaging API, WhatsApp Cloud API |
| Hosting | Vercel (deploy + cron diario) |
| Tests | Vitest, con `pg-mem` emulando Postgres real en los tests (sin Docker ni cuenta real) |

### Principio de diseño transversal

Todo lo que Brunella hace, lo hace **desde Telegram** — es la única interfaz que usa
activamente. El dashboard web existe para mirar/editar, pero la carga y el control del día a
día pasan por el chat: notas de voz, aprobar envíos con un botón, y ahora también importar
conversaciones viejas. Cualquier feature nueva debería primero preguntarse si tiene sentido
vivir ahí antes de proponer una pantalla nueva.

### Mapa de archivos

```
src/
├── app/
│   ├── api/
│   │   ├── telegram/webhook/route.ts   # notas de voz, botón "Aprobar y enviar",
│   │   │                                 importación de conversaciones de WhatsApp
│   │   ├── meta/webhook/route.ts       # DMs de Messenger/Instagram → responde con
│   │   │                                 el link al formulario
│   │   ├── whatsapp/webhook/route.ts   # confirmación del cliente por WhatsApp →
│   │   │                                 dispara el envío del documento si ya está aprobado
│   │   └── cron/recordatorios/route.ts # recordatorio diario de seguimiento (Fase 1)
│   ├── contactos/, propiedades/        # dashboard interno (listas + fichas + edición)
│   ├── formulario/                     # UI pública de intake (comprador/propietario)
│   │   ├── page.tsx, CompradorForm.tsx, PropietarioForm.tsx
│   │   ├── actions.ts                  # Server Actions: crean Contacto/Búsqueda/Propiedad,
│   │   │                                 corren el matching, notifican por Telegram
│   │   ├── confirmar/page.tsx          # pantalla con el botón wa.me de confirmación
│   │   ├── BrandMark.tsx, zonasCordoba.ts, layout.tsx  # branding + datos de la UI
│   └── proxy.ts                        # Basic Auth del dashboard (excluye rutas públicas)
├── lib/
│   ├── domain/          # capa de datos: un módulo por tabla (contactos, propiedades,
│   │                      busquedas, conversaciones, muestras, consultas, ofertas,
│   │                      leadsPendientes). factory.ts elige Postgres real o memoria
│   │                      según haya DATABASE_URL.
│   ├── bot/             # lógica de negocio:
│   │   ├── processVoiceNote.ts         # orquesta la nota de voz (Fase 1)
│   │   ├── propertyMatching.ts         # motor de matching contra el portfolio propio
│   │   ├── compatibilityDocument.ts    # arma el mensaje de Telegram + el envío por WhatsApp
│   │   ├── enviarDocumentoAprobado.ts  # dispara el envío cuando se cumplen las dos
│   │   │                                 condiciones (aprobado + confirmado)
│   │   └── importarConversacion.ts     # orquesta la importación de historial de WhatsApp
│   ├── groq/client.ts   # transcripción, extracción estructurada, resumen de conversaciones
│   ├── telegram/, meta/, whatsapp/     # clientes HTTP de cada API externa
│   ├── view/             # validación (Zod) y utilidades de presentación
│   └── text/             # normalización de texto y matching de teléfonos
└── components/           # UI compartida del dashboard (nav, íconos)

supabase/migrations/      # 5 migraciones SQL, todas aditivas
```

### Flujo 1 — Carga por voz (Fase 1, en producción)

```
Nota de voz (Telegram) → Whisper transcribe → Llama extrae datos estructurados
  → matchea contacto/propiedad existente → guarda Conversación/Consulta/Muestra/Oferta
  → responde confirmando en el mismo chat
```

### Flujo 2 — Captación de cliente nuevo (Fase 2, en producción)

```
Lead escribe por Instagram/Messenger
  → webhook responde con link al formulario (con token de atribución si vino de un anuncio)
  → cliente completa el formulario público
  → se crea/actualiza el Contacto + la Búsqueda (o la Propiedad, si es propietario)
  → motor de matching compara contra el portfolio propio de Brunella
  → Telegram le avisa a Brunella con las coincidencias + botón "Aprobar y enviar"
  → en paralelo, se le pide al cliente que confirme mandando un WhatsApp
    (necesario: Meta no deja que un negocio escriba primero)
  → cuando se cumplen aprobación + confirmación (en cualquier orden), se manda
    automáticamente el documento de compatibilidad por WhatsApp
```

### Flujo 3 — Importar historial de WhatsApp (nuevo, en producción)

```
Brunella exporta un chat de WhatsApp (.txt, función nativa de WhatsApp)
  → lo manda por Telegram con "Nombre, Teléfono" como texto del mensaje
  → Groq resume la conversación y detecta intención de compra/venta si es clara
  → se crea/actualiza el Contacto + se guarda un resumen como Conversación
    (origen: "importado_whatsapp", para distinguirlo de notas de voz o carga manual)
```

---

## 3. Modelo de datos

Cinco migraciones, todas aditivas (ninguna borra datos existentes, salvo un caso puntual
documentado abajo):

| Migración | Qué agregó |
|---|---|
| `0001_schema.sql` | Schema original: `contactos`, `propiedades`, `busquedas`, `conversaciones`, `muestras`, `consultas`, `ofertas` |
| `0002_add_imagenes_propiedades.sql` | Campo `imagenes` en `propiedades` (URLs de fotos, una por línea) |
| `0003_fase2_intake.sql` | `moneda`/`codigo`/`dormitorios` en `propiedades`; `presupuesto_min`/`presupuesto_max`/`moneda`/`documento_aprobado`/`documento_enviado` en `busquedas` (reemplazando el viejo campo único `presupuesto`); `whatsapp_confirmado` en `contactos`; `'PH'` como tipo de propiedad válido; `'formulario_cliente'` como origen válido de consulta; tabla nueva `leads_pendientes` (atribución de anuncios) |
| `0004_caracteristicas_busqueda.sql` | `ambientes`, `banos`, `caracteristicas` (array de texto: garage, jardín, pileta, etc.) en `busquedas` |
| `0005_conversaciones_importadas.sql` | `'importado_whatsapp'` como origen válido de conversación |

Tablas principales, en criollo:

- **`contactos`** — cada persona (cliente o lead). `tipo` (Comprador/Propietario/Ambos),
  `etapa` (embudo de venta), `temperatura`, `fuente` (de dónde vino).
- **`propiedades`** — el portfolio de Brunella. `estado` (Activa/Vendida/Retirada), `codigo`
  (para atribución de anuncios), `imagenes`.
- **`busquedas`** — lo que un comprador está buscando. Es contra esto que corre el motor de
  matching.
- **`conversaciones`** — historial de interacciones con un contacto, sin importar el origen
  (voz, manual, o importado de WhatsApp).
- **`muestras`, `consultas`, `ofertas`** — eventos puntuales del embudo (mostró una propiedad,
  preguntó por una, hizo una oferta).
- **`leads_pendientes`** — leads de Instagram/Facebook que todavía no completaron el
  formulario; guarda el token de atribución al anuncio.

---

## 4. Estado actual — qué está construido y en producción

### Fase 1 (completa)
- Bot de Telegram: nota de voz → transcripción → extracción → guardado, con manejo de
  ambigüedad (pide aclaración si no está seguro a qué contacto/propiedad se refiere).
- Dashboard web con Basic Auth: listas y fichas de Contactos y Propiedades, edición inline con
  botón de lápiz, galería de fotos.
- Cron diario de recordatorios de seguimiento.
- Importador de Excel histórico de propiedades (script, uso único).

### Fase 2 (completa)
- Webhook combinado de Messenger + Instagram, con verificación de firma HMAC y atribución de
  anuncios vía el campo `ref`.
- Formulario público (`/formulario`) para comprador/propietario, sin autenticación, con
  rediseño estético (paleta clara, tipografía serif, branding de Brunella/Grupo Banker,
  autocompletado de barrios de Córdoba, selector de características tipo "pill").
- Motor de matching determinístico contra el portfolio propio (`PropertySource` es una interfaz
  intercambiable, pensada para poder sumar fuentes externas sin rediseñar nada).
- Notificación a Brunella por Telegram con las coincidencias (o el detalle completo de la
  búsqueda si no hay coincidencias — para que siempre tenga registro de qué pidió el cliente) y
  botón inline "Aprobar y enviar".
- Confirmación del cliente por WhatsApp (necesaria por la restricción de Meta de no poder
  escribir primero) + envío automático del documento de compatibilidad cuando se cumplen
  aprobación y confirmación.
- Webhook de WhatsApp Cloud API con verificación de firma.

### Extensiones post-Fase-2 (completas)
- **Importador de conversaciones de WhatsApp**: Brunella manda un `.txt` exportado al bot de
  Telegram con "Nombre, Teléfono" como texto del mensaje; Groq lo resume y crea/actualiza el
  Contacto + guarda la Conversación. Pensado para migrar la cartera vieja de clientes al
  sistema nuevo.
- **Fix de infraestructura**: el pool de Postgres estaba configurado con el default de `pg`
  (hasta 10 conexiones por instancia), que agotaba el límite de conexiones de Supabase bajo
  ráfagas de tráfico en funciones serverless — se limitó a 1 conexión por instancia.
- **Fix de matching de teléfonos**: WhatsApp entrega números en formato internacional completo
  mientras el cliente los tipea en formato local — se pasó a comparar por sufijo de 8 dígitos
  en vez de exigir coincidencia exacta.

---

## 5. Qué falta / pendientes

### Setup manual pendiente (acciones que solo puede hacer Brunella, no el código)
- Completar la verificación de negocio de Meta si hace falta para levantar límites de mensajería.
- **Plantilla de mensaje aprobada por Meta** — necesaria para el envío masivo de seguimiento a
  la cartera migrada de WhatsApp (ver Roadmap). Sin esto, no se le puede escribir primero a
  alguien que nunca le escribió al número nuevo.
- Instalar Meta Business Suite (app o web) si Brunella quiere poder responder manualmente desde
  el número de WhatsApp Business — la app común de WhatsApp Business ya no funciona con ese
  número una vez migrado a la Cloud API.

### Limitaciones conocidas (decisiones de diseño, no bugs)
- **Sin integración en vivo con Tokko, Zonaprop ni Adinco** — el matching es solo contra el
  portfolio propio cargado en el CRM. La interfaz `PropertySource` está pensada para poder
  sumar estas fuentes sin rediseñar el motor, pero depende de que esas plataformas den API keys
  y se confirme qué permiten hacer.
- **Sin rate limiting** en el formulario público.
- **Sin `answerCallbackQuery`** en el botón de Telegram — funciona, pero el ícono de "cargando"
  puede quedar unos segundos de más.
- **`leads_pendientes` no expira** — los leads que nunca completan el formulario quedan
  guardados indefinidamente.
- **Sin conversión de moneda** en el matching — si la búsqueda está en USD y la propiedad en
  ARS, esa propiedad no se descarta pero tampoco se evalúa el criterio de precio.
- El importador de conversaciones crea Contacto + Conversación, pero **no arma automáticamente
  una Búsqueda estructurada** — es un resumen hecho por IA y se prefirió no inventar criterios
  de búsqueda sin que Brunella los revise.

---

## 6. Roadmap — qué queremos abarcar

En orden de conversación reciente, no necesariamente de prioridad definitiva (a confirmar con
Brunella):

1. **Envío masivo de seguimiento a la cartera migrada** — una vez que exista la plantilla de
   Meta aprobada, mandarle automáticamente a cada contacto importado un mensaje derivándolo al
   formulario nuevo, para que retome su búsqueda ahí. El código de importación (parte 1) ya está
   listo; falta la parte de envío (parte 2), bloqueada por la plantilla.
2. **Bot de preguntas y resúmenes por Telegram** — que Brunella le pueda preguntar al bot en
   texto libre ("¿cuántos clientes buscan depto en Nueva Córdoba?", "hacé un resumen de esta
   semana") y reciba una respuesta armada consultando la base real. Reutilizaría el mismo motor
   de Groq ya integrado. Pausado a pedido de Brunella para no sobrecargar el bot mientras se
   valida el importador de WhatsApp.
3. **Auto-creación de Búsqueda desde conversaciones importadas** — si el importador demuestra
   ser confiable extrayendo zona/presupuesto/tipo, sumar la creación automática de la Búsqueda
   (hoy solo crea Contacto + resumen).
4. **Integración en vivo con portales** (Tokko/Adinco/Zonaprop) — depende enteramente de que
   Brunella consiga acceso a esas APIs; el motor de matching ya está diseñado para no requerir
   un rediseño cuando llegue el momento.
5. **Fase 3 (mencionada en el README, no iniciada)** — panel de métricas de redes (Meta
   Business) para uso propio de Brunella.

---

## 7. Referencias

- Spec Fase 1: `docs/superpowers/specs/2026-07-14-segundo-cerebro-crm-design.md`
- Plan Fase 1: `docs/superpowers/plans/2026-07-14-segundo-cerebro-fase1.md`
- Spec Fase 2: `docs/superpowers/specs/2026-07-15-fase2-intake-clientes-design.md`
- Plan Fase 2 (18 tareas): `docs/superpowers/plans/2026-07-15-fase2-intake-clientes.md`
- Historial tarea por tarea de Fase 2: `.superpowers/sdd/progress.md`
- Guía de uso para Brunella (explicación en criollo + apéndice técnico):
  `docs/superpowers/GUIA-BRUNELLA.md`
- Setup de variables de entorno y configuración de Meta: `README.md`
