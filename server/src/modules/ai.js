export function getAiStatus() {
  return {
    enabled: true,
    message: "Yandex GPT uses per-user API key and folder settings"
  };
}

export async function generateChatResponse(messages, options = {}) {
  const apiKey = options.apiKey;
  const folderId = options.folderId;

  if (!apiKey || !folderId) {
    throw new Error("Yandex GPT is not configured");
  }

  const response = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Api-Key ${apiKey}`
    },
    body: JSON.stringify({
      modelUri: `gpt://${folderId}/yandexgpt/latest`,
      completionOptions: {
        stream: false,
        temperature: 0.6,
        maxTokens: "1000"
      },
      messages: messages // Ожидается массив объектов { role: "system"|"user"|"assistant", text: "..." }
    })
  });

  if (!response.ok) {
    await response.text().catch(() => "");
    throw new Error(`Yandex GPT API error: ${response.status}`);
  }

  const data = await response.json();
  return data.result.alternatives[0].message;
}
