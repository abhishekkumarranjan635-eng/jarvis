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
};

function getReply(prompt: string, now = new Date()) {
  const query = prompt.toLowerCase();
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const shortDateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  if (query.includes("time") && !query.includes("times")) {
    return `It is ${timeFormatter.format(now)} on ${dateFormatter.format(now)}.`;
  }
  if (query.includes("what day") || query.includes("today") || query.includes("date")) {
    return `Today is ${dateFormatter.format(now)}.`;
  }
  if (query.includes("week")) {
    return `This week runs from ${shortDateFormatter.format(weekStart)} through ${shortDateFormatter.format(weekEnd)}. Today is ${dateFormatter.format(now)}.`;
  }
  if (query.includes("month")) {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `It is ${monthFormatter.format(now)}. This month has ${daysInMonth} days, and today is ${dateFormatter.format(now)}.`;
  }
  if (query.includes("plan") || query.includes("day")) {
    return "Here is a focused plan: review your top priority, reserve a 90-minute deep-work block, and leave 30 minutes before your next meeting to clear messages.";
  }
  if (query.includes("note") || query.includes("summar")) {
    return "I can summarize your notes once a notes integration is connected. For now, paste the text here and I will turn it into key decisions, actions, and open questions.";
  }
  if (query.includes("research") || query.includes("search")) {
    return "I do not have a web-search integration connected in this preview. Tell me the topic and I can still help you form a concise research brief or evaluate sources you provide.";
  }
  if (query.includes("weather")) {
    return "I do not have live weather access connected in this preview, so I cannot reliably check conditions. I can help you plan what to look for, though.";
  }
  if (query.includes("what can you do") || query.includes("your capabilities") || query.includes("what do you do")) {
    return "I can answer questions, plan your day, summarize text, draft messages, organize tasks, and help with research. With an authorized AI connector selected, I can also use OpenAI, Claude, or Gemini for richer answers. Actions such as sending email, checking live weather, or controlling your PC require their own connected integration.";
  }
  if (query.includes("hello") || query.includes("hi") || query.includes("hey")) {
    return "Hello, Abhishek. I am ready when you are. What would you like to work through?";
  }
  if (query.includes("remind") || query.includes("reminder")) {
    return "I can help you phrase and plan a reminder, but no calendar or reminder integration is connected in this workspace yet. Tell me the task and time, and I will prepare it.";
  }
  if (query.includes("email") || query.includes("send")) {
    return "I can draft the message for you, but I cannot send email until an email integration is connected. Who is it for, and what should it say?";
  }
  if (query.includes("help")) {
    return "I can help you plan your day, write and summarize content, prepare research, and organize next steps. Connected tasks such as sending messages need their respective integration enabled.";
  }
  return `I understand: "${prompt}". I can help you break this into a clear next step, draft a response, or make a practical plan. Which direction would be most useful?`;
}

function shouldSearchWeb(prompt: string) {
  const query = prompt.toLowerCase().trim();
  const question = /^(what|who|when|where|why|how|define|explain|tell me about)\b/.test(query);
  const localRequest = query.includes("what can you do") || query.includes("your capabilities") || query.includes("remind") || query.includes("email") || query.includes("plan my");
  return question && !localRequest;
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
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [connectorModel, setConnectorModel] = useState<Exclude<ModelId, "local"> | null>(null);
  const [connectorKey, setConnectorKey] = useState("");
  const [connectorVersion, setConnectorVersion] = useState("");
  const [sessionConnectors, setSessionConnectors] = useState<Partial<Record<ModelId, SessionConnector>>>({});
  const [connectorError, setConnectorError] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  function submitMessage(text = message) {
    const prompt = text.trim();
    if (!prompt || isThinking) return;
    setMessages((current) => [...current, { role: "user", text: prompt }]);
    setMessage("");
    setIsThinking(true);
    if (selectedModel === "local") {
      if (shouldSearchWeb(prompt)) {
        void fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: prompt }),
        })
          .then(async (response) => {
            const body = await response.json() as { answer?: string; error?: string };
            if (!response.ok || !body.answer) throw new Error(body.error ?? "No useful result was found.");
            return body.answer;
          })
          .then((answer) => setMessages((current) => [...current, { role: "assistant", text: answer }]))
          .catch(() => setMessages((current) => [...current, { role: "assistant", text: "I could not reach the web knowledge service right now. Select an authorized AI connector for a direct model response, or try again shortly." }]))
          .finally(() => setIsThinking(false));
        return;
      }
      window.setTimeout(() => {
        setMessages((current) => [...current, { role: "assistant", text: getReply(prompt, new Date()) }]);
        setIsThinking(false);
      }, 650);
      return;
    }

    void fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: selectedModel, message: prompt, apiKey: sessionConnectors[selectedModel]?.apiKey, model: sessionConnectors[selectedModel]?.model }),
    })
      .then(async (response) => {
        const body = await response.json() as { reply?: string; error?: string };
        if (!response.ok || !body.reply) throw new Error(body.error ?? "The provider did not return a response.");
        return body.reply;
      })
      .then((reply) => setMessages((current) => [...current, { role: "assistant", text: reply }]))
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
    setAvailableModels([]);
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
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The provider rejected this API key.");
      setSessionConnectors((connectors) => ({ ...connectors, [connectorModel]: { apiKey: connectorKey.trim(), model: connectorVersion.trim() } }));
      setSelectedModel(connectorModel);
      setConnectorModel(null);
      setConnectorKey("");
      setConnectorVersion("");
    } catch (error: unknown) {
      setConnectorError(error instanceof Error ? error.message : "The provider could not validate this API key.");
    } finally {
      setIsConnecting(false);
    }
  }

  async function loadProviderModels() {
    if (!connectorModel || !connectorKey.trim()) return;
    setIsLoadingModels(true);
    setConnectorError("");
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: connectorModel, apiKey: connectorKey.trim() }),
      });
      const body = await response.json() as { models?: string[]; error?: string };
      if (!response.ok || !body.models) throw new Error(body.error ?? "Could not load models for this key.");
      setAvailableModels(body.models);
      if (body.models.length && !body.models.includes(connectorVersion)) setConnectorVersion(body.models[0]);
    } catch (error: unknown) {
      setConnectorError(error instanceof Error ? error.message : "Could not load models for this key.");
    } finally {
      setIsLoadingModels(false);
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
              <Cpu size={15} /><span>{models.find((model) => model.id === selectedModel)?.label}</span><ChevronDown size={14} />
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
              <p>{item.text}</p>
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
            <label htmlFor="connector-version">Model version</label>
            <input id="connector-version" list="provider-models" value={connectorVersion} onChange={(event) => setConnectorVersion(event.target.value)} placeholder="Enter or load a model ID" />
            <datalist id="provider-models">{availableModels.map((model) => <option key={model} value={model} />)}</datalist>
            <button className="load-models" onClick={() => void loadProviderModels()} disabled={!connectorKey.trim() || isLoadingModels}>{isLoadingModels ? "Loading models..." : "Load all models available to this key"}</button>
            {connectorError && <p className="connector-error">{connectorError}</p>}
            <p className="connector-note">Jarvis validates the key with a small provider request before connecting. Your key is cleared when you refresh this page.</p>
            <div className="connector-actions"><button className="cancel-connector" onClick={() => setConnectorModel(null)} disabled={isConnecting}>Cancel</button><button className="connect-connector" onClick={() => void connectProvider()} disabled={!connectorKey.trim() || !connectorVersion.trim() || isConnecting}>{isConnecting ? "Validating..." : "Connect provider"} <ArrowUp size={15} /></button></div>
          </div>
        </div>}
      </section>
    </main>
  );
}
