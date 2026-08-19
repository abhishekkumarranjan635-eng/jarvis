"use client";

import { useRef, useState } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Clock3,
  Cpu,
  FileText,
  Globe2,
  Menu,
  Mic,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";

const models = [
  { id: "local", label: "Jarvis local", detail: "Built-in preview assistant", ready: true },
  { id: "openai", label: "OpenAI", detail: "GPT and Codex models", ready: false },
  { id: "anthropic", label: "Anthropic", detail: "Claude models", ready: false },
  { id: "gemini", label: "Google Gemini", detail: "Gemini Pro models", ready: false },
] as const;

type ModelId = (typeof models)[number]["id"];

const defaultProviderModels: Record<Exclude<ModelId, "local">, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-sonnet-4-20250514",
  gemini: "gemini-2.5-flash",
};

type SessionConnector = { apiKey: string; model: string };

const apiKeyLinks: Record<Exclude<ModelId, "local">, string> = {
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  gemini: "https://aistudio.google.com/apikey",
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const suggestions = [
  { icon: Globe2, title: "Plan my day", detail: "Review calendar, tasks & weather" },
  { icon: FileText, title: "Summarize notes", detail: "Turn recent notes into highlights" },
  { icon: Search, title: "Research anything", detail: "Search the web with cited sources" },
];

const recent = ["Monday planning", "Flight options to Tokyo", "Project Luna notes"];

const recentConversations: Record<string, ChatMessage[]> = {
  "Monday planning": [
    { role: "user", text: "Help me organize Monday." },
    { role: "assistant", text: "Your Monday plan is ready: prioritize the morning deep-work block, review priorities before lunch, and reserve the afternoon for follow-ups." },
  ],
  "Flight options to Tokyo": [
    { role: "user", text: "Find flight options to Tokyo." },
    { role: "assistant", text: "I do not have live booking access in this preview. I can compare options if you share dates, departure city, and a few flight links." },
  ],
  "Project Luna notes": [
    { role: "user", text: "Summarize the Project Luna notes." },
    { role: "assistant", text: "The notes are not connected to this preview. Paste them here and I will extract decisions, action items, and open questions." },
  ],
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  sources?: string[];
};

function linkifyText(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((part, index) => /^https?:\/\//.test(part)
    ? <a key={`link-${index}`} href={part} target="_blank" rel="noreferrer">{part}</a>
    : <span key={`text-${index}`}>{part}</span>,
  );
}

type SystemIntent =
  | { kind: "system"; action: "on" | "off"; target: string }
  | { kind: "files"; action: "list" | "read"; path: string }
  | { kind: "open-url"; url: string };

function detectIntent(prompt: string): SystemIntent | null {
  const lower = prompt.toLowerCase().trim();
  if (/^https?:\/\/\S+$/.test(prompt.trim())) return { kind: "open-url", url: prompt.trim() };

  const actionMatch = lower.match(/\b(open|launch|start|turn on|switch on|power on|close|quit|stop|turn off|switch off|power off|shut down|kill)\b/);
  const targetMatch = lower.match(/\b(chrome|google chrome|browser|edge|safari|firefox|terminal|cmd|command line|code|vscode|visual studio code|spotify|slack|calculator|calc|notes|notepad|excel|word|powerpoint|figma|discord|telegram|whatsapp|gmail|mail|maps|music|vlc|zoom|teams|photos|screenshot|settings|file explorer|finder|app)\b/);
  if (actionMatch && targetMatch) {
    const action = /\b(open|launch|start|turn on|switch on|power on)\b/.test(actionMatch[0]) ? "on" : "off";
    return { kind: "system", action, target: targetMatch[0] };
  }

  if (/^(on|off)\b/.test(lower) && targetMatch) {
    return { kind: "system", action: lower.startsWith("on") ? "on" : "off", target: targetMatch[0] };
  }

  if (/\b(list|show)\b.*\b(folder|directory|files|contents)\b/.test(lower)) {
    const pathMatch = prompt.match(/(?:in|of|at|for)?\s*([/~][^\s]+|[A-Za-z]:\\[^\s]+|\.{1,2}[\\/][^\s]*)/);
    return { kind: "files", action: "list", path: pathMatch?.[1] ?? "~" };
  }
  if (/\b(read|cat|show|preview)\b.*\b(file|contents)\b/.test(lower)) {
    const pathMatch = prompt.match(/([/~][^\s]+|[A-Za-z]:\\[^\s]+|\.{1,2}[\\/][^\s]*)/);
    if (pathMatch) return { kind: "files", action: "read", path: pathMatch[1] };
  }
  return null;
}

export default function Home() {
  const [message, setMessage] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Voice ready");
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeRecent, setActiveRecent] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelId>("local");
  const [localConnector, setLocalConnector] = useState<Exclude<ModelId, "local"> | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [connectorModel, setConnectorModel] = useState<Exclude<ModelId, "local"> | null>(null);
  const [connectorKey, setConnectorKey] = useState("");
  const [connectorVersion, setConnectorVersion] = useState("");
  const [sessionConnectors, setSessionConnectors] = useState<Partial<Record<ModelId, SessionConnector>>>({});
  const [connectorError, setConnectorError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  function submitMessage(text = message) {
    const prompt = text.trim();
    if (!prompt || isThinking) return;
    setMessages((current) => [...current, { role: "user", text: prompt }]);
    setMessage("");
    setIsThinking(true);

    const intent = detectIntent(prompt);
    if (intent?.kind === "open-url") {
      window.open(intent.url, "_blank", "noopener,noreferrer");
      setMessages((current) => [...current, { role: "assistant", text: `Opening ${intent.url} in a new tab.` }]);
      setIsThinking(false);
      return;
    }
    if (intent?.kind === "system") {
      void fetch("/api/system", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: intent.action, target: intent.target }) })
        .then(async (response) => {
          const body = await response.json() as { status?: string; error?: string; target?: string };
          if (!response.ok) throw new Error(body.error ?? "The system command could not be run.");
          return body;
        })
        .then((result) => setMessages((current) => [...current, { role: "assistant", text: `${intent.action === "on" ? "Opening" : "Closing"} ${result.target ?? intent.target} on your computer.` }]))
        .catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : "The system command could not be run.";
          setMessages((current) => [...current, { role: "assistant", text: detail }]);
        })
        .finally(() => setIsThinking(false));
      return;
    }
    if (intent?.kind === "files") {
      void fetch("/api/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: intent.action, path: intent.path }) })
        .then(async (response) => {
          const body = await response.json() as { entries?: { name: string; kind: string }[]; text?: string; path?: string; error?: string };
          if (!response.ok) throw new Error(body.error ?? "Could not access the requested path.");
          return body;
        })
        .then((body) => {
          if (intent.action === "list") {
            const list = (body.entries ?? []).map((entry) => `- ${entry.name}${entry.kind === "directory" ? "/" : ""}`).join("\n");
            const text = list ? `Contents of ${body.path}:\n${list}` : `${body.path} is empty.`;
            setMessages((current) => [...current, { role: "assistant", text }]);
            return;
          }
          const preview = (body.text ?? "").slice(0, 2000);
          setMessages((current) => [...current, { role: "assistant", text: `${body.path}:\n${preview}` }]);
        })
        .catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : "Could not access the requested path.";
          setMessages((current) => [...current, { role: "assistant", text: detail }]);
        })
        .finally(() => setIsThinking(false));
      return;
    }

    void fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: selectedModel,
        backingProvider: selectedModel === "local" ? localConnector ?? undefined : undefined,
        message: prompt,
        messages,
        apiKey: selectedModel === "local" && localConnector ? sessionConnectors[localConnector]?.apiKey : sessionConnectors[selectedModel]?.apiKey,
        model: selectedModel === "local" && localConnector ? sessionConnectors[localConnector]?.model : sessionConnectors[selectedModel]?.model,
      }),
    })
      .then(async (response) => {
        const body = await response.json() as { reply?: string; sources?: string[]; error?: string };
        if (!response.ok || !body.reply) throw new Error(body.error ?? "The provider did not return a response.");
        return { text: body.reply, sources: body.sources ?? [] };
      })
      .then((reply) => setMessages((current) => [...current, { role: "assistant", text: reply.text, sources: reply.sources }]))
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : "The provider could not be reached.";
        setMessages((current) => [...current, { role: "assistant", text: detail }]);
      })
      .finally(() => setIsThinking(false));
  }

  function openRecent(item: string) {
    setActiveRecent(item);
    setMessages(recentConversations[item]);
    setMessage("");
    setIsThinking(false);
    setMenuOpen(false);
  }

  function startNewConversation() {
    setActiveRecent(null);
    setMessages([]);
    setMessage("");
    setMenuOpen(false);
  }

  function selectConnector(model: ModelId) {
    if (model === "local") {
      setSelectedModel(model);
      setModelMenuOpen(false);
      return;
    }
    setConnectorModel(model);
    setConnectorKey(sessionConnectors[model]?.apiKey ?? "");
    setConnectorVersion(sessionConnectors[model]?.model ?? defaultProviderModels[model]);
    setConnectorError("");
    setModelMenuOpen(false);
  }

  async function connectProvider() {
    if (!connectorModel || !connectorKey.trim()) return;
    setIsConnecting(true);
    setConnectorError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: connectorModel, apiKey: connectorKey.trim(), model: connectorVersion.trim(), message: "Reply with exactly the word connected." }),
      });
      const body = await response.json() as { reply?: string; error?: string };
      if (!response.ok || !body.reply) throw new Error(body.error ?? "The provider rejected this API key.");
      setSessionConnectors((connectors) => ({ ...connectors, [connectorModel]: { apiKey: connectorKey.trim(), model: connectorVersion.trim() } }));
      setLocalConnector(connectorModel);
      setSelectedModel("local");
      setConnectorModel(null);
      setConnectorKey("");
      setConnectorVersion("");
    } catch (error: unknown) {
      setConnectorError(error instanceof Error ? error.message : "The provider could not validate this API key.");
    } finally {
      setIsConnecting(false);
    }
  }

  function toggleVoiceCommand() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("Voice commands are not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript?.trim();
      if (!transcript) return;
      setMessage(transcript);
      setVoiceStatus("Command received");
      submitMessage(transcript);
    };
    recognition.onerror = (event) => {
      const errors: Record<string, string> = {
        "not-allowed": "Microphone permission was denied",
        "no-speech": "No speech detected. Try again.",
        "network": "Voice recognition needs an internet connection",
      };
      setVoiceStatus(errors[event.error] ?? "Voice command could not be recognized");
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setListening(true);
    setVoiceStatus("Listening...");
    recognition.start();
  }

  return (
    <main className="jarvis-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="mark"><Sparkles size={16} strokeWidth={2.4} /></div>
          <span>jarvis</span>
          <button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <button className="new-chat" onClick={startNewConversation}><Plus size={17} /> New conversation</button>
        <nav className="history" aria-label="Conversation history">
          <p>RECENT</p>
          {recent.map((item) => <button key={item} onClick={() => openRecent(item)} className={activeRecent === item ? "active" : ""}><Clock3 size={15} />{item}</button>)}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar">A</div>
          <div><strong>Abhishek</strong><span>Personal workspace</span></div>
          <MoreHorizontal size={18} />
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="topbar-title"><span>{activeRecent ?? "New conversation"}</span><ChevronDown size={15} /></div>
          <div className="model-switcher">
            <button className="model-trigger" onClick={() => setModelMenuOpen((open) => !open)} aria-expanded={modelMenuOpen}>
              <Cpu size={15} /><span>{selectedModel === "local" && localConnector ? `Jarvis local (${models.find((model) => model.id === localConnector)?.label})` : models.find((model) => model.id === selectedModel)?.label}</span><ChevronDown size={14} />
            </button>
            {modelMenuOpen && <div className="model-menu">
              <p>AI CONNECTORS</p>
              {models.map((model) => <button key={model.id} className={selectedModel === model.id ? "selected" : ""} onClick={() => selectConnector(model.id)}>
                <span><strong>{model.label}</strong><small>{model.detail}</small></span>{selectedModel === model.id ? <Check size={15} /> : <em>{model.ready ? "Ready" : sessionConnectors[model.id] ? "Connected" : "API key"}</em>}
              </button>)}
              <div className="model-note">Providers use your own authorized API access.</div>
            </div>}
          </div>
          <div className="mode"><span className="mode-dot" />All systems operational</div>
        </header>

        <div className="conversation">
          {messages.length === 0 ? <>
            <div className="welcome">
              <div className="orb-wrap"><div className="orb"><span /></div></div>
              <p className="eyebrow">YOUR PERSONAL INTELLIGENCE</p>
              <h1>Good morning, Abhishek.</h1>
              <p className="lead">What can I help you accomplish?</p>
            </div>

            <div className="suggestion-grid">
              {suggestions.map(({ icon: Icon, title, detail }) => (
                <button className="suggestion" key={title} onClick={() => submitMessage(title)}>
                  <span className="suggestion-icon"><Icon size={18} /></span>
                  <span><strong>{title}</strong><small>{detail}</small></span>
                  <ArrowUp className="suggestion-arrow" size={16} />
                </button>
              ))}
            </div>
          </> : <div className="messages" aria-live="polite">
            {messages.map((item, index) => <div className={`message ${item.role}`} key={`${item.role}-${index}`}>
              {item.role === "assistant" && <div className="message-mark"><Sparkles size={13} /></div>}
              <div>
                <p>{linkifyText(item.text)}</p>
                {item.sources && item.sources.length > 0 && <div className="message p" style={{ padding: "0 15px 12px", marginTop: "-4px" }}>
                  <p style={{ padding: "0 0 6px", fontSize: "11px", color: "#6b756e", textTransform: "uppercase", letterSpacing: ".08em", background: "transparent", border: "0" }}>Sources</p>
                  <ul>{item.sources.map((source) => <li key={source}><a href={source} target="_blank" rel="noreferrer">{source}</a></li>)}</ul>
                </div>}
              </div>
            </div>)}
            {isThinking && <div className="message assistant thinking"><div className="message-mark"><Sparkles size={13} /></div><p><i /><i /><i /></p></div>}
          </div>}
        </div>

        <div className="composer-area">
          <div className="composer">
            <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitMessage()} placeholder="Ask Jarvis anything..." aria-label="Message Jarvis" />
            <button className={`mic ${listening ? "listening" : ""}`} onClick={toggleVoiceCommand} aria-label={listening ? "Stop voice input" : "Use voice input"}><Mic size={19} /></button>
            <button className="send" onClick={() => submitMessage()} disabled={!message.trim()} aria-label="Send message"><ArrowUp size={18} /></button>
          </div>
          <div className="composer-meta"><span><Volume2 size={14} />{voiceStatus}</span><span>Jarvis can make mistakes. Check important info.</span></div>
        </div>

        {connectorModel && <div className="connector-overlay" role="dialog" aria-modal="true" aria-labelledby="connector-title">
          <div className="connector-dialog">
            <button className="connector-close" onClick={() => setConnectorModel(null)} aria-label="Close connector settings"><X size={18} /></button>
            <div className="connector-symbol"><Cpu size={19} /></div>
            <p className="eyebrow">AI CONNECTOR</p>
            <h2 id="connector-title">Connect {models.find((model) => model.id === connectorModel)?.label}</h2>
            <p className="connector-copy">Enter an authorized API key to use this provider for the current browser session.</p>
            <label htmlFor="connector-key">API key</label>
            <input id="connector-key" type="password" value={connectorKey} onChange={(event) => setConnectorKey(event.target.value)} placeholder={`Paste your ${models.find((model) => model.id === connectorModel)?.label} API key`} autoFocus />
             <a className="load-models" href={apiKeyLinks[connectorModel]} target="_blank" rel="noreferrer">Get an API key from {models.find((model) => model.id === connectorModel)?.label}</a>
            {connectorError && <p className="connector-error">{connectorError}</p>}
            <p className="connector-note">Jarvis validates the key with a small provider request before connecting. Your key is cleared when you refresh this page.</p>
             <div className="connector-actions"><button className="cancel-connector" onClick={() => setConnectorModel(null)} disabled={isConnecting}>Cancel</button><button className="connect-connector" onClick={() => void connectProvider()} disabled={!connectorKey.trim() || isConnecting}>{isConnecting ? "Validating..." : "Connect provider"} <ArrowUp size={15} /></button></div>
          </div>
        </div>}
      </section>
    </main>
  );
}
