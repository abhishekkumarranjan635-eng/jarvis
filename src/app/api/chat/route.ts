import { NextResponse } from "next/server";

type Provider = "local" | "openai" | "anthropic" | "gemini";
type ChatMessage = { role: "user" | "assistant"; text: string };

const systemPrompt = "You are Jarvis, Abhishek's personal AI assistant. Follow the user's instruction directly and answer the request, rather than offering generic next steps. Use the conversation context when relevant. Be concise, accurate, and truthful about capabilities or unavailable live data. Ask one focused question only when essential information is missing.";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: { provider?: Provider; message?: string; messages?: ChatMessage[]; apiKey?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return error("Invalid chat request.", 400);
  }

  if (!body.message?.trim() || !body.provider || !["local", "openai", "anthropic", "gemini"].includes(body.provider)) {
    return error("Choose a connector and enter a message.", 400);
  }

  try {
    const history = body.messages?.filter((item): item is ChatMessage =>
      (item.role === "user" || item.role === "assistant") && typeof item.text === "string" && item.text.trim().length > 0,
    ).slice(-12);
    const reply = await requestProvider(body.provider, body.message.trim(), history, body.apiKey, body.model);
    return NextResponse.json({ reply });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The AI connector could not be reached.";
    return error(message, 503);
  }
}

function defaultProvider(): Exclude<Provider, "local"> | null {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

async function requestProvider(provider: Provider, message: string, history: ChatMessage[] | undefined, sessionKey?: string, requestedModel?: string) {
  if (provider === "local") {
    const configuredProvider = defaultProvider();
    if (!configuredProvider) throw new Error("Connect an AI provider with an API key to receive accurate answers. Open the model menu and choose OpenAI, Anthropic, or Google Gemini.");
    return requestProvider(configuredProvider, message, history, undefined, undefined);
  }
  const model = requestedModel?.trim();
  if (model && !/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error("The model ID contains unsupported characters.");
  if (provider === "openai") {
    const key = sessionKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OpenAI is not connected. Add OPENAI_API_KEY to the server environment.");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: model || process.env.OPENAI_MODEL || "gpt-4.1-mini", messages: [{ role: "system", content: systemPrompt }, ...(history ?? []).map((item) => ({ role: item.role, content: item.text })), { role: "user", content: message }] }),
    });
    const payload = await response.json();
    if (!response.ok) {
      if (payload.error?.code === "insufficient_quota" || /quota|billing/i.test(payload.error?.message ?? "")) {
        throw new Error("OpenAI accepted the API key, but this account has no available API quota. Add billing or credits in the OpenAI Platform account, then try again. A ChatGPT subscription does not include API usage.");
      }
      throw new Error(payload.error?.message ?? "OpenAI could not complete the request.");
    }
    return payload.choices?.[0]?.message?.content ?? "OpenAI returned no response.";
  }

  if (provider === "anthropic") {
    const key = sessionKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("Anthropic is not connected. Add ANTHROPIC_API_KEY to the server environment.");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: model || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514", max_tokens: 700, system: systemPrompt, messages: [...(history ?? []).map((item) => ({ role: item.role, content: item.text })), { role: "user", content: message }] }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "Anthropic could not complete the request.");
    return payload.content?.[0]?.text ?? "Claude returned no response.";
  }

  const key = sessionKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Google Gemini is not connected. Add GEMINI_API_KEY to the server environment.");
  const geminiModel = model || process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [...(history ?? []).map((item) => ({ role: item.role === "assistant" ? "model" : "user", parts: [{ text: item.text }] })), { role: "user", parts: [{ text: message }] }] }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? "Gemini could not complete the request.");
  return payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "Gemini returned no response.";
}
