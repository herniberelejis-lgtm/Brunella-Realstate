import { safeEqual } from "./safeEqual";

/**
 * Valida un header "Authorization: Basic ..." contra DASHBOARD_USER/DASHBOARD_PASSWORD.
 * Fail-closed: sin envs configuradas o sin header, siempre es false.
 */
export function checkDashboardCredentials(authHeader: string | null): boolean {
  if (!authHeader?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
  const [user, password] = decoded.split(":");
  return (
    safeEqual(user ?? "", process.env.DASHBOARD_USER ?? "") &&
    safeEqual(password ?? "", process.env.DASHBOARD_PASSWORD ?? "")
  );
}
