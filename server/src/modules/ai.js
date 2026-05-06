import { config } from "../config.js";

export function getAiStatus() {
  const isConfigured = Boolean(config.yandexApiKey && config.yandexFolderId);
  
  return {
    enabled: isConfigured,
    message: isConfigured ? "Yandex GPT is ready" : "Yandex GPT API is not configured (.env missing keys)"
  };
}

export async function generateChatResponse(messages) {
  if (!config.yandexApiKey || !config.yandexFolderId) {
    throw new Error("Yandex GPT is not configured");
  }

  const response = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Api-Key ${config.yandexApiKey}`
    },
    body: JSON.stringify({
      modelUri: `gpt://${config.yandexFolderId}/yandexgpt/latest`,
      completionOptions: {
        stream: false,
        temperature: 0.6,
        maxTokens: "1000"
      },
      messages: messages // Ожидается массив объектов { role: "system"|"user"|"assistant", text: "..." }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Yandex GPT API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.result.alternatives[0].message;
}
