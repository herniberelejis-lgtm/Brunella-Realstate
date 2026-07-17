import type { Propiedad } from "../domain/propiedades";
import type { Busqueda } from "../domain/busquedas";
import { normalizeText } from "../text/normalize";

export interface PropertySource {
  buscar(busqueda: Busqueda): Promise<Propiedad[]>;
}

function matchesCriteria(propiedad: Propiedad, busqueda: Busqueda): boolean {
  if (busqueda.tipo_propiedad && propiedad.tipo_propiedad !== busqueda.tipo_propiedad) {
    return false;
  }

  if (busqueda.dormitorios != null) {
    if (propiedad.dormitorios == null || propiedad.dormitorios < busqueda.dormitorios) {
      return false;
    }
  }

  const sameCurrency = busqueda.moneda && propiedad.moneda && busqueda.moneda === propiedad.moneda;
  if (sameCurrency && propiedad.precio != null) {
    if (busqueda.presupuesto_min != null && propiedad.precio < busqueda.presupuesto_min) return false;
    if (busqueda.presupuesto_max != null && propiedad.precio > busqueda.presupuesto_max) return false;
  }

  if (busqueda.zona) {
    const zonaNormalizada = normalizeText(busqueda.zona);
    if (!normalizeText(propiedad.direccion).includes(zonaNormalizada)) return false;
  }

  return true;
}

export function createPortfolioPropioSource(propiedadesModule: {
  list(where?: Partial<Propiedad>): Promise<Propiedad[]>;
}): PropertySource {
  return {
    async buscar(busqueda: Busqueda): Promise<Propiedad[]> {
      const activas = await propiedadesModule.list({ estado: "Activa" });
      return activas.filter((p) => matchesCriteria(p, busqueda));
    },
  };
}

export function buildMatchReason(propiedad: Propiedad, busqueda: Busqueda): string {
  const razones: string[] = [];

  const sameCurrency = busqueda.moneda && propiedad.moneda && busqueda.moneda === propiedad.moneda;
  if (sameCurrency && (busqueda.presupuesto_min != null || busqueda.presupuesto_max != null)) {
    const min = busqueda.presupuesto_min ?? "sin mínimo";
    const max = busqueda.presupuesto_max ?? "sin máximo";
    razones.push(`está dentro de tu presupuesto de ${busqueda.moneda} ${min}-${max}`);
  }
  if (busqueda.zona) {
    razones.push(`está en la zona que buscás (${busqueda.zona})`);
  }
  if (busqueda.dormitorios != null && propiedad.dormitorios != null) {
    razones.push(`tiene ${propiedad.dormitorios} dormitorios, cumpliendo el mínimo que pediste`);
  }

  if (razones.length === 0) {
    return "Coincide con el tipo de propiedad que buscás.";
  }
  return `Te la recomiendo porque ${razones.join(" y ")}.`;
}
