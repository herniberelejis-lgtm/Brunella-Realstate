import { NextRequest, NextResponse } from "next/server";
import { checkDashboardCredentials } from "./lib/security/dashboardCredentials";

const PUBLIC_PATHS = [
  "/api/telegram/webhook",
  "/api/cron/recordatorios",
  "/api/meta/webhook",
  "/api/whatsapp/webhook",
  "/formulario",
];

export function proxy(request: NextRequest) {
  if (PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (checkDashboardCredentials(request.headers.get("authorization"))) {
    return NextResponse.next();
  }

  return new NextResponse("Autenticación requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Segundo Cerebro"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
