// Placeholder for Task 14 of the Fase 2 plan (docs/superpowers/plans/2026-07-15-fase2-intake-clientes.md).
// Task 10's webhook route imports this so it can compile and its tests (which mock this
// module entirely) can resolve it. Task 14 replaces this file with the real implementation:
// look up the Busqueda, run the matching engine, send the compatibility document over
// WhatsApp, and mark documento_enviado.
export async function enviarDocumentoAprobado(_busquedaId: string): Promise<void> {
  throw new Error("enviarDocumentoAprobado not yet implemented — see Task 14");
}
