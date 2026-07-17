import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { verifyChallenge, verifySignature } from "@/lib/meta/webhookVerification";
import { sendMessengerMessage, sendInstagramMessage } from "@/lib/meta/client";
import { getDomainModules } from "@/lib/domain/factory";

const metaEventSchema = z.object({
  object: z.enum(["page", "instagram"]),
  entry: z.array(
    z.object({
      messaging: z
        .array(
          z.object({
            sender: z.object({ id: z.string() }),
            referral: z.object({ ref: z.string() }).optional(),
          })
        )
        .optional(),
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
  if (!challenge) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const parsed = metaEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const { leadsPendientes } = getDomainModules();
  const canal = parsed.data.object === "page" ? "Facebook" : "Instagram";
  const baseUrl = process.env.APP_BASE_URL ?? "";

  for (const entry of parsed.data.entry) {
    for (const event of entry.messaging ?? []) {
      const token = randomUUID();
      await leadsPendientes.create({
        token,
        canal,
        psid: event.sender.id,
        codigo_propiedad: event.referral?.ref ?? null,
      });

      const link = `${baseUrl}/formulario?t=${token}`;
      const text = `¡Hola! Contame lo que buscás (o la propiedad que querés publicar) acá: ${link}`;

      if (canal === "Facebook") {
        await sendMessengerMessage(event.sender.id, text);
      } else {
        await sendInstagramMessage(event.sender.id, text);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
