import type { Contacto } from "../domain/contactos";

export function buildRecordatorioMessage(contactos: Contacto[]): string {
  if (contactos.length === 0) {
    return "Hoy no hay nadie pendiente de seguimiento — estás al día. 🎉";
  }
  const lista = contactos.map((c) => `- ${c.nombre} (${c.etapa})`).join("\n");
  return `Conviene seguir a estos contactos hoy:\n${lista}`;
}
