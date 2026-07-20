"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDomainModules } from "@/lib/domain/factory";
import { generateCodigoPropiedad } from "@/lib/domain/codigoPropiedad";
import { parsePropiedadUpdate } from "@/lib/view/propiedadForm";
import { requireDashboardAuth } from "@/lib/security/dashboardAuth";

export async function updatePropiedadAction(id: string, formData: FormData): Promise<void> {
  await requireDashboardAuth();
  const result = parsePropiedadUpdate(formData);
  if (!result.success) {
    redirect(`/propiedades/${id}/editar?error=1`);
  }

  const { propiedades } = getDomainModules();
  await propiedades.update(id, result.data);

  redirect(`/propiedades/${id}`);
}

export async function generarCodigoAction(id: string): Promise<void> {
  await requireDashboardAuth();
  const { propiedades } = getDomainModules();
  await propiedades.update(id, { codigo: generateCodigoPropiedad() });
  revalidatePath(`/propiedades/${id}`);
}
