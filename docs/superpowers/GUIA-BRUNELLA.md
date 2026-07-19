# Guía del Segundo Cerebro — Cómo funciona todo

Esta guía tiene dos partes. La primera es para vos, Brunella: cómo usar el sistema día a día,
sin tecnicismos. La segunda es técnica, para quien mantenga el sistema en el futuro (vos misma
si contratás a alguien, o quien retome esto más adelante).

---

## Parte A — Cómo funciona, en criollo

### 1. Cargar una interacción con un cliente (esto ya lo hacías)

Le mandás una nota de voz a tu bot de Telegram contando lo que pasó ("Hablé con María, busca
un depto de 2 dormitorios en Nueva Córdoba hasta 90 mil dólares..."). El bot:

1. Transcribe el audio.
2. Extrae los datos importantes (nombre, qué busca, presupuesto, etc.).
3. Busca si ese contacto ya existe en el CRM (por nombre, sin importar tildes ni mayúsculas) y
   lo actualiza, o lo crea si es nuevo.
4. Te contesta por el mismo Telegram confirmando qué guardó.

Vos no tenés que hacer nada más que hablar. Si el bot no te entiende algo o falta un dato, te
lo va a decir en la respuesta.

**Importante:** el bot solo procesa notas de voz que vengan de tu chat de Telegram. Cualquier
otro chat que le escriba es ignorado — no es un asistente público.

### 2. Cómo llega ahora un cliente nuevo por Instagram o Facebook

Esto es lo nuevo. Antes, cuando alguien te escribía por un anuncio, tenías que preguntarle todo
a mano por el chat. Ahora:

1. Un lead te escribe por Instagram o Messenger (por ejemplo, respondiendo a un anuncio).
2. El sistema le contesta automáticamente con un link a un formulario propio (no es Instagram
   ni Facebook — es una página de esta misma app).
3. El lead completa el formulario desde el celular: si es comprador/inquilino, cuenta qué busca
   (zona, presupuesto, dormitorios, tipo de propiedad); si es propietario, carga los datos de
   su propiedad para vender o alquilar.
4. Al enviar el formulario, el sistema:
   - Crea (o actualiza, si ya existe con ese WhatsApp) el Contacto en el CRM.
   - Crea la Búsqueda o la Propiedad, según corresponda.
   - Si es comprador, compara automáticamente lo que pide contra tus propiedades activas y arma
     una lista de las que matchean, con el motivo de cada match.
   - Te manda un mensaje de Telegram con esa lista (fotos + por qué cada propiedad le sirve) y
     un botón que dice **"Aprobar y enviar"**.
5. Al mismo tiempo, a el/la cliente se le pide que confirme mandando un WhatsApp tuyo (un botón
   con el mensaje ya escrito, solo tiene que tocar "enviar"). Esto es necesario por una regla de
   WhatsApp: un negocio no puede escribirle primero a alguien que nunca le escribió. Por eso el
   primer mensaje lo manda el cliente, no vos.
6. Vos revisás el mensaje de Telegram y tocás **"Aprobar y enviar"** cuando te parezca bien.
7. Apenas el cliente manda su WhatsApp de confirmación (antes o después de que vos apruebes, no
   importa el orden), el sistema le manda automáticamente las fotos de las propiedades que
   matchean y el motivo de cada una, por WhatsApp.

**Lo único que tenés que hacer vos en todo este flujo:** revisar el Telegram como siempre y
tocar "Aprobar y enviar" cuando corresponda. Todo lo demás (crear el contacto, buscar
coincidencias, armar el mensaje, mandarlo por WhatsApp) es automático.

Si un propietario carga su propiedad para vender/alquilar en vez de buscar algo, el flujo es
más corto: se crea la Propiedad, te llega un aviso por Telegram para que la revises, y ahí
termina (no hay matching ni documento para propietarios).

Si ningún cliente confirma por WhatsApp, el contacto y la búsqueda quedan guardados igual — los
ves en el dashboard como cualquier otro — pero el envío automático queda pendiente hasta que
confirme (o lo contactás vos por otra vía).

### 3. El código de propiedad y los anuncios de Meta Ads

Cada propiedad en el CRM puede tener un "código" corto (por ejemplo `COD-A1B2`), visible en su
ficha (con un botón "Generar código" si todavía no tiene uno).

Cuando armás un anuncio de Instagram o Facebook (tipo "Click to Messenger/Instagram") para
promocionar **esa propiedad puntual**, pegás ese código en el campo `ref` de la configuración
del anuncio (Meta Ads Manager).

¿Para qué sirve? Cuando alguien le escribe a tu página por ese anuncio en particular, Meta te
manda ese código junto con el primer mensaje. El sistema lo guarda, y si esa persona completa
el formulario después, automáticamente sabe que preguntó por esa propiedad específica — queda
registrado como una "Consulta" vinculada a esa ficha en el CRM, sin que vos tengas que
preguntarle "¿por cuál anuncio me escribiste?".

Si alguien te escribe orgánicamente (no por un anuncio, o vos todavía no cargaste el código en
ese anuncio), el contacto se crea igual, simplemente sin esa vinculación a una propiedad
puntual.

### 4. El dashboard

Es la parte que ya conocías de la Fase 1: entrás con usuario y contraseña, y ves listas de
Contactos y Propiedades. Cada ficha tiene un botón con un lápiz (ícono de edición) que te deja
corregir cualquier dato a mano — útil para completar cosas que el formulario del cliente no
pide (por ejemplo, fotos de una propiedad que cargó un propietario, o ajustar la etapa de un
contacto).

Los leads que entran por el formulario público aparecen en el dashboard igual que los que
cargás vos por voz — no hay una sección separada, es el mismo CRM.

### 5. Qué NO pasa automáticamente hoy

Para que no haya sorpresas:

- **No hay integración en vivo con Tokko, Zonaprop ni Adinco.** El sistema compara únicamente
  contra tu propio portfolio de propiedades cargadas en este CRM. Si un cliente busca algo que
  no tenés vos, no le va a aparecer ninguna propiedad de otro lado.
- **No se le puede escribir primero a un cliente por WhatsApp** salvo que use una plantilla
  pre-aprobada por Meta (que este sistema no usa todavía). Por eso el flujo depende de que el
  cliente mande el primer mensaje de confirmación — no hay forma de saltarse ese paso.
- **El número de WhatsApp de negocio ya no funciona desde la app común de WhatsApp Business en
  el celular.** Al conectarlo a la API de Meta (Cloud API), pasa a manejarse solo por acá (el
  sistema automático) o desde Meta Business Suite si necesitás contestar algo a mano. Ya no vas
  a poder abrir WhatsApp Business en tu teléfono con ese número para chatear como antes.
- El botón "Aprobar y enviar" de Telegram no muestra una confirmación visual inmediata en el
  mensaje (el botoncito de "cargando" de Telegram) — sí funciona y sí manda el mensaje, pero
  Telegram puede mostrar un reloj de arena unos segundos de más. No es un error.
- Los leads de Instagram/Facebook que nunca completan el formulario quedan guardados
  indefinidamente esperando (no se borran solos todavía).

---

## Parte B — Arquitectura técnica

### Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind.
- **Postgres vía `pg` directo** (sin ORM), hosteado en **Supabase** (solo se usa la base de
  datos de Supabase — no su Auth ni su Storage).
- **Groq** para transcripción de audio (Whisper) y extracción de datos estructurados (LLM).
- **Telegram Bot API** para la carga por voz y las notificaciones/aprobaciones.
- **Meta Graph API**: Messenger Platform + Instagram Messaging API (DMs) y WhatsApp Cloud API
  (confirmación y envío del documento de compatibilidad).
- **Vercel** para hosting y el cron diario de recordatorios.
- **Vitest** para tests (166 tests / 36 archivos al momento de esta guía); `pg-mem` emula
  Postgres en los tests sin necesitar Docker ni cuenta real.

### Mapa de archivos

| Ruta | Qué es |
|---|---|
| `src/lib/domain/*` | Capa de datos: un módulo por tabla (`contactos.ts`, `propiedades.ts`, `busquedas.ts`, `consultas.ts`, `leadsPendientes.ts`, etc.), cada uno con las queries específicas de esa entidad sobre `pg`. `factory.ts` decide si usar Postgres real (si hay `DATABASE_URL`) o un fallback en memoria (para desarrollo local sin cuenta). |
| `src/lib/bot/*` | Lógica de negocio del bot: `propertyMatching.ts` (motor de matching contra el portfolio propio, interfaz `PropertySource` reemplazable), `compatibilityDocument.ts` (arma el mensaje de Telegram con botón "Aprobar y enviar" y el envío por WhatsApp), `enviarDocumentoAprobado.ts` (orquesta: busca la búsqueda, el contacto, corre el matching, y manda por WhatsApp), `processVoiceNote.ts` (flujo de la nota de voz de Fase 1). |
| `src/lib/telegram/*` | Cliente HTTP del Bot API de Telegram (`sendMessage`, `sendMediaGroup`, descarga de archivos, verificación del secret del webhook). |
| `src/lib/meta/*` | Cliente y verificación de firma/challenge para Messenger e Instagram (`webhookVerification.ts`, `client.ts`). |
| `src/lib/whatsapp/*` | Cliente de WhatsApp Cloud API (`sendWhatsAppText`, `sendWhatsAppImage`) — reexporta la verificación de Meta, ya que WhatsApp comparte la misma app y firma. |
| `src/app/api/telegram/webhook/route.ts` | Recibe notas de voz Y los `callback_query` del botón "Aprobar y enviar". |
| `src/app/api/meta/webhook/route.ts` | Recibe DMs de Messenger/Instagram, guarda el lead pendiente con su token de atribución, y contesta con el link al formulario. |
| `src/app/api/whatsapp/webhook/route.ts` | Recibe el mensaje de confirmación del cliente, marca `whatsapp_confirmado`, y dispara el envío si ya estaba aprobado. |
| `src/app/formulario/*` | La UI pública: `page.tsx` (selector comprador/propietario + formularios), `actions.ts` (Server Actions que procesan el submit, corren el matching y notifican por Telegram), `confirmar/page.tsx` (pantalla con el botón `wa.me` de confirmación). |
| `src/proxy.ts` | Middleware de Basic Auth del dashboard. `PUBLIC_PATHS` excluye `/formulario`, `/api/meta/webhook` y `/api/whatsapp/webhook` (además de las rutas de Fase 1) para que no queden bloqueadas por la autenticación del dashboard. |

### Migraciones de base de datos

Tres migraciones en `supabase/migrations/`, todas aditivas (no rompen datos existentes):

1. **`0001_schema.sql`** — Schema original de Fase 1: `contactos`, `propiedades`, `busquedas`,
   `conversaciones`, `muestras`, `consultas`, `ofertas`.
2. **`0002_add_imagenes_propiedades.sql`** — Agrega `imagenes` (texto, una URL por línea) a
   `propiedades`.
3. **`0003_fase2_intake.sql`** — Todo lo de Fase 2: `moneda`, `codigo` y `dormitorios` en
   `propiedades`; `presupuesto_min`/`presupuesto_max`/`moneda`/`documento_aprobado`/
   `documento_enviado` en `busquedas` (reemplazando el viejo `presupuesto` único);
   `whatsapp_confirmado` en `contactos`; `'formulario_cliente'` como valor válido de `origen` en
   `consultas`; `'PH'` como tipo de propiedad válido; y la tabla nueva `leads_pendientes`.

### Variables de entorno (del `README.md`)

| Variable | Qué rompe si falta |
|---|---|
| `DATABASE_URL` | Sin esto, la app corre con datos de ejemplo en memoria (útil para desarrollo, pero no persiste nada real). |
| `TELEGRAM_BOT_TOKEN` | El bot no puede mandar ni recibir mensajes. |
| `TELEGRAM_WEBHOOK_SECRET` | El webhook de Telegram rechaza todo (401) si no coincide. |
| `TELEGRAM_ADMIN_CHAT_ID` | Sin esto, **todas** las notas de voz se ignoran silenciosamente — es la única autorización del bot. |
| `GROQ_API_KEY` | No hay transcripción ni extracción de datos de las notas de voz. |
| `CRON_SECRET` | El cron diario de recordatorios de Vercel no se autentica. |
| `DASHBOARD_USER` / `DASHBOARD_PASSWORD` | Sin esto, el Basic Auth del dashboard queda con credenciales vacías. |
| `META_APP_SECRET` | Los webhooks de Meta (Messenger/Instagram/WhatsApp) rechazan todas las llamadas por firma inválida. |
| `META_VERIFY_TOKEN` | Falla la verificación inicial de los tres webhooks al configurarlos en Meta for Developers. |
| `MESSENGER_PAGE_ACCESS_TOKEN` | No se pueden mandar respuestas por Messenger. |
| `INSTAGRAM_ACCESS_TOKEN` | No se pueden mandar respuestas por Instagram DM. |
| `WHATSAPP_ACCESS_TOKEN` | No se puede mandar nada por WhatsApp Cloud API. |
| `WHATSAPP_PHONE_NUMBER_ID` | Igual que el anterior — sin esto no hay a qué número mandar. |
| `WHATSAPP_BUSINESS_NUMBER` | El link `wa.me` de confirmación queda mal armado (sin número de destino). |
| `APP_BASE_URL` | El link al formulario que se manda por Messenger/Instagram queda con URL vacía o incorrecta. |

### Limitaciones conocidas / diferidas a propósito

- **Sin rate limiting** en el formulario público (`src/app/formulario/actions.ts`) — cualquiera
  con el link puede enviarlo repetidas veces. No es crítico hoy por el volumen esperado, pero
  es lo primero a agregar si se abusa.
- **Sin `answerCallbackQuery`** en el webhook de Telegram (`src/app/api/telegram/webhook/route.ts`)
  tras procesar el botón "Aprobar y enviar" — el botón funciona (la acción se ejecuta), pero
  Telegram puede mostrar el ícono de carga unos segundos más de lo necesario en la UI del
  cliente de Telegram.
- **`leads_pendientes` no expira.** No hay ningún cron ni filtro por fecha que limpie o ignore
  leads viejos que nunca completaron el formulario (el diseño original preveía un filtro de 30
  días, pero no está implementado en `src/lib/domain/leadsPendientes.ts` todavía).
- **Sin integración en vivo con portales externos** (Tokko/Adinco/Zonaprop). El motor de
  matching (`src/lib/bot/propertyMatching.ts`) está diseñado detrás de una interfaz
  `PropertySource` intercambiable para poder sumar esas fuentes el día que haya API keys
  confirmadas, sin rediseñar el resto del flujo.
- **Sin conversión de moneda automática** en el matching: si la búsqueda está en USD y la
  propiedad en ARS (o viceversa), esa propiedad no se descarta, pero tampoco se evalúa el
  criterio de precio para ella.

### Dónde está el diseño completo

- Fase 1: `docs/superpowers/specs/2026-07-14-segundo-cerebro-crm-design.md`
- Fase 2: `docs/superpowers/specs/2026-07-15-fase2-intake-clientes-design.md`
- Historial de implementación de Fase 2, tarea por tarea: `.superpowers/sdd/progress.md`
