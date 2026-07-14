# Segundo Cerebro / CRM para Asesora Inmobiliaria — Diseño (Fase 1)

## Contexto

Brunella es asesora inmobiliaria independiente en Grupo Banker, Córdoba, Argentina. Trabaja
prospectos vía Instagram, Facebook, WhatsApp y los portales de Grupo Banker y Zonaprop. Para
publicar propiedades usa Adinco CRM (y va a migrar a Tokko) — herramientas del lado de la
**propiedad** (publicación y sindicación a portales). No existe hoy ninguna herramienta del
lado del **contacto**: registro de conversaciones, muestras, interés y búsquedas de cada
persona con la que habla.

Ya existe una landing page pública (armada en Lovable, dominio
`id-preview--cb04015d-c8c1-4f38-adf2-e6666caf601f.lovable.app`) con dos formularios de
captación: "Buscá tu propiedad" (compradores/inquilinos) y "Publicá tu propiedad"
(propietarios/desarrollistas). Existió un prototipo de bot de Telegram conectado a ese
formulario, pero no se encontró el código y se decidió reconstruir desde cero.

Además, hoy lleva un Excel con las propiedades que tiene en cartera: fecha en que las
recibió, tipo de propiedad, descripción, precio, y un conteo manual de cuántas consultas y
visitas tuvo cada una (su única señal de feedback sobre qué propiedades funcionan). Ese
conteo manual es justamente el tipo de trabajo repetitivo que este proyecto busca eliminar.

## Alcance de este documento

Este documento cubre únicamente la **Fase 1: Segundo Cerebro / CRM** — la base de datos de
contactos, el bot de Telegram para carga por voz, el dashboard web, y los recordatorios de
seguimiento.

Queda fuera de alcance (Fase 2, futura, spec separada): el bot de búsqueda/filtrado de
propiedades en portales y Tokko, el scoring de propiedades contra una búsqueda, y el generador
de propuestas para el cliente. La Fase 2 se apoya en los datos de **Búsqueda** que esta Fase 1
ya deja bien estructurados.

## Arquitectura general

```
[Nota de voz] → [Bot Telegram] → [Transcripción (Groq Whisper)] → [Extracción con IA (Groq)] → [Supabase (Postgres)]
                                                                                                        ↓
                                                                                    [Dashboard web (React + Vite)]
                                                                                                        ↓
                                                                          (Fase 2, futuro) [Bot de propiedades]
```

Tarea programada diaria (Supabase pg_cron) revisa contactos sin actividad reciente y manda un
recordatorio de seguimiento vía el mismo bot de Telegram.

## Modelo de datos

### Contacto
Entidad central para cualquier persona con la que Brunella habla.

- `nombre`
- `telefono` / `whatsapp`
- `email` (opcional)
- `fuente`: Instagram | Facebook | Zonaprop | Grupo Banker | Referido | Otro
- `fecha_primer_contacto`
- `tipo`: Comprador/Inquilino | Propietario/Desarrollista | Ambos
- `etapa`: Nuevo | Calificando | Buscando | Mostrando propiedades | Negociando | Cerrado-ganado | Cerrado-perdido | Inactivo
- `temperatura`: Frío | Tibio | Caliente
- `ultima_actividad` (derivado, usado para recordatorios)

### Búsqueda
Solo para contactos tipo Comprador/Inquilino. Un contacto puede tener más de una si cambia de
criterio a lo largo del tiempo.

- `contacto_id`
- `tipo_operacion`: Compra | Alquiler | Inversión
- `presupuesto`
- `zona`
- `tipo_propiedad`: Departamento | Casa | Lote | Local/Oficina
- `dormitorios`
- `otros_requisitos` (texto libre)
- `activa` (bool)

### Propiedad
Entidad propia (no un simple campo del contacto), porque necesita acumular consultas y
visitas propias y no todas las propiedades tienen necesariamente un Propietario individual
cargado como Contacto (ej. unidades de un desarrollo comercializado para un developer).

- `contacto_propietario_id` (opcional — nulo si es una unidad de un desarrollo sin dueño
  individual cargado)
- `direccion`
- `tipo_propiedad`: Departamento | Casa | Lote | Local/Oficina
- `descripcion`
- `precio`
- `fecha_recibida`
- `condiciones` (exclusividad, comisión, texto libre)
- `estado`: Activa | Vendida | Retirada
- `consultas_historicas` (int — importado una vez desde el Excel, punto de partida)
- `visitas_historicas` (int — importado una vez desde el Excel, punto de partida)
- `consultas_totales` (**calculado**: `consultas_historicas` + cantidad de registros de
  Consulta vinculados)
- `visitas_totales` (**calculado**: `visitas_historicas` + cantidad de registros de Muestra
  vinculados)

Con esto, cada consulta o muestra que se registre de acá en adelante (por nota de voz o
manual) suma sola al conteo — Brunella deja de llevar el número a mano.

### Consulta
Registro liviano de una consulta sobre una propiedad puntual — no toda consulta amerita una
Conversación completa (ej. "¿todavía está disponible?" por Instagram).

- `propiedad_id`
- `contacto_id` (opcional — puede no identificarse a quién preguntó)
- `fecha`
- `canal`: Instagram | Facebook | WhatsApp | Zonaprop | Grupo Banker | Otro
- `origen`: nota_de_voz | manual

### Conversación
Línea de tiempo universal — aplica a cualquier tipo de contacto.

- `contacto_id`
- `fecha`
- `canal`: Llamada | WhatsApp | Instagram DM | Presencial | Otro
- `resumen` (generado desde la transcripción)
- `proximo_paso`
- `origen`: nota_de_voz | manual

### Muestra
Propiedad mostrada a un contacto Comprador.

- `contacto_id`
- `propiedad_id` (vínculo a la propiedad mostrada; si no está cargada como Propiedad, se
  admite `propiedad_mostrada_texto` libre como respaldo)
- `fecha`
- `feedback`
- `interes_resultante`: Le interesó | No le interesó | Indeciso

### Oferta
Propuesta de compra/alquiler de un Contacto Comprador sobre una Propiedad. Se carga con la
misma lógica que Consulta/Muestra (nota de voz, con la misma red de seguridad de confirmar
antes de guardar).

- `propiedad_id`
- `contacto_id` (comprador que ofrece)
- `monto`
- `fecha`
- `estado`: Pendiente | Aceptada | Rechazada
- `origen`: nota_de_voz | manual

## Flujo del bot de Telegram

1. Brunella graba una nota de voz contándole al bot qué pasó con un contacto.
2. El bot transcribe el audio con **Groq (Whisper)**.
3. Un modelo de **Groq** lee la transcripción y extrae:
   - a qué contacto corresponde (busca coincidencia por nombre/teléfono; si hay ambigüedad o
     parece un contacto nuevo, el bot repregunta antes de guardar)
   - a qué propiedad corresponde, si la nota menciona una (busca coincidencia por dirección o
     referencia; si no matchea ninguna, pregunta o la deja en texto libre)
   - tipo de evento: conversación general, consulta puntual, muestra, oferta, negociación con
     propietario
   - detalles relevantes: feedback, presupuesto u oferta mencionada, urgencia
   - próximo paso sugerido
4. Se guarda vinculado al contacto correcto. Si detecta cambios relevantes (nueva búsqueda,
   cambio de presupuesto, cambio de etapa) actualiza la ficha.
5. El bot responde con un resumen corto de lo que guardó, para que Brunella lo confirme de un
   vistazo (ej. "✅ Guardé: María Gómez — Muestra depto Nueva Córdoba, feedback positivo,
   presupuesto ajustado, seguimiento el viernes").

### Recordatorios automáticos

Tarea programada (por defecto, todos los días a las 9am) que busca contactos con:
- `etapa` no está en (Cerrado-ganado, Cerrado-perdido, Inactivo), **y**
- `ultima_actividad` hace más de N días (default: 5, configurable)

y le manda a Brunella, por el mismo bot, un mensaje con la lista de a quién conviene seguir.

## Dashboard web

App web simple, mobile-friendly (para abrir desde el celular).

- **Vista principal de contactos**: lista filtrable por tipo, etapa, temperatura, zona. Los
  que necesitan seguimiento (misma lógica que el recordatorio) aparecen destacados arriba.
- **Ficha de contacto**: datos de contacto, búsqueda activa (si es Comprador) o propiedades en
  cartera (si es Propietario/Desarrollista), línea de tiempo completa de conversaciones y
  muestras, próximo paso.
- **Vista de propiedades**: lista de propiedades con precio, estado, y consultas/visitas/
  ofertas totales — para ver de un vistazo cuáles están funcionando y cuáles no.
- **Ficha de propiedad**: datos de la propiedad, propietario vinculado (si tiene), historial
  de consultas, muestras y ofertas.
- **Alta/edición manual**: para cargar o corregir datos sin depender del bot.

Sin gráficos ni métricas complejas en esta fase — prioridad: rápido de mirar antes de una
llamada, y confiable como fuente de verdad.

## Manejo de errores y casos borde

- **Audio poco claro o corto**: el bot responde pidiendo que lo repita o mande un resumen
  escrito, en vez de adivinar y guardar mal.
- **Contacto ambiguo**: el bot muestra opciones para elegir, o confirma que es un contacto
  nuevo, antes de guardar nada.
- **Extracción de baja confianza**: el bot prefiere preguntar antes de guardar un dato
  incierto.
- El resumen de confirmación después de cada nota es la red de seguridad principal — Brunella
  lo lee en segundos y corrige en el dashboard si algo quedó mal interpretado.
- Los contactos duplicados (mismo nombre) se resuelven eligiendo entre candidatos en el paso 3
  del flujo del bot; el merge manual de duplicados ya creados queda fuera de alcance de la v1.
- Igual criterio para propiedades ambiguas: si una nota menciona una propiedad que no matchea
  claramente ninguna cargada, el bot pregunta antes de crear una duplicada.

## Migración del Excel existente

Se migra el histórico del Excel actual a la tabla `Propiedad` como paso único de importación
(no un flujo recurrente): cada fila se carga con sus consultas/visitas acumuladas en
`consultas_historicas` / `visitas_historicas`, para no perder el historial ya construido. De
ahí en adelante, los conteos nuevos se suman solos vía `Consulta` y `Muestra`.

El archivo está hoy en la computadora/Drive de Brunella — hay que conseguirlo (y confirmar
sus columnas reales) antes de construir el script de importación durante la implementación.

## Stack técnico

| Pieza | Herramienta | Costo |
|---|---|---|
| Base de datos | Supabase (Postgres) | Gratis (tier free) |
| Dashboard web | React + Vite + Tailwind, hosteado en Vercel | Gratis |
| Bot | Telegram Bot API + Supabase Edge Functions | Gratis |
| Transcripción de audio | Groq (Whisper) | Gratis (tier free) |
| Extracción/estructuración con IA | Groq (modelo gratuito) | Gratis |
| Recordatorios | Supabase pg_cron → llamada al bot | Gratis |

Se eligió Telegram (no WhatsApp) para el bot de carga interna porque es de uso exclusivo de
Brunella (una nota "a sí misma", no de cara al cliente) y evita la complejidad y el costo de
la API oficial de WhatsApp Business.

## Testing

- Pruebas manuales con notas de voz reales cubriendo casos típicos (nueva conversación, nueva
  consulta, nueva muestra, nueva oferta, negociación con propietario) y casos borde (audio
  ambiguo, contacto o propiedad no identificados, cambio de búsqueda).
- Tests automatizados sobre la capa de datos y la lógica de extracción/matching de contacto y
  propiedad (parseo de transcripción → estructura, resolución de ambigüedad, cálculo de
  `consultas_totales` / `visitas_totales`), siguiendo el flujo TDD del proyecto.

## Fuera de alcance (Fase 2 — spec futura)

El bot de propiedades leerá las **Búsquedas** ya cargadas acá, buscará en Zonaprop / portal
Grupo Banker / Tokko, filtrará y calificará propiedades según esos criterios, y armará una
propuesta con las opciones y el motivo de cada una. Al depender de datos ya estructurados por
la Fase 1, esa etapa se simplifica considerablemente.

## Fuera de alcance (Fase 3 — spec futura)

Panel de redes para uso propio de Brunella (no para los propietarios): cuantificar el
desempeño de sus publicaciones y campañas en Instagram/Facebook (alcance, interacciones,
performance de ads) usando la API de Meta Business. Se documenta como fase separada porque no
existe hoy un conector MCP para esto (se verificó contra el registro de MCP disponible) y
requiere: crear una app en Meta for Developers vinculada a su Business Manager, gestionar
tokens de acceso que vencen y deben renovarse periódicamente, y vincular cada publicación o
campaña a la Propiedad correspondiente. Ninguna otra pieza de este proyecto depende de esta
fase.
