import { NextResponse } from "next/server";

type Provider = "openai" | "anthropic" | "gemini";

function invalid(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: { provider?: Provider; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return invalid("Invalid model request.");
  }

  if (!body.apiKey?.trim() || !body.provider || !["openai", "anthropic", "gemini"].includes(body.provider)) {
    return invalid("Choose a provider and enter its API key.");
  }

  try {
    const models = await listModels(body.provider, body.apiKey.trim());
    return NextResponse.json({ models: [...new Set(models)].sort() });
  } catch (cause) {
    return invalid(cause instanceof Error ? cause.message : "Could not load provider models.", 503);
  }
}

async function listModels(provider: Provider, apiKey: string): Promise<string[]> {
  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "OpenAI rejected this API key.");
    return payload.data?.map((model: { id: string }) => model.id) ?? [];
  }

  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/models?limit=1000", { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "Anthropic rejected this API key.");
    return payload.data?.map((model: { id: string }) => model.id) ?? [];
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? "Google Gemini rejected this API key.");
  return payload.models?.map((model: { name: string }) => model.name.replace(/^models\//, "")) ?? [];
}
