import { NextResponse } from "next/server";

type Provider = "local" | "openai" | "anthropic" | "gemini";
type ExternalProvider = Exclude<Provider, "local">;
type ChatMessage = { role: "user" | "assistant"; text: string };
type SearchTopic = { Text?: string; FirstURL?: string; Topics?: SearchTopic[] };
type SearchResponse = { AbstractText?: string; AbstractSource?: string; AbstractURL?: string; RelatedTopics?: SearchTopic[] };

const systemPrompt = "You are Jarvis, Abhishek's personal AI assistant. Follow the user's instruction directly and answer the request, rather than offering generic next steps. Use the conversation context when relevant. Be concise, accurate, and truthful about capabilities or unavailable live data. Ask one focused question only when essential information is missing. When research is provided, base the answer on it, mention the source naturally, and do not claim to have accessed private apps or websites.";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: { provider?: Provider; backingProvider?: ExternalProvider; message?: string; messages?: ChatMessage[]; apiKey?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return error("Invalid chat request.", 400);
  }

  if (!body.message?.trim() || !body.provider || !["local", "openai", "anthropic", "gemini"].includes(body.provider)) {
    return error("Choose a connector and enter a message.", 400);
  }
  if (body.backingProvider && !["openai", "anthropic", "gemini"].includes(body.backingProvider)) {
    return error("Choose a valid AI provider.", 400);
  }

  try {
    const history = body.messages?.filter((item): item is ChatMessage =>
      (item.role === "user" || item.role === "assistant") && typeof item.text === "string" && item.text.trim().length > 0,
    ).slice(-12);
    const { reply, sources } = await requestProvider(body.provider, body.message.trim(), history, body.apiKey, body.model, body.backingProvider);
    return NextResponse.json({ reply, sources });
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

function collectTopics(topics: SearchTopic[] | undefined, results: SearchTopic[] = []): SearchTopic[] {
  for (const topic of topics ?? []) {
    if (topic.Text && topic.FirstURL) results.push(topic);
    if (topic.Topics) collectTopics(topic.Topics, results);
    if (results.length >= 4) break;
  }
  return results;
}

async function researchWeb(query: string): Promise<{ facts: string; sources: string[] } | null> {
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const result = await response.json() as SearchResponse;
    const topics = collectTopics(result.RelatedTopics);
    const entries: { text: string; url: string }[] = [];
    if (result.AbstractText && result.AbstractURL) entries.push({ text: result.AbstractText, url: result.AbstractURL });
    for (const topic of topics) if (topic.Text && topic.FirstURL) entries.push({ text: topic.Text, url: topic.FirstURL });
    if (!entries.length) return null;
    return {
      facts: entries.map((entry) => `- ${entry.text}\n  Source: ${entry.url}`).join("\n"),
      sources: entries.map((entry) => entry.url),
    };
  } catch {
    return null;
  }
}

async function requestProvider(provider: Provider, message: string, history: ChatMessage[] | undefined, sessionKey?: string, requestedModel?: string, backingProvider?: ExternalProvider): Promise<{ reply: string; sources: string[] }> {
  if (provider === "local") {
    const configuredProvider = backingProvider ?? defaultProvider();
    const research = await researchWeb(message);
    if (!configuredProvider) {
      if (research) {
        const summary = research.facts.split("\n").filter((line) => line.startsWith("- ")).map((line) => line.replace(/^-\s*/, "").trim()).join(" ");
        return { reply: summary || "Here is what I found online.", sources: research.sources };
      }
      return { reply: "I could not find reliable public web information for that request right now. Try adding a little more detail to the instruction.", sources: [] };
    }
    const researchedMessage = research ? `${message}\n\nWeb research collected before answering:\n${research.facts}\n\nUse this research when relevant, cite the source URLs naturally, and do not claim to have accessed private apps or websites.` : message;
    const reply = await requestExternalProvider(configuredProvider, researchedMessage, history, sessionKey, requestedModel);
    return { reply, sources: research?.sources ?? [] };
  }
  const reply = await requestExternalProvider(provider, message, history, sessionKey, requestedModel);
  return { reply, sources: [] };
}

async function requestExternalProvider(provider: Exclude<Provider, "local">, message: string, history: ChatMessage[] | undefined, sessionKey?: string, requestedModel?: string) {
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
