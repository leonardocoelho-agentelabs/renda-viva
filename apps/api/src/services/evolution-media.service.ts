import { env } from "../env.js";

export interface MidiaWhatsApp {
  base64: string;
  mimetype: string;
}

export async function baixarMidiaWhatsApp(messageKey: any): Promise<MidiaWhatsApp | null> {
  try {
    const response = await fetch(
      `${env.EVOLUTION_URL}/chat/getBase64FromMediaMessage/${env.EVOLUTION_INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          message: { key: messageKey },
          convertToMp4: false,
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Evolution Media] Erro ao baixar mídia:", response.status, errorBody);
      return null;
    }

    const data = await response.json();
    return { base64: data.base64, mimetype: data.mimetype || "audio/ogg" };
  } catch (error: any) {
    console.error("[Evolution Media] Erro:", error.message);
    return null;
  }
}
