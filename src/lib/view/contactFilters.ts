import type { Contacto } from "../domain/contactos";

export type ContactoFilters = {
  tipo?: Contacto["tipo"];
  etapa?: Contacto["etapa"];
  temperatura?: Contacto["temperatura"];
  zona?: string;
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
