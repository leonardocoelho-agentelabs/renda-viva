import { env } from "../env.js";

const EVOLUTION_URL = env.EVOLUTION_URL;
const EVOLUTION_INSTANCE = env.EVOLUTION_INSTANCE;
const EVOLUTION_API_KEY = env.EVOLUTION_API_KEY;

// Garante formato internacional só com dígitos (sem +, espaços, etc.)
export function formatarNumero(numero: string): string {
  return numero.replace(/\D/g, "");
}

export async function enviarMensagemWhatsApp(
  numero: string,
  mensagem: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: formatarNumero(numero),
          text: mensagem,
        }),
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("[WhatsApp] Erro ao enviar mensagem:", data);
      return false;
    }

    console.log("[WhatsApp] Mensagem enviada para", numero);
    return true;
  } catch (error) {
    console.error(
      "[WhatsApp] Erro:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}
