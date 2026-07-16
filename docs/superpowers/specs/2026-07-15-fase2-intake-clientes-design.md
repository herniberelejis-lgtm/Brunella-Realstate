# Fase 2 — Intake Automatizado de Clientes por Redes/WhatsApp — Diseño

## Contexto

Este documento continúa
[2026-07-14-segundo-cerebro-crm-design.md](2026-07-14-segundo-cerebro-crm-design.md) (Fase 1),
que ya está construido y en producción: registro de contactos, propiedades, conversaciones,
muestras, consultas, búsquedas y ofertas, cargados por Brunella vía nota de voz a un bot de
Telegram, con un dashboard web para consultar y editar todo.

Fase 1 depende enteramente de que Brunella cargue los datos a mano (por voz). Esta Fase 2
ataca el otro lado: los leads que le escriben por publicidad en Instagram y Facebook hoy no
dejan ningún dato estructurado — ella tiene que preguntarles todo por chat, a mano, antes de
poder cargarlos en el CRM.

Corrige el sketch original de "Fase 2" del documento de Fase 1 (que imaginaba un bot buscando
en portales externos): tras conversarlo, el foco real es la **captura de datos del lado del
cliente** y la comparación contra el portfolio propio, no el scraping de portales de terceros.

## Alcance de este documento

Cubre:

1. Auto-respuesta a mensajes nuevos de Instagram/Facebook (Messenger + Instagram Messaging
   API) con el link a un formulario propio.
2. Formulario web (dentro de esta misma app) donde el lead carga su búsqueda (si es
   comprador/inquilino) o los datos de su propiedad (si es propietario que quiere vender o
   alquilar).
3. Atribución: saber por qué propiedad puntual (anuncio) se comunicó cada lead, cuando ese
   dato esté disponible.
4. Confirmación del contacto vía WhatsApp (Cloud API), iniciada por el cliente.
5. Motor de matching contra el portfolio propio (`propiedades` activas) y generación del
   "documento de compatibilidad" (mensaje con las propiedades recomendadas y el porqué de
   cada una).
6. Flujo de aprobación: Brunella revisa por Telegram y aprueba el envío al cliente por
   WhatsApp.

Explícitamente **fuera de alcance** de este documento:

- Integración en vivo con Tokko/Adinco/Zonaprop para traer resultados de búsqueda reales de
  esas plataformas. Ninguna de las tres tiene API pública documentada; Adinco y Tokko son en
  sí mismos software de CRM/gestión para inmobiliarias (no buscadores de cara al público), y
  Zonaprop es un portal público sin API abierta — conectarse ahí implicaría scraping, frágil y
  fuera de sus términos de servicio. Brunella va a conseguir API keys de Adinco/Tokko a
  futuro; el motor de matching se diseña con una interfaz de "fuente de propiedades"
  intercambiable (ver Motor de matching) para poder sumar esas plataformas como fuente
  adicional el día que se sepa qué ofrecen sus APIs, sin rediseñar nada.
- Fase 3 (panel de redes / métricas de Meta Ads) — sigue fuera de alcance, sin cambios respecto
  a lo ya documentado en la spec de Fase 1.
- El formulario "Buscá tu propiedad" / "Publicá tu propiedad" ya existente en la landing page
  externa (Lovable) no se reutiliza — ese sitio no persiste a esta base de datos ni tiene
  forma de generar los tokens de atribución que este flujo necesita. El formulario de esta
  fase se construye dentro de esta misma app Next.js, con el mismo look & feel del dashboard.

## Arquitectura general

```
Lead ve anuncio (Instagram/Facebook) → escribe por Messenger/Instagram DM
        ↓ (webhook)
Bot responde con link al formulario (+ token de atribución invisible en la URL)
        ↓
Lead completa el formulario web (comprador o propietario)
        ↓
Se crea/activa el Contacto (+ Búsqueda o Propiedad) en el CRM
        ↓
Página de confirmación: botón "Confirmar por WhatsApp" (wa.me con mensaje precargado)
        ↓ (el cliente lo manda él mismo → inicia la conversación de WhatsApp)
Webhook de WhatsApp recibe el mensaje → marca el contacto como confirmado
        ↓
Motor de matching busca en `propiedades` activas (solo si es comprador/inquilino)
        ↓
Documento de compatibilidad → Telegram (Brunella revisa) → botón "Aprobar y enviar"
        ↓
Envío por WhatsApp Cloud API al cliente
```

Si el lead es propietario (quiere vender/alquilar), el flujo se corta después de crear la
Propiedad: aviso a Brunella por Telegram para que la revise, sin matching ni documento.

## Modelo de datos

Cambios sobre el schema de Fase 1 (todas migraciones aditivas, sin romper datos existentes):

### `propiedades`
- Agregar `moneda`: `ARS` | `USD` (nullable — obligatorio de ahí en más para propiedades
  nuevas, pero nullable para no romper filas migradas del Excel).
- Agregar `codigo`: texto corto único (ej. `COD-A3F9`), generado automáticamente al crear la
  propiedad (o bajo demanda desde la ficha, para propiedades ya existentes que no tienen uno).
  Se pega como parámetro `ref` en los anuncios de Meta Ads que promocionan esa propiedad
  puntual.
- Agregar `dormitorios` (int, nullable) — no existía en Fase 1 (no hacía falta hasta ahora);
  necesario para que el motor de matching pueda comparar contra el mínimo pedido en la
  Búsqueda.
- Sumar `'PH'` a los valores válidos de `tipo_propiedad` (ya usado en Zonaprop como categoría
  separada de Departamento/Casa).

### `busquedas`
- Reemplazar `presupuesto` (un solo número) por `presupuesto_min` y `presupuesto_max`
  (ambos nullable — el lead puede dar solo uno de los dos).
- Agregar `moneda`: `ARS` | `USD`.
- Sumar `'PH'` a los valores válidos de `tipo_propiedad`, igual que en `propiedades`.
- Agregar `documento_aprobado` (bool, default `false`) y `documento_enviado` (bool, default
  `false`) — soportan el flujo de "aprobar y enviar": si Brunella aprueba antes de que el
  cliente confirme por WhatsApp, queda marcado como aprobado-pendiente y se envía solo una vez
  llegue la confirmación (`documento_enviado` evita reenviarlo dos veces).

### `contactos`
- Agregar `whatsapp_confirmado` (bool, default `false`) — se marca `true` cuando llega el
  mensaje de confirmación iniciado por el cliente; habilita el envío del documento de
  compatibilidad sin las restricciones de mensajes iniciados por el negocio.

### `consultas`
- Sumar `'formulario_cliente'` a los valores válidos de `origen` (hasta ahora
  `'nota_de_voz'` | `'manual'`), para diferenciar las consultas creadas automáticamente por
  este flujo.

### Tabla nueva: `leads_pendientes`
Relaciona una conversación de Messenger/Instagram (que todavía no completó el formulario) con
el dato de atribución, hasta que se use o expire.

```sql
create table leads_pendientes (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  canal text not null check (canal in ('Instagram','Facebook')),
  psid text not null,                    -- id de usuario de Messenger/Instagram
  codigo_propiedad text,                 -- del parámetro ref del anuncio, si vino
  usado boolean not null default false,
  created_at timestamptz not null default now()
);
```

Se limpia (o simplemente se ignora por antigüedad) después de 30 días sin usarse — no hace
falta un cron dedicado para esto en esta fase, un filtro por fecha alcanza.

## Formulario del cliente

Una sola página, con un primer paso "¿Qué estás buscando?" (Comprar/Alquilar una propiedad vs.
Publicar la mía) que decide qué campos mostrar. Mobile-first, mismo criterio de UI/UX que el
resto del dashboard (campos grandes, sin scroll horizontal, sin jerga técnica).

**Comprador/Inquilino** (crea `Contacto` + `Busqueda`):
- Nombre, WhatsApp
- Qué operación (Comprar / Alquilar / Alquiler temporario)
- Tipo de propiedad (Departamento / Casa / PH / Lote / Local-Oficina)
- Zona/barrio (texto libre)
- Presupuesto mínimo/máximo + moneda
- Dormitorios mínimos
- Otros requisitos (texto libre, opcional)

**Propietario** (crea `Contacto` + `Propiedad`):
- Nombre, WhatsApp
- Qué quiere hacer (Vender / Alquilar / Alquiler temporario) → guardado en `condiciones`
- Dirección, tipo de propiedad, precio + moneda, descripción
- Fotos (opcional en esta primera carga — puede completarlas después Brunella)

Sin campos que el cliente no pueda responder rápido desde el celular — nada de antigüedad,
ambientes exactos, ni checkboxes de amenities uno por uno. Eso puede pedirse a mano si hace
falta, vía las conversaciones de seguimiento normales del CRM.

## Atribución de publicación

1. Al crear/editar una propiedad, se genera automáticamente su `codigo` corto.
2. Brunella pega ese código en el campo `ref` al configurar el anuncio de Click-to-Messenger/
   Instagram en Meta Ads Manager (paso manual único, al crear el anuncio — no por cada
   mensaje).
3. El webhook de Messenger/Instagram recibe el primer mensaje del lead; si trae `referral.ref`
   (o `referral.ref` dentro de `ig_referral` en Instagram), lo guarda en `leads_pendientes`
   junto con el `psid` del lead.
4. El link del formulario que se le manda incluye el `token` de ese registro (invisible para
   el cliente — es parte de la URL, no un campo del formulario).
5. Al enviar el formulario, el backend busca el `token`, recupera el `codigo_propiedad` (si
   existe), resuelve la propiedad correspondiente y crea automáticamente una fila en
   `consultas` vinculando el nuevo contacto con esa propiedad (`canal` = Instagram/Facebook,
   `origen` = `formulario_cliente`).

**Casos sin atribución** (mensaje orgánico sin anuncio, o Brunella no cargó el `ref`): el
contacto y la búsqueda/propiedad se crean igual, simplemente sin la fila de `Consulta`
vinculada a una propiedad específica.

## Confirmación por WhatsApp

Tras enviar el formulario, la página de confirmación muestra un botón "Confirmar por
WhatsApp" — un link `wa.me` al número de negocio de Brunella con un mensaje corto precargado
(ej. *"Hola, completé el formulario de búsqueda - soy [nombre]"*). El cliente lo toca y lo
manda él mismo.

Esto es necesario porque WhatsApp Business Cloud API no permite que un negocio le escriba
primero a un número que nunca le escribió (sin usar una plantilla pre-aprobada por Meta) —
haciendo que el cliente inicie la conversación evita ese trámite y abre la ventana de 24 horas
en la que se le puede responder libremente.

El webhook de WhatsApp recibe ese mensaje, matchea el número de teléfono contra el `Contacto`
recién creado por el formulario, y lo marca como confirmado. Si el contacto no existe todavía
con ese número (mensaje llegó antes que el submit del formulario, carrera poco probable pero
posible), se guarda el mensaje y se reintenta el match cuando el formulario se complete.

## Motor de matching y documento de compatibilidad

Solo corre para Comprador/Inquilino. Contra las `propiedades` con `estado = 'Activa'`:

- **Tipo de propiedad**: debe coincidir con lo pedido en la Búsqueda.
- **Precio**: dentro del rango `presupuesto_min`/`presupuesto_max` (misma moneda; si las
  monedas no coinciden, no se descarta la propiedad pero no suma como criterio de precio —
  no hay conversión automática de USD/ARS en esta fase).
- **Zona**: comparación de texto sin tildes/mayúsculas (reutiliza `normalizeText()`, ya usado
  en el matching de contacto/propiedad del bot de notas de voz) entre la zona pedida y la
  dirección de la propiedad.
- **Dormitorios**: la propiedad debe tener al menos los dormitorios mínimos pedidos.

El motor de búsqueda de propiedades se implementa detrás de una interfaz
(`PropertySource.buscar(busqueda): Propiedad[]`) cuya única implementación hoy es
`PortfolioPropioSource` (consulta la tabla `propiedades`). El día que se confirmen las API
keys de Adinco/Tokko y qué permiten hacer, se puede sumar una segunda implementación sin
tocar el resto del motor.

**Razón del match**: texto armado por reglas (no generado por IA) a partir de qué criterios
matchearon — ej. *"Está dentro de tu presupuesto de USD 80.000-100.000 y tiene los 2
dormitorios que buscás en Nueva Córdoba"*. Se prioriza que sea predecible y confiable por
sobre que suene más "natural", dado que es contenido que se le manda a un cliente real sin
que Brunella lo reescriba antes.

**El documento**: no es un PDF — es un mensaje de Telegram con las fotos de cada propiedad
recomendada y su razón de match (mismo mecanismo ya usado para las confirmaciones del bot de
notas de voz). Incluye un botón inline **"Aprobar y enviar"**.

## Aprobación y envío

- Al tocar "Aprobar y enviar" en Telegram:
  - Si el contacto ya confirmó por WhatsApp, se envía de inmediato (mismas fotos + texto) por
    WhatsApp Cloud API.
  - Si todavía no confirmó, queda marcado como pendiente de envío y se manda automáticamente
    en cuanto llegue su confirmación por WhatsApp — sin que Brunella tenga que volver a tocar
    nada.
- Si no hay ninguna propiedad que matchee, el mensaje a Brunella lo aclara en vez de mandar un
  documento vacío al cliente ("Sin matches por ahora para esta búsqueda — quedó guardada,
  avisame cuando cargues algo que pueda servirle").

## Integraciones nuevas necesarias

Todas requieren cuentas/credenciales que solo Brunella (o el usuario) puede crear — se avisa
cuando llegue ese punto de la implementación, igual que con Supabase/Groq/Telegram en Fase 1:

| Integración | Para qué | Costo |
|---|---|---|
| Meta for Developers + Messenger Platform | Recibir/responder DMs de Facebook | Gratis |
| Instagram Messaging API (misma app de Meta) | Recibir/responder DMs de Instagram | Gratis |
| WhatsApp Cloud API (Meta, directo — no Twilio) | Confirmación y envío del documento | Gratis
hasta ~1000 conversaciones/mes, después centavos de USD por conversación |

## Manejo de errores y casos borde

- **Formulario incompleto o inválido**: se valida en el momento (mismo patrón de Zod ya usado
  en el resto de la app), sin dejar avanzar hasta que los campos obligatorios estén bien.
- **Lead escribe por Messenger/Instagram sin venir de un anuncio**: se le manda igual el link
  al formulario, simplemente sin atribución a una propiedad puntual.
- **Cliente nunca manda la confirmación por WhatsApp**: el contacto y la búsqueda quedan
  guardados igual (Brunella los ve en el dashboard), el documento de compatibilidad se genera
  y se le manda a ella por Telegram para revisión, pero el envío al cliente queda pendiente
  indefinidamente hasta que confirme (o ella decida contactarlo por otra vía a mano).
- **Mismo número de WhatsApp llena el formulario dos veces**: se actualiza la Búsqueda/
  Propiedad existente del contacto en vez de crear un duplicado (mismo criterio que ya usa el
  matching de contactos del bot de notas de voz).
- **Meta cambia o revoca tokens de acceso**: los webhooks devuelven error explícito en vez de
  fallar silenciosamente; se loguea para poder diagnosticar sin depender de que el cliente
  avise que "no le llegó nada".

## Testing

- Tests automatizados sobre: parseo del formulario → estructura, resolución de duplicados,
  motor de matching (casos con y sin match, distintas combinaciones de criterios), generación
  de la razón de match por reglas, y el flujo de atribución (token → código → consulta
  creada).
- Tests de los tres webhooks nuevos (Messenger, Instagram, WhatsApp) siguiendo el mismo patrón
  ya usado para el webhook de Telegram (mocks de las llamadas a las APIs externas).
- Verificación manual en navegador del formulario completo (mobile-first, ambos caminos:
  comprador y propietario) antes de considerar esta fase cerrada, igual que se hizo con el
  resto del dashboard.

## Stack técnico (adiciones sobre Fase 1)

| Pieza | Herramienta | Costo |
|---|---|---|
| Mensajería Facebook | Messenger Platform (Meta for Developers) | Gratis |
| Mensajería Instagram | Instagram Messaging API (misma app de Meta) | Gratis |
| Mensajería WhatsApp | WhatsApp Cloud API (Meta, directo) | Gratis hasta ~1000 conv/mes |
| Formulario cliente | Next.js (misma app), Server Actions + Zod | Gratis |
| Motor de matching | Lógica propia en TypeScript, sin librerías nuevas | Gratis |
