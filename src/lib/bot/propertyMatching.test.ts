import { describe, it, expect } from "vitest";
import { createPortfolioPropioSource, buildMatchReason } from "./propertyMatching";
import type { Propiedad } from "../domain/propiedades";
import type { Busqueda } from "../domain/busquedas";

function makePropiedad(overrides: Partial<Propiedad>): Propiedad {
  return {
    id: "p1",
    contacto_propietario_id: null,
    direccion: "Bv. Illia 500, Nueva Córdoba",
    tipo_propiedad: "Departamento",
    descripcion: null,
    precio: 70000,
    moneda: "USD",
    codigo: null,
    dormitorios: 2,
    fecha_recibida: "2026-01-01",
    condiciones: null,
    estado: "Activa",
    consultas_historicas: 0,
    visitas_historicas: 0,
    imagenes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeBusqueda(overrides: Partial<Busqueda>): Busqueda {
  return {
    id: "b1",
    contacto_id: "c1",
    tipo_operacion: "Compra",
    presupuesto_min: 50000,
    presupuesto_max: 90000,
    moneda: "USD",
    zona: "Nueva Córdoba",
    tipo_propiedad: "Departamento",
    dormitorios: 2,
    ambientes: null,
    banos: null,
    caracteristicas: [],
    otros_requisitos: null,
    activa: true,
    documento_aprobado: false,
    documento_enviado: false,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("createPortfolioPropioSource", () => {
  it("matches a property that satisfies tipo, precio, zona and dormitorios", async () => {
    const propiedad = makePropiedad({});
    const propiedadesModule = { list: async () => [propiedad] } as any;
    const source = createPortfolioPropioSource(propiedadesModule);

    const result = await source.buscar(makeBusqueda({}));

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("excludes a property with the wrong tipo_propiedad", async () => {
    const propiedad = makePropiedad({ tipo_propiedad: "Casa" });
    const propiedadesModule = { list: async () => [propiedad] } as any;
    const source = createPortfolioPropioSource(propiedadesModule);

    const result = await source.buscar(makeBusqueda({}));

    expect(result).toHaveLength(0);
  });

  it("excludes a property with fewer dormitorios than requested", async () => {
    const propiedad = makePropiedad({ dormitorios: 1 });
    const propiedadesModule = { list: async () => [propiedad] } as any;
    const source = createPortfolioPropioSource(propiedadesModule);

    const result = await source.buscar(makeBusqueda({ dormitorios: 2 }));

    expect(result).toHaveLength(0);
  });

  it("excludes a property outside the requested price range", async () => {
    const propiedad = makePropiedad({ precio: 200000 });
    const propiedadesModule = { list: async () => [propiedad] } as any;
    const source = createPortfolioPropioSource(propiedadesModule);

    const result = await source.buscar(makeBusqueda({ presupuesto_min: 50000, presupuesto_max: 90000 }));

    expect(result).toHaveLength(0);
  });

  it("does not exclude on price when currencies differ (no conversion)", async () => {
    const propiedad = makePropiedad({ precio: 200000, moneda: "ARS" });
    const propiedadesModule = { list: async () => [propiedad] } as any;
    const source = createPortfolioPropioSource(propiedadesModule);

    const result = await source.buscar(makeBusqueda({ presupuesto_min: 50000, presupuesto_max: 90000, moneda: "USD" }));

    expect(result).toHaveLength(1);
  });

  it("excludes a property in a different zona", async () => {
    const propiedad = makePropiedad({ direccion: "Calle Falsa 123, Alta Córdoba" });
    const propiedadesModule = { list: async () => [propiedad] } as any;
    const source = createPortfolioPropioSource(propiedadesModule);

    const result = await source.buscar(makeBusqueda({ zona: "Nueva Córdoba" }));

    expect(result).toHaveLength(0);
  });

  it("only searches properties with estado Activa", async () => {
    const propiedadesModule = {
      list: async (where: any) => {
        expect(where).toEqual({ estado: "Activa" });
        return [];
      },
    } as any;
    const source = createPortfolioPropioSource(propiedadesModule);
    await source.buscar(makeBusqueda({}));
  });
});

describe("buildMatchReason", () => {
  it("mentions budget, zona and dormitorios when all match", () => {
    const reason = buildMatchReason(makePropiedad({}), makeBusqueda({}));
    expect(reason).toContain("presupuesto");
    expect(reason).toContain("Nueva Córdoba");
    expect(reason).toContain("2 dormitorios");
  });

  it("falls back to a generic reason when no specific criteria were given", () => {
    const reason = buildMatchReason(
      makePropiedad({}),
      makeBusqueda({ zona: null, dormitorios: null, presupuesto_min: null, presupuesto_max: null })
    );
    expect(reason).toContain("tipo de propiedad");
  });
});
