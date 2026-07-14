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

### Propiedad en cartera
Solo para contactos tipo Propietario/Desarrollista.

- `contacto_id`
- `direccion`
- `tipo_propiedad`
- `precio_pedido`
- `condiciones` (exclusividad, comisión, texto libre)
- `estado`: Activa | Vendida | Retirada

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
- `fecha`
- `propiedad_mostrada` (dirección/referencia/link del portal)
- `feedback`
- `interes_resultante`: Le interesó | No le interesó | Indeciso

## Flujo del bot de Telegram

1. Brunella graba una nota de voz contándole al bot qué pasó con un contacto.
2. El bot transcribe el audio con **Groq (Whisper)**.
3. Un modelo de **Groq** lee la transcripción y extrae:
   - a qué contacto corresponde (busca coincidencia por nombre/teléfono; si hay ambigüedad o
     parece un contacto nuevo, el bot repregunta antes de guardar)
   - tipo de evento: conversación general, muestra, negociación con propietario
   - detalles relevantes: propiedad, feedback, presupuesto mencionado, urgencia
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

- **Vista principal**: lista de contactos, filtrable por tipo, etapa, temperatura, zona. Los
  que necesitan seguimiento (misma lógica que el recordatorio) aparecen destacados arriba.
- **Ficha de contacto**: datos de contacto, búsqueda activa o propiedad en cartera según el
  tipo, línea de tiempo completa de conversaciones y muestras, próximo paso.
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
  muestra, negociación con propietario) y casos borde (audio ambiguo, contacto no
  identificado, cambio de búsqueda).
- Tests automatizados sobre la capa de datos y la lógica de extracción/matching de contacto
  (parseo de transcripción → estructura, resolución de contacto ambiguo), siguiendo el flujo
  TDD del proyecto.

## Fuera de alcance (Fase 2 — spec futura)

El bot de propiedades leerá las **Búsquedas** ya cargadas acá, buscará en Zonaprop / portal
Grupo Banker / Tokko, filtrará y calificará propiedades según esos criterios, y armará una
propuesta con las opciones y el motivo de cada una. Al depender de datos ya estructurados por
la Fase 1, esa etapa se simplifica considerablemente.
