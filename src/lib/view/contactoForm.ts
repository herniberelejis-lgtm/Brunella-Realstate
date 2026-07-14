import { z } from "zod";

const contactoUpdateSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  telefono: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().nullable()
  ),
  email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().nullable()
  ),
  fuente: z.enum(["Instagram", "Facebook", "Zonaprop", "Grupo Banker", "Referido", "Otro"]),
  tipo: z.enum(["Comprador", "Propietario", "Ambos"]),
  etapa: z.enum([
    "Nuevo",
    "Calificando",
    "Buscando",
    "Mostrando propiedades",
    "Negociando",
    "Cerrado-ganado",
    "Cerrado-perdido",
    "Inactivo",
  ]),
  temperatura: z.enum(["Frio", "Tibio", "Caliente"]),
});

export type ContactoUpdate = z.infer<typeof contactoUpdateSchema>;

export function parseContactoUpdate(
  formData: FormData
): { success: true; data: ContactoUpdate } | { success: false; error: string } {
  const raw = Object.fromEntries(formData.entries());
  const result = contactoUpdateSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos" };
  }
  return { success: true, data: result.data };
}
