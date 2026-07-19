import { z } from "zod";

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const optionalNumber = z.preprocess(
  blankToNull,
  z.coerce.number().nullable().default(null)
);

const TIPOS_PROPIEDAD = ["Departamento", "Casa", "PH", "Lote", "Local/Oficina"] as const;

export const CARACTERISTICAS_OPCIONES = [
  { value: "garage", label: "Garage" },
  { value: "jardin", label: "Jardín" },
  { value: "pileta", label: "Pileta" },
  { value: "parrilla", label: "Parrilla" },
  { value: "balcon", label: "Balcón" },
  { value: "amenities", label: "Amenities" },
  { value: "seguridad_24h", label: "Seguridad 24h" },
  { value: "planta_baja", label: "Planta baja" },
] as const;

const optionalEmail = z.preprocess(blankToNull, z.string().trim().email().nullable().default(null));

const compradorSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  telefono: z.string().trim().min(6, "El WhatsApp es obligatorio"),
  email: optionalEmail,
  tipo_operacion: z.enum(["Compra", "Alquiler", "Inversion"]),
  tipo_propiedad: z.enum(TIPOS_PROPIEDAD),
  zona: z.preprocess(blankToNull, z.string().nullable().default(null)),
  presupuesto_min: optionalNumber,
  presupuesto_max: optionalNumber,
  moneda: z.preprocess(blankToNull, z.enum(["ARS", "USD"]).nullable().default(null)),
  dormitorios: optionalNumber,
  ambientes: optionalNumber,
  banos: optionalNumber,
  caracteristicas: z.array(z.string()).default([]),
  otros_requisitos: z.preprocess(blankToNull, z.string().nullable().default(null)),
});

const propietarioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  telefono: z.string().trim().min(6, "El WhatsApp es obligatorio"),
  email: optionalEmail,
  que_quiere_hacer: z.enum(["Vender", "Alquilar", "Alquiler temporario"]),
  direccion: z.string().trim().min(1, "La dirección es obligatoria"),
  tipo_propiedad: z.enum(TIPOS_PROPIEDAD),
  precio: optionalNumber,
  moneda: z.preprocess(blankToNull, z.enum(["ARS", "USD"]).nullable().default(null)),
  descripcion: z.preprocess(blankToNull, z.string().nullable().default(null)),
});

export type CompradorFormData = z.infer<typeof compradorSchema>;
export type PropietarioFormData = z.infer<typeof propietarioSchema>;

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  raw: Record<string, unknown>
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Datos inválidos" };
  }
  return { success: true, data: result.data };
}

export function parseCompradorForm(formData: FormData) {
  const raw = {
    ...Object.fromEntries(formData.entries()),
    caracteristicas: formData.getAll("caracteristicas"),
  };
  return parseWithSchema(compradorSchema, raw);
}

export function parsePropietarioForm(formData: FormData) {
  return parseWithSchema(propietarioSchema, Object.fromEntries(formData.entries()));
}
