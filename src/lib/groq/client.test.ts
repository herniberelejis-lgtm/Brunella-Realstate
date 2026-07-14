import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { transcribeAudio, extractStructuredData } from "./client";

describe("groq client", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("transcribes audio via Groq's Whisper endpoint", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ text: "Hablé con María sobre el depto." }),
    });

    const result = await transcribeAudio(Buffer.from("fake-audio"), "note.ogg");

    expect(result).toBe("Hablé con María sobre el depto.");
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain("/audio/transcriptions");
    expect(options.headers.Authorization).toBe("Bearer test-key");
  });

  it("throws a descriptive error when transcription fails", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });

    await expect(transcribeAudio(Buffer.from("fake-audio"), "note.ogg")).rejects.toThrow(
      /Groq transcription failed/
    );
  });

  it("extracts structured data from a transcript", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                contactoNombreMencionado: "María",
                propiedadMencionada: "depto de Nueva Córdoba",
                tipoEvento: "muestra",
                feedback: "le encantó",
                montoOferta: null,
                presupuestoMencionado: null,
                proximoPaso: "seguimiento el viernes",
                confianza: "alta",
              }),
            },
          },
        ],
      }),
    });

    const result = await extractStructuredData("Hablé con María sobre el depto.", {
      contactosConocidos: [],
      propiedadesConocidas: [],
    });

    expect(result.tipoEvento).toBe("muestra");
    expect(result.contactoNombreMencionado).toBe("María");
    expect(result.confianza).toBe("alta");
  });

  it("throws a descriptive error when extraction fails", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });

    await expect(
      extractStructuredData("transcript", { contactosConocidos: [], propiedadesConocidas: [] })
    ).rejects.toThrow(/Groq extraction failed/);
  });

  it("falls back to baja confianza when the LLM returns a shape that doesn't match the schema", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              // montoOferta as a string and an invalid tipoEvento — malformed LLM output
              content: JSON.stringify({
                contactoNombreMencionado: "María",
                propiedadMencionada: null,
                tipoEvento: "algo_invalido",
                feedback: null,
                montoOferta: "noventa mil",
                presupuestoMencionado: null,
                proximoPaso: null,
                confianza: "alta",
              }),
            },
          },
        ],
      }),
    });

    const result = await extractStructuredData("transcript", {
      contactosConocidos: [],
      propiedadesConocidas: [],
    });

    expect(result.confianza).toBe("baja");
  });
});
