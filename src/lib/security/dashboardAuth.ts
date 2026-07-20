import { headers } from "next/headers";
import { checkDashboardCredentials } from "./dashboardCredentials";

/**
 * Guarda de auth para Server Actions del dashboard. El proxy protege por path, pero una
 * Server Action es un endpoint global de Next: se puede invocar con el header Next-Action
 * desde cualquier ruta, incluidas las públicas (/formulario) que el proxy deja pasar.
 * Por eso cada action mutante del dashboard tiene que validar las credenciales por sí misma.
 */
export async function requireDashboardAuth(): Promise<void> {
  const authHeader = (await headers()).get("authorization");
  if (!checkDashboardCredentials(authHeader)) {
    throw new Error("No autorizado");
  }
}
