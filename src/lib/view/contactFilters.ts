import type { Contacto } from "../domain/contactos";
import type { Busqueda } from "../domain/busquedas";
import { normalizeText } from "../text/normalize";

export type ContactoFilters = {
  tipo?: Contacto["tipo"];
  etapa?: Contacto["etapa"];
  temperatura?: Contacto["temperatura"];
};

const ETAPAS_CERRADAS: Contacto["etapa"][] = ["Cerrado-ganado", "Cerrado-perdido", "Inactivo"];

export function filterContactos(contactos: Contacto[], filters: ContactoFilters): Contacto[] {
  return contactos.filter((contacto) => {
    if (filters.tipo && contacto.tipo !== filters.tipo) return false;
    if (filters.etapa && contacto.etapa !== filters.etapa) return false;
    if (filters.temperatura && contacto.temperatura !== filters.temperatura) return false;
    return true;
  });
}

export function needsFollowUp(contacto: Contacto, diasSinActividad: number): boolean {
  if (ETAPAS_CERRADAS.includes(contacto.etapa)) return false;
  const ultimaActividad = new Date(contacto.ultima_actividad).getTime();
  const limite = Date.now() - diasSinActividad * 24 * 60 * 60 * 1000;
  return ultimaActividad < limite;
}

/**
 * Zona lives on Búsqueda, not Contacto, so filtering the contact list by zona means joining
 * against búsquedas first. Returns null when no zona filter is active (caller should skip
 * filtering entirely), otherwise the set of contacto_id that have a matching búsqueda.
 */
export function filterContactoIdsByZona(
  busquedas: Busqueda[],
  zona: string | undefined
): Set<string> | null {
  if (!zona) return null;
  const normalizedZona = normalizeText(zona);
  const ids = busquedas
    .filter((b) => b.zona && normalizeText(b.zona).includes(normalizedZona))
    .map((b) => b.contacto_id);
  return new Set(ids);
}
