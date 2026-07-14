import { z } from "zod";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const propiedadUpdateSchema = z.object({
  direccion: z.string().trim().min(1, "La dirección es obligatoria"),
  tipo_propiedad: z.enum(["Departamento", "Casa", "Lote", "Local/Oficina"]),
  descripcion: z.preprocess(blankToNull, z.string().nullable()),
  precio: z.preprocess(
    blankToNull,
    z.union([z.null(), z.coerce.number({ error: "El precio debe ser un número" })])
  ),
  condiciones: z.preprocess(blankToNull, z.string().nullable()),
  estado: z.enum(["Activa", "Vendida", "Retirada"]),
  imagenes: z.preprocess(blankToNull, z.string().nullable()),
});

export type PropiedadUpdate = z.infer<typeof propiedadUpdateSchema>;

export function parsePropiedadUpdate(
  formData: FormData
): { success: true; data: PropiedadUpdate } | { success: false; error: string } {
  const raw = Object.fromEntries(formData.entries());
  const result = propiedadUpdateSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos" };
  }
  return { success: true, data: result.data };
}
