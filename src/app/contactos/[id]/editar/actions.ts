"use server";

import { redirect } from "next/navigation";
import { getDomainModules } from "@/lib/domain/factory";
import { parseContactoUpdate } from "@/lib/view/contactoForm";

export async function updateContactoAction(id: string, formData: FormData): Promise<void> {
  const result = parseContactoUpdate(formData);
  if (!result.success) {
    // Form fields are constrained to valid values (selects, required text), so a real user
    // filling out the rendered form can't hit this — it only guards against a malformed
    // direct POST. Redirect back to the same edit page rather than crashing.
    redirect(`/contactos/${id}/editar?error=1`);
  }

  const { contactos } = getDomainModules();
  await contactos.update(id, result.data);

  redirect(`/contactos/${id}`);
}
