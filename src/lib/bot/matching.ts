import type { Contacto } from "../domain/contactos";
import type { Propiedad } from "../domain/propiedades";
import { normalizeText } from "../text/normalize";

export type MatchResult<T> =
  | { type: "unico"; item: T }
  | { type: "ambiguo"; candidatos: T[] }
  | { type: "sin_match" };

function matchByField<T>(
  mencion: string | null,
  candidatos: T[],
  getField: (item: T) => string
): MatchResult<T> {
  if (!mencion) return { type: "sin_match" };
  const normalizedMencion = normalizeText(mencion);
  const matches = candidatos.filter((item) =>
    normalizeText(getField(item)).includes(normalizedMencion)
  );
  if (matches.length === 0) return { type: "sin_match" };
  if (matches.length === 1) return { type: "unico", item: matches[0] };
  return { type: "ambiguo", candidatos: matches };
}

export function matchContacto(
  nombreMencionado: string | null,
  candidatos: Contacto[]
): MatchResult<Contacto> {
  return matchByField(nombreMencionado, candidatos, (c) => c.nombre);
}

export function matchPropiedad(
  direccionMencionada: string | null,
  candidatos: Propiedad[]
): MatchResult<Propiedad> {
  return matchByField(direccionMencionada, candidatos, (p) => p.direccion);
}
