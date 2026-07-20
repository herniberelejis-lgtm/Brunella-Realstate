# Segundo Cerebro — Brunella Real Estate

CRM interno: bot de Telegram por nota de voz + dashboard web. Ver
`docs/superpowers/specs/2026-07-14-segundo-cerebro-crm-design.md` para el diseño completo y
`docs/superpowers/plans/2026-07-14-segundo-cerebro-fase1.md` para el plan de implementación.

## Desarrollo local (no requiere ninguna cuenta)

```bash
npm install
npm test
npm run dev
```

Sin `DATABASE_URL` configurado, la app corre con datos de ejemplo en memoria — anda a
`http://localhost:3000/contactos` y `http://localhost:3000/propiedades` para verla funcionando.

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Connection string de Postgres (Supabase → Project Settings → Database → Connection string, "URI") |
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram (desde @BotFather) |
| `TELEGRAM_WEBHOOK_SECRET` | String arbitrario para autenticar el webhook de Telegram |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat ID de Brunella en Telegram (autorización única para procesar notas de voz) |
| `GROQ_API_KEY` | API Key de Groq (console.groq.com → API Keys) |
| `CRON_SECRET` | String aleatorio para autenticar los crons de Vercel |
| `DASHBOARD_USER` | Usuario para basic-auth del dashboard (ej. `brunella`) |
| `DASHBOARD_PASSWORD` | Contraseña para basic-auth del dashboard |
| `META_APP_SECRET` | App Secret de la app de Meta for Developers (Messenger + Instagram + WhatsApp comparten la misma app) |
| `META_VERIFY_TOKEN` | String arbitrario elegido por vos, usado para verificar los tres webhooks de Meta al configurarlos |
| `MESSENGER_PAGE_ACCESS_TOKEN` | Token de acceso de la Página de Facebook conectada a la app de Meta |
| `INSTAGRAM_ACCESS_TOKEN` | Token de acceso de la cuenta de Instagram conectada a la app de Meta |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso del número de WhatsApp Business (Cloud API) |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono de WhatsApp Business (Graph API, no el número en sí) |
| `WHATSAPP_BUSINESS_NUMBER` | El número de WhatsApp de Brunella en formato internacional sin `+` (ej. `5493511234567`), usado para armar el link `wa.me` |
| `WHATSAPP_TEMPLATE_SEGUIMIENTO` | (Opcional) Nombre de la plantilla aprobada por Meta para el envío masivo de seguimiento a la cartera migrada. Sin esta variable, el comando `seguimiento` del bot corre solo en modo previsualización (no envía nada). |
| `WHATSAPP_TEMPLATE_LANG` | (Opcional) Código de idioma de la plantilla de seguimiento (default `es_AR`). Tiene que coincidir con el idioma con el que aprobaste la plantilla en Meta. |
| `APP_BASE_URL` | URL pública de la app deployada (ej. `https://brunella-realstate.vercel.app`), usada para armar el link del formulario que se manda por Messenger/Instagram |

## Puesta en producción — pasos manuales pendientes

1. **Supabase (base de datos gratis)**
   - Crear cuenta en supabase.com y un proyecto nuevo.
   - Project Settings → Database → Connection string → copiar la "URI" (modo *Session*, puerto
     5432) → pegarla como `DATABASE_URL`.
   - Ejecutar `supabase/migrations/0001_schema.sql` contra ese proyecto (SQL Editor de Supabase,
     pegar y correr el archivo entero).

2. **Groq (transcripción + IA, capa gratuita)**
   - Crear cuenta en console.groq.com → API Keys → generar una → pegarla como `GROQ_API_KEY`.

3. **Telegram (bot de carga por voz)**
   - Desde la cuenta de Telegram de Brunella, hablarle a `@BotFather` → `/newbot` → seguir los
     pasos → copiar el token → pegarlo como `TELEGRAM_BOT_TOKEN`.
   - Generar cualquier string al azar como `TELEGRAM_WEBHOOK_SECRET` (ej. con
     `openssl rand -hex 20`).
   - Obtener el `chat_id` de Brunella (mandarle un mensaje al bot y consultar
     `https://api.telegram.org/bot<TOKEN>/getUpdates`) → pegarlo como `TELEGRAM_ADMIN_CHAT_ID`.
     **Importante:** sin esta variable, el webhook ignora silenciosamente cualquier nota de
     voz (es la única autorización — cualquier otro chat_id se descarta sin procesar).
   - Una vez desplegado en Vercel (paso 5), registrar el webhook:
     ```bash
     curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
       -d "url=https://<tu-dominio>.vercel.app/api/telegram/webhook" \
       -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
     ```

4. **Autenticación del dashboard**
   - Elegir un usuario/contraseña y setearlos como `DASHBOARD_USER` / `DASHBOARD_PASSWORD`.

5. **Vercel (hosting gratis + cron diario)**
   - Crear cuenta en vercel.com, importar este repo.
   - Cargar todas las variables de entorno de `.env.example` en Project Settings → Environment
     Variables.
   - Generar un string al azar como `CRON_SECRET` (Vercel lo agrega automáticamente como
     `Authorization: Bearer <CRON_SECRET>` en las llamadas a rutas de cron — confirmar que
     coincide con el valor cargado).
   - Deploy.

6. **Excel histórico de propiedades**
   - Conseguir el archivo real de Brunella.
   - Confirmar los nombres de columna reales contra los que asume
     `scripts/import-excel.ts` (`fecha`, `direccion`, `tipo`, `descripcion`, `precio`,
     `consultas`, `visitas`) y ajustar el mapeo si difieren.
   - Correr: `npm run import:excel -- /ruta/al/archivo.xlsx`

## Fase 2 — Configurar Messenger, Instagram y WhatsApp

Esto requiere una única app en Meta for Developers, conectada a la Página de Facebook, la
cuenta de Instagram y el número de WhatsApp Business de Brunella. Una vez creada esa app:

1. En **Webhooks**, agregá dos suscripciones apuntando a esta app:
   - `https://<tu-dominio>/api/meta/webhook` para Messenger e Instagram (eventos
     `messages`, `messaging_referrals`)
   - `https://<tu-dominio>/api/whatsapp/webhook` para WhatsApp (eventos `messages`)
   - En ambas, usá el mismo valor de `META_VERIFY_TOKEN` que configuraste como variable de
     entorno.
2. Copiá el **App Secret** de la app a `META_APP_SECRET`.
3. Generá un token de acceso de la Página y pegalo en `MESSENGER_PAGE_ACCESS_TOKEN`.
4. Generá un token de acceso de Instagram (misma app, cuenta de Instagram conectada a la
   Página) y pegalo en `INSTAGRAM_ACCESS_TOKEN`.
5. En el producto WhatsApp de la misma app, agregá el número de negocio, copiá su
   `Phone Number ID` a `WHATSAPP_PHONE_NUMBER_ID`, generá un token de acceso permanente y
   pegalo en `WHATSAPP_ACCESS_TOKEN`.
6. Al armar un anuncio de Click-to-Messenger o Click-to-Instagram en Meta Ads Manager para
   promocionar una propiedad puntual, pegá el **código corto de esa propiedad** (visible en su
   ficha en el CRM, botón "Generar código" si todavía no tiene uno) en el campo `ref` del
   anuncio.

## Envío masivo de seguimiento — aprobar la plantilla en Meta

El comando `seguimiento` del bot de Telegram le manda a la cartera migrada de WhatsApp un
mensaje derivándolos al formulario nuevo. Como se les escribe **primero** (fuera de la ventana
de 24 h de atención al cliente), Meta exige una **plantilla de mensaje (message template)
pre-aprobada**. Sin ella, el comando solo previsualiza. Pasos para aprobarla:

1. Entrá a **WhatsApp Manager** (business.facebook.com → menú → *WhatsApp Manager*) o a
   **Meta Business Suite → WhatsApp → Plantillas de mensajes**, sobre la misma cuenta de
   WhatsApp Business (WABA) del número que ya conectaste.
2. Tocá **Crear plantilla**.
   - **Categoría:** elegí **Marketing** (un mensaje de reactivación/seguimiento es marketing;
     *Utility* es solo para transaccionales tipo confirmaciones de pedido). Ojo: las de
     Marketing pueden tener costo por conversación y el cliente puede optar por no recibirlas.
   - **Nombre:** solo minúsculas, números y guión bajo, ej. `seguimiento_migracion`. **Este es
     el valor exacto que va en la variable `WHATSAPP_TEMPLATE_SEGUIMIENTO`.**
   - **Idioma:** elegí **Español** (o *Español (ARG)*). El código que elijas tiene que coincidir
     con `WHATSAPP_TEMPLATE_LANG` (default `es_AR`; si elegís "Español" a secas suele ser `es`).
3. **Cuerpo del mensaje.** El sistema rellena la variable `{{1}}` con el nombre del cliente.
   Escribí algo como:

   > Hola {{1}}, soy Brunella (Grupo Banker). Estoy pasando mi seguimiento a un sistema nuevo
   > para ayudarte mejor con tu búsqueda. Si querés que retomemos, completá este formulario y en
   > breve te contacto: https://brunella-realstate.vercel.app/formulario

   - Meta te va a pedir un **ejemplo** para el `{{1}}` (ej. `Juan`).
   - El link podés dejarlo como texto en el cuerpo (como arriba), o —más prolijo— agregar un
     **Botón → Visitar sitio web** con esa URL. Cualquiera de las dos formas funciona con el
     código actual (el código solo manda el nombre en `{{1}}`).
   - Evitá texto demasiado promocional o URLs acortadas raras: son motivo común de rechazo.
4. **Enviá a revisión.** Meta suele responder en minutos a unas horas. Si queda **Rejected**,
   te dice el motivo (normalmente el texto); ajustás y reenviás.
5. Cuando el estado sea **Approved**, cargá en las variables de entorno de Vercel:
   - `WHATSAPP_TEMPLATE_SEGUIMIENTO` = el nombre exacto (ej. `seguimiento_migracion`)
   - `WHATSAPP_TEMPLATE_LANG` = el código de idioma (ej. `es_AR` o `es`)
   Volvé a deployar para que tomen efecto.
6. **Probá primero con vos:** importá una conversación de prueba con **tu propio** número, corré
   `seguimiento`, revisá la previsualización y recién ahí tocá **"Enviar de verdad"** para
   confirmar que te llega el mensaje antes de disparárselo a toda la cartera.

> Nota: para mandar a muchos números por primera vez puede aplicar el **límite de mensajería**
> de tu número (por defecto arranca en 250 conversaciones/día y sube solo con buena reputación).
> Si tenés una cartera grande, puede que los envíos se escalonen en varios días.

## Stack técnico

Next.js 16 (App Router) + TypeScript + Tailwind, Postgres vía `pg` directo (hosteado en
Supabase, sin usar su SDK/Auth/Storage), Groq para transcripción y extracción de IA, Telegram
Bot API, Vercel para hosting + Cron. Tests con Vitest; `pg-mem` emula Postgres en los tests
sin necesitar Docker ni una cuenta real.

## Fases futuras (no incluidas acá)

- **Fase 3:** panel de métricas de redes (Meta Business) para uso propio de Brunella — no hay
  conector MCP disponible hoy; requiere una app de Meta for Developers y manejo de tokens.
- Integración en vivo con Tokko/Adinco (búsqueda automática en esas plataformas) — depende de
  que Brunella consiga API keys y se confirme qué permiten hacer esas APIs; el motor de
  matching (`src/lib/bot/propertyMatching.ts`) ya está diseñado con una fuente de datos
  intercambiable para poder sumarlo sin rediseñar nada. Ver
  `docs/superpowers/specs/2026-07-15-fase2-intake-clientes-design.md`.
