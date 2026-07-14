import { describe, it, expect, vi } from "vitest";
import { processVoiceNote, type ProcessVoiceNoteDeps } from "./processVoiceNote";

function buildDeps(overrides: Partial<ProcessVoiceNoteDeps> = {}): ProcessVoiceNoteDeps {
  const defaults: ProcessVoiceNoteDeps = {
    transcribeAudio: vi.fn().mockResolvedValue("transcripción por defecto"),
    extractStructuredData: vi.fn().mockResolvedValue({
      contactoNombreMencionado: null,
      propiedadMencionada: null,
      tipoEvento: "conversacion",
      feedback: null,
      montoOferta: null,
      presupuestoMencionado: null,
      proximoPaso: null,
      confianza: "alta",
    }),
    contactos: {
      list: vi.fn().mockResolvedValue([]),
      findByNombreLike: vi.fn().mockResolvedValue([]),
      marcarActividad: vi.fn().mockResolvedValue(undefined),
      create: vi.fn(),
    } as any,
    propiedades: {
      list: vi.fn().mockResolvedValue([]),
      findByDireccionLike: vi.fn().mockResolvedValue([]),
    } as any,
    conversaciones: { create: vi.fn().mockResolvedValue({}) } as any,
    muestras: { create: vi.fn().mockResolvedValue({}) } as any,
    consultas: { create: vi.fn().mockResolvedValue({}) } as any,
    ofertas: { create: vi.fn().mockResolvedValue({}) } as any,
  };
  // Merge nested deps objects (not just top-level) so a test overriding e.g.
  // `contactos.findByNombreLike` doesn't silently drop the default `contactos.list` mock.
  return {
    ...defaults,
    ...overrides,
    contactos: { ...defaults.contactos, ...(overrides.contactos as object) } as any,
    propiedades: { ...defaults.propiedades, ...(overrides.propiedades as object) } as any,
  };
}

describe("processVoiceNote", () => {
  it("asks for clarification when confianza is 'baja'", async () => {
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "María",
        propiedadMencionada: null,
        tipoEvento: "conversacion",
        feedback: null,
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: null,
        confianza: "baja",
      }),
    });

    const result = await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(result.respuesta).toMatch(/no.*segur|repet/i);
    expect(deps.conversaciones.create).not.toHaveBeenCalled();
  });

  it("asks the user to choose when the contact name is ambiguous", async () => {
    const juanPerez = { id: "1", nombre: "Juan Pérez" };
    const juanGomez = { id: "2", nombre: "Juan Gómez" };
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "Juan",
        propiedadMencionada: null,
        tipoEvento: "conversacion",
        feedback: null,
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: null,
        confianza: "alta",
      }),
      contactos: {
        findByNombreLike: vi.fn().mockResolvedValue([juanPerez, juanGomez]),
      } as any,
    });

    const result = await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(result.respuesta).toContain("Juan Pérez");
    expect(result.respuesta).toContain("Juan Gómez");
    expect(deps.conversaciones.create).not.toHaveBeenCalled();
  });

  it("creates a Conversacion for a matched contact and confirms it", async () => {
    const maria = { id: "1", nombre: "María Gómez" };
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "María",
        propiedadMencionada: null,
        tipoEvento: "conversacion",
        feedback: "quiere ver más opciones",
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: "mandarle más opciones",
        confianza: "alta",
      }),
      contactos: {
        findByNombreLike: vi.fn().mockResolvedValue([maria]),
        marcarActividad: vi.fn().mockResolvedValue(undefined),
      } as any,
    });

    const result = await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(deps.conversaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contacto_id: "1",
        resumen: "quiere ver más opciones",
        proximo_paso: "mandarle más opciones",
        origen: "nota_de_voz",
      })
    );
    expect(deps.contactos.marcarActividad).toHaveBeenCalledWith("1");
    expect(result.respuesta).toContain("María Gómez");
  });

  it("creates a Muestra linked to contacto and propiedad when tipoEvento is 'muestra'", async () => {
    const maria = { id: "1", nombre: "María Gómez" };
    const depto = { id: "10", direccion: "Nueva Córdoba 500" };
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "María",
        propiedadMencionada: "Nueva Córdoba",
        tipoEvento: "muestra",
        feedback: "le encantó",
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: "esperar respuesta",
        confianza: "alta",
      }),
      contactos: { findByNombreLike: vi.fn().mockResolvedValue([maria]), marcarActividad: vi.fn() } as any,
      propiedades: { findByDireccionLike: vi.fn().mockResolvedValue([depto]) } as any,
    });

    await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(deps.muestras.create).toHaveBeenCalledWith(
      expect.objectContaining({ contacto_id: "1", propiedad_id: "10", feedback: "le encantó" })
    );
  });

  it("creates an Oferta with the mentioned amount when tipoEvento is 'oferta'", async () => {
    const juan = { id: "1", nombre: "Juan Pérez" };
    const depto = { id: "10", direccion: "Nueva Córdoba 500" };
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "Juan",
        propiedadMencionada: "Nueva Córdoba",
        tipoEvento: "oferta",
        feedback: null,
        montoOferta: 95000,
        presupuestoMencionado: null,
        proximoPaso: null,
        confianza: "alta",
      }),
      contactos: { findByNombreLike: vi.fn().mockResolvedValue([juan]), marcarActividad: vi.fn() } as any,
      propiedades: { findByDireccionLike: vi.fn().mockResolvedValue([depto]) } as any,
    });

    await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(deps.ofertas.create).toHaveBeenCalledWith(
      expect.objectContaining({ contacto_id: "1", propiedad_id: "10", monto: 95000, estado: "Pendiente" })
    );
  });

  it("asks the user to choose when the mentioned property is ambiguous", async () => {
    const juan = { id: "1", nombre: "Juan Pérez" };
    const departamentoUno = { id: "10", direccion: "Nueva Córdoba 500" };
    const departamentoDos = { id: "11", direccion: "Nueva Córdoba 700" };
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "Juan",
        propiedadMencionada: "Nueva Córdoba",
        tipoEvento: "muestra",
        feedback: null,
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: null,
        confianza: "alta",
      }),
      contactos: { findByNombreLike: vi.fn().mockResolvedValue([juan]), marcarActividad: vi.fn() } as any,
      propiedades: {
        findByDireccionLike: vi.fn().mockResolvedValue([departamentoUno, departamentoDos]),
      } as any,
    });

    const result = await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(result.respuesta).toContain("Nueva Córdoba 500");
    expect(result.respuesta).toContain("Nueva Córdoba 700");
    expect(deps.muestras.create).not.toHaveBeenCalled();
  });

  it("does not create a Consulta, and does NOT claim success, when no property was matched", async () => {
    const juan = { id: "1", nombre: "Juan Pérez" };
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "Juan",
        propiedadMencionada: null,
        tipoEvento: "consulta",
        feedback: null,
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: null,
        confianza: "alta",
      }),
      contactos: { findByNombreLike: vi.fn().mockResolvedValue([juan]), marcarActividad: vi.fn() } as any,
    });

    const result = await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(deps.consultas.create).not.toHaveBeenCalled();
    expect(deps.contactos.marcarActividad).not.toHaveBeenCalled();
    expect(result.respuesta).not.toContain("✅ Guardé");
    expect(result.respuesta).toMatch(/no registré nada/i);
  });

  it("does not create an Oferta, and does NOT claim success, when montoOferta is missing", async () => {
    const juan = { id: "1", nombre: "Juan Pérez" };
    const depto = { id: "10", direccion: "Nueva Córdoba 500" };
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "Juan",
        propiedadMencionada: "Nueva Córdoba",
        tipoEvento: "oferta",
        feedback: null,
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: null,
        confianza: "alta",
      }),
      contactos: { findByNombreLike: vi.fn().mockResolvedValue([juan]), marcarActividad: vi.fn() } as any,
      propiedades: { findByDireccionLike: vi.fn().mockResolvedValue([depto]) } as any,
    });

    const result = await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(deps.ofertas.create).not.toHaveBeenCalled();
    expect(result.respuesta).not.toContain("✅ Guardé");
    expect(result.respuesta).toMatch(/no registré nada/i);
  });

  it("creates a Consulta linked to the matched property", async () => {
    const juan = { id: "1", nombre: "Juan Pérez" };
    const depto = { id: "10", direccion: "Nueva Córdoba 500" };
    const deps = buildDeps({
      contactos: {
        list: vi.fn().mockResolvedValue([juan]),
        findByNombreLike: vi.fn().mockResolvedValue([juan]),
        marcarActividad: vi.fn(),
      } as any,
      propiedades: {
        list: vi.fn().mockResolvedValue([depto]),
        findByDireccionLike: vi.fn().mockResolvedValue([depto]),
      } as any,
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "Juan",
        propiedadMencionada: "Nueva Córdoba",
        tipoEvento: "consulta",
        feedback: null,
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: null,
        confianza: "alta",
      }),
    });

    await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(deps.consultas.create).toHaveBeenCalledWith(
      expect.objectContaining({ propiedad_id: "10", contacto_id: "1" })
    );
  });

  it("returns a not-found message when the mentioned contact matches nobody", async () => {
    const deps = buildDeps({
      extractStructuredData: vi.fn().mockResolvedValue({
        contactoNombreMencionado: "Roberto",
        propiedadMencionada: null,
        tipoEvento: "conversacion",
        feedback: null,
        montoOferta: null,
        presupuestoMencionado: null,
        proximoPaso: null,
        confianza: "alta",
      }),
      contactos: { findByNombreLike: vi.fn().mockResolvedValue([]) } as any,
    });

    const result = await processVoiceNote(deps, Buffer.from("audio"), "note.oga");

    expect(result.respuesta).toMatch(/no encontré ningún contacto/i);
    expect(deps.conversaciones.create).not.toHaveBeenCalled();
  });
});
