import { env } from "../env.js";

export async function transcreverAudio(base64Audio: string, mimetype: string): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64Audio, "base64");

    const ext =
      mimetype.includes("ogg") ? "ogg"
      : mimetype.includes("mp4") ? "mp4"
      : mimetype.includes("mpeg") ? "mp3"
      : "ogg";

    const formData = new FormData();
    formData.append("file", new Blob([buffer]), `audio.${ext}`);
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Whisper] Erro na transcrição:", response.status, errorBody);
      return null;
    }

    const data = await response.json();
    return data.text?.trim() || null;
  } catch (error: any) {
    console.error("[Whisper] Erro:", error.message);
    return null;
  }
}
