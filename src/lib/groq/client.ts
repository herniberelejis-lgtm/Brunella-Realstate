import { z } from "zod";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

function requireApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  return key;
}

export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  const apiKey = requireApiKey();
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audioBuffer)]), filename);
  form.append("model", "whisper-large-v3-turbo");

  const response = await fetch(`${GROQ_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq transcription failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { text: string };
  return data.text;
}

export type MatchContext = {
  contactosConocidos: { id: string; nombre: string }[];
  propiedadesConocidas: { id: string; direccion: string }[];
};

const extractedNoteSchema = z.object({
  contactoNombreMencionado: z.string().nullable(),
  propiedadMencionada: z.string().nullable(),
  tipoEvento: z.enum(["conversacion", "consulta", "muestra", "oferta"]),
  feedback: z.string().nullable(),
  montoOferta: z.number().nullable(),
  presupuestoMencionado: z.number().nullable(),
  proximoPaso: z.string().nullable(),
  confianza: z.enum(["alta", "media", "baja"]),
});

export type ExtractedNote = z.infer<typeof extractedNoteSchema>;

const BAJA_CONFIANZA_POR_FORMATO_INESPERADO: ExtractedNote = {
  contactoNombreMencionado: null,
  propiedadMencionada: null,
  tipoEvento: "conversacion",
  feedback: null,
  montoOferta: null,
  presupuestoMencionado: null,
  proximoPaso: null,
  confianza: "baja",
};

const EXTRACTION_SYSTEM_PROMPT = `Sos un asistente que estructura notas de voz de una asesora
inmobiliaria en un JSON. Devolvé SOLO un objeto JSON (sin texto adicional) con estas claves:
contactoNombreMencionado (string o null), propiedadMencionada (string o null),
tipoEvento ("conversacion" | "consulta" | "muestra" | "oferta"),
feedback (string o null), montoOferta (number o null), presupuestoMencionado (number o null),
proximoPaso (string o null), confianza ("alta" | "media" | "baja" — baja si no estás seguro
de a qué contacto o propiedad se refiere la nota).`;

export async function extractStructuredData(
  transcript: string,
  context: MatchContext
): Promise<ExtractedNote> {
  const apiKey = requireApiKey();
  const contextText = `Contactos conocidos: ${context.contactosConocidos
    .map((c) => c.nombre)
    .join(", ") || "ninguno"}. Propiedades conocidas: ${context.propiedadesConocidas
    .map((p) => p.direccion)
    .join(", ") || "ninguna"}.`;

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content: `${contextText}\n\nNota transcripta: "${transcript}"` },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq extraction failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(data.choices[0].message.content);
  } catch {
    return BAJA_CONFIANZA_POR_FORMATO_INESPERADO;
  }

  const result = extractedNoteSchema.safeParse(parsedJson);
  if (!result.success) {
    // The LLM occasionally returns a shape that doesn't match the schema (wrong type,
    // invalid enum value). Treat it as low confidence rather than trusting malformed data —
    // the caller already knows how to ask for clarification on "baja".
    return BAJA_CONFIANZA_POR_FORMATO_INESPERADO;
  }
  return result.data;
}

const TIPOS_PROPIEDAD_IMPORT = ["Departamento", "Casa", "PH", "Lote", "Local/Oficina"] as const;

const conversacionImportadaSchema = z.object({
  resumen: z.string(),
  tipoCliente: z.enum(["Comprador", "Propietario", "Ambos"]).nullable(),
  zonaMencionada: z.string().nullable(),
  tipoPropiedadMencionada: z.enum(TIPOS_PROPIEDAD_IMPORT).nullable(),
  presupuestoMin: z.number().nullable(),
  presupuestoMax: z.number().nullable(),
  moneda: z.enum(["ARS", "USD"]).nullable(),
  confianza: z.enum(["alta", "media", "baja"]),
});

export type ConversacionImportada = z.infer<typeof conversacionImportadaSchema>;

const BAJA_CONFIANZA_CONVERSACION: ConversacionImportada = {
  resumen: "No pude resumir esta conversación automáticamente.",
  tipoCliente: null,
  zonaMencionada: null,
  tipoPropiedadMencionada: null,
  presupuestoMin: null,
  presupuestoMax: null,
  moneda: null,
  confianza: "baja",
};

const CONVERSACION_IMPORT_SYSTEM_PROMPT = `Sos un asistente que resume una conversación
histórica de WhatsApp entre una asesora inmobiliaria y un cliente (exportada como texto plano).
Devolvé SOLO un objeto JSON (sin texto adicional) con estas claves:
resumen (string — 2 a 4 oraciones resumiendo qué se habló, en español, tono profesional),
tipoCliente ("Comprador" | "Propietario" | "Ambos" | null — según si el cliente buscaba comprar/
alquilar, o quería vender/alquilar una propiedad propia; null si no queda claro),
zonaMencionada (string o null), tipoPropiedadMencionada ("Departamento"|"Casa"|"PH"|"Lote"|
"Local/Oficina" o null), presupuestoMin (number o null), presupuestoMax (number o null),
moneda ("ARS"|"USD" o null), confianza ("alta"|"media"|"baja" — baja si el texto no parece
una conversación real o no tiene contenido suficiente para resumir).
El texto puede incluir mensajes de la propia asesora — enfocá el resumen en lo que necesitaba
el cliente, no en transcribir la charla completa.`;

// WhatsApp exports of long-running relationships can run to hundreds of KB, comfortably past
// what's useful (or affordable) to send to an LLM in one call. Keep the most recent messages —
// the tail of the export is what's actually relevant for a follow-up today — rather than
// building a multi-call map-reduce summarizer for a first version of this feature.
const MAX_CONVERSACION_CHARS = 12000;

export async function extractConversacionImportada(
  textoConversacion: string
): Promise<ConversacionImportada> {
  const apiKey = requireApiKey();
  const texto = textoConversacion.slice(-MAX_CONVERSACION_CHARS);

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CONVERSACION_IMPORT_SYSTEM_PROMPT },
        { role: "user", content: texto },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq extraction failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(data.choices[0].message.content);
  } catch {
    return BAJA_CONFIANZA_CONVERSACION;
  }

  const result = conversacionImportadaSchema.safeParse(parsedJson);
  if (!result.success) {
    return BAJA_CONFIANZA_CONVERSACION;
  }
  return result.data;
}
