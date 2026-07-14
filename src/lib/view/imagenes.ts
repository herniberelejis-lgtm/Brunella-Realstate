export function parseImagenes(imagenes: string | null): string[] {
  if (!imagenes) return [];
  return imagenes
    .split("\n")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
}
