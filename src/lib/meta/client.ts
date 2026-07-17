const GRAPH_API_VERSION = "v21.0";

function requireToken(envVar: string): string {
  const token = process.env[envVar];
  if (!token) throw new Error(`${envVar} is not set`);
  return token;
}

async function sendGraphMessage(
  recipientId: string,
  text: string,
  accessTokenEnvVar: string
): Promise<void> {
  const token = requireToken(accessTokenEnvVar);
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });
  if (!response.ok) {
    throw new Error(`Graph API sendMessage failed (${response.status})`);
  }
}

export async function sendMessengerMessage(psid: string, text: string): Promise<void> {
  return sendGraphMessage(psid, text, "MESSENGER_PAGE_ACCESS_TOKEN");
}

export async function sendInstagramMessage(igsid: string, text: string): Promise<void> {
  return sendGraphMessage(igsid, text, "INSTAGRAM_ACCESS_TOKEN");
}
