import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { verifyChallenge, verifySignature } from "@/lib/whatsapp/client";
import { getDomainModules } from "@/lib/domain/factory";
import { enviarDocumentoAprobado } from "@/lib/bot/enviarDocumentoAprobado";

const whatsappEventSchema = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            messages: z
              .array(z.object({ from: z.string() }))
              .optional(),
          }),
        })
      ),
    })
  ),
});

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const challenge = verifyChallenge(
    searchParams.get("hub.mode"),
    searchParams.get("hub.verify_token"),
    searchParams.get("hub.challenge")
  );
  if (!challenge) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const parsed = whatsappEventSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const { contactos, busquedas } = getDomainModules();

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      for (const message of change.value.messages ?? []) {
        const contacto = await contactos.findByTelefono(message.from);
        if (!contacto) continue;

        await contactos.marcarWhatsappConfirmado(contacto.id);

        const pendiente = await busquedas.findPendienteAprobadoByContactoId(contacto.id);
        if (pendiente) {
          await enviarDocumentoAprobado(pendiente.id);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
