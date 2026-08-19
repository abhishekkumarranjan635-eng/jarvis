import { NextResponse } from "next/server";

type Provider = "openai" | "anthropic" | "gemini";

const systemPrompt = "You are Jarvis, Abhishek's personal AI assistant. Be calm, efficient, concise, and truthful about actions you cannot perform.";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: { provider?: Provider; message?: string; apiKey?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return error("Invalid chat request.", 400);
  }

  if (!body.message?.trim() || !body.provider || !["openai", "anthropic", "gemini"].includes(body.provider)) {
    return error("Choose a connector and enter a message.", 400);
  }

  try {
    const reply = await requestProvider(body.provider, body.message.trim(), body.apiKey, body.model);
    return NextResponse.json({ reply });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "The AI connector could not be reached.";
    return error(message, 503);
  }
}

async function requestProvider(provider: Provider, message: string, sessionKey?: string, requestedModel?: string) {
  const model = requestedModel?.trim();
  if (model && !/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error("The model ID contains unsupported characters.");
  if (provider === "openai") {
    const key = sessionKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OpenAI is not connected. Add OPENAI_API_KEY to the server environment.");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: model || process.env.OPENAI_MODEL || "gpt-4.1-mini", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: message }] }),
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
      body: JSON.stringify({ model: model || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514", max_tokens: 700, system: systemPrompt, messages: [{ role: "user", content: message }] }),
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
    body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: "user", parts: [{ text: message }] }] }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? "Gemini could not complete the request.");
  return payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "Gemini returned no response.";
}
