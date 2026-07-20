const GRAPH_API_VERSION = "v21.0";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function postToWhatsApp(body: Record<string, unknown>): Promise<void> {
  const token = requireEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID");
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`WhatsApp Cloud API request failed (${response.status})`);
  }
}

export async function sendWhatsAppText(to: string, text: string): Promise<void> {
  await postToWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption: string
): Promise<void> {
  await postToWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "image",
    image: { link: imageUrl, caption },
  });
}

/**
 * Envía un mensaje de PLANTILLA (template) pre-aprobada por Meta. Es la única forma de
 * escribirle primero a alguien que no nos escribió en las últimas 24h — el caso del envío
 * masivo de seguimiento a la cartera migrada de WhatsApp.
 *
 * `bodyParams` rellena las variables {{1}}, {{2}}, ... del cuerpo de la plantilla, en orden.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[] = []
): Promise<void> {
  const template: Record<string, unknown> = {
    name: templateName,
    language: { code: languageCode },
  };
  if (bodyParams.length > 0) {
    template.components = [
      {
        type: "body",
        parameters: bodyParams.map((text) => ({ type: "text", text })),
      },
    ];
  }
  await postToWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template,
  });
}

export { verifyChallenge, verifySignature } from "@/lib/meta/webhookVerification";
