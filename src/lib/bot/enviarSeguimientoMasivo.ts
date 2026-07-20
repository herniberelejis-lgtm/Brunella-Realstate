import type { Contacto } from "../domain/contactos";
import type { createContactosModule } from "../domain/contactos";
import type { createConversacionesModule } from "../domain/conversaciones";

export type EnviarSeguimientoDeps = {
  contactos: ReturnType<typeof createContactosModule>;
  conversaciones: ReturnType<typeof createConversacionesModule>;
  sendWhatsAppTemplate: (
    to: string,
    templateName: string,
    languageCode: string,
    bodyParams: string[]
  ) => Promise<void>;
};

export type SeguimientoConfig = {
  // Nombre de la plantilla aprobada por Meta. Sin esto, el envío real no puede correr —
  // solo el modo dry-run (previsualización).
  templateName: string | null;
  languageCode: string;
  // dryRun=true: no manda nada, solo devuelve a quiénes se les mandaría. Es el default seguro
  // para poder probar el flujo sin plantilla aprobada y sin escribirle a clientes reales.
  dryRun: boolean;
};

const ETAPAS_CERRADAS: Contacto["etapa"][] = [
  "Cerrado-ganado",
  "Cerrado-perdido",
  "Inactivo",
];

export type SeguimientoResultado = {
  // Contactos que califican para el seguimiento (cartera migrada, con teléfono, no cerrados,
  // que todavía no confirmaron por el número nuevo).
  destinatarios: { id: string; nombre: string; telefono: string }[];
  // Contactos importados que se saltaron y por qué (para que Brunella entienda el conteo).
  omitidos: { nombre: string; motivo: string }[];
  enviados: number;
  fallidos: { nombre: string; error: string }[];
  dryRun: boolean;
};

/**
 * Selecciona los contactos de la cartera migrada de WhatsApp que necesitan el mensaje de
 * seguimiento (derivarlos al formulario nuevo) y, si no es dry-run y hay plantilla configurada,
 * se los manda por WhatsApp usando la plantilla aprobada por Meta.
 */
export async function enviarSeguimientoMasivo(
  deps: EnviarSeguimientoDeps,
  config: SeguimientoConfig
): Promise<SeguimientoResultado> {
  const idsImportados = await deps.conversaciones.findContactoIdsByOrigen("importado_whatsapp");

  const destinatarios: SeguimientoResultado["destinatarios"] = [];
  const omitidos: SeguimientoResultado["omitidos"] = [];

  for (const id of idsImportados) {
    const contacto = await deps.contactos.findById(id);
    if (!contacto) continue;
    if (!contacto.telefono) {
      omitidos.push({ nombre: contacto.nombre, motivo: "sin teléfono" });
      continue;
    }
    if (contacto.whatsapp_confirmado) {
      omitidos.push({ nombre: contacto.nombre, motivo: "ya confirmó por el número nuevo" });
      continue;
    }
    if (ETAPAS_CERRADAS.includes(contacto.etapa)) {
      omitidos.push({ nombre: contacto.nombre, motivo: `etapa ${contacto.etapa}` });
      continue;
    }
    destinatarios.push({ id: contacto.id, nombre: contacto.nombre, telefono: contacto.telefono });
  }

  const resultado: SeguimientoResultado = {
    destinatarios,
    omitidos,
    enviados: 0,
    fallidos: [],
    dryRun: config.dryRun || !config.templateName,
  };

  if (resultado.dryRun) return resultado;

  const templateName = config.templateName!;
  for (const dest of destinatarios) {
    try {
      // El primer parámetro de la plantilla es el nombre del cliente ({{1}}). El link al
      // formulario va como texto estático o botón de URL dentro de la plantilla aprobada.
      await deps.sendWhatsAppTemplate(dest.telefono, templateName, config.languageCode, [
        dest.nombre,
      ]);
      resultado.enviados += 1;
    } catch (error) {
      resultado.fallidos.push({
        nombre: dest.nombre,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return resultado;
}

export function buildSeguimientoResumen(resultado: SeguimientoResultado): string {
  const lineas: string[] = [];

  if (resultado.dryRun) {
    lineas.push("🔎 *Previsualización* (no se envió nada todavía)");
  } else {
    lineas.push("📤 Envío de seguimiento realizado");
  }

  lineas.push("");
  lineas.push(`Destinatarios que califican: ${resultado.destinatarios.length}`);
  for (const d of resultado.destinatarios.slice(0, 30)) {
    lineas.push(`• ${d.nombre} (${d.telefono})`);
  }
  if (resultado.destinatarios.length > 30) {
    lineas.push(`…y ${resultado.destinatarios.length - 30} más.`);
  }

  if (!resultado.dryRun) {
    lineas.push("");
    lineas.push(`Enviados OK: ${resultado.enviados}`);
    if (resultado.fallidos.length > 0) {
      lineas.push(`Fallidos: ${resultado.fallidos.length}`);
      for (const f of resultado.fallidos.slice(0, 10)) {
        lineas.push(`  ✗ ${f.nombre}: ${f.error}`);
      }
    }
  }

  if (resultado.omitidos.length > 0) {
    lineas.push("");
    lineas.push(`Omitidos: ${resultado.omitidos.length}`);
    for (const o of resultado.omitidos.slice(0, 15)) {
      lineas.push(`  – ${o.nombre}: ${o.motivo}`);
    }
  }

  if (resultado.dryRun) {
    lineas.push("");
    lineas.push(
      "Para enviar de verdad: cargá WHATSAPP_TEMPLATE_SEGUIMIENTO con el nombre de tu plantilla aprobada por Meta y tocá \"Enviar de verdad\"."
    );
  }

  return lineas.join("\n");
}
