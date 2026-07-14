"use server";

import { redirect } from "next/navigation";
import { getDomainModules } from "@/lib/domain/factory";
import { parsePropiedadUpdate } from "@/lib/view/propiedadForm";

export async function updatePropiedadAction(id: string, formData: FormData): Promise<void> {
  const result = parsePropiedadUpdate(formData);
  if (!result.success) {
    redirect(`/propiedades/${id}/editar?error=1`);
  }

  const { propiedades } = getDomainModules();
  await propiedades.update(id, result.data);

  redirect(`/propiedades/${id}`);
}
