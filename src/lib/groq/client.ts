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

export type ExtractedNote = {
  contactoNombreMencionado: string | null;
  propiedadMencionada: string | null;
  tipoEvento: "conversacion" | "consulta" | "muestra" | "oferta";
  feedback: string | null;
  montoOferta: number | null;
  presupuestoMencionado: number | null;
  proximoPaso: string | null;
  confianza: "alta" | "media" | "baja";
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
  return JSON.parse(data.choices[0].message.content) as ExtractedNote;
}
