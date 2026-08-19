"use client";

import { useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  Clock3,
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

function getReply(prompt: string) {
  const query = prompt.toLowerCase();
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

export default function Home() {
  const [message, setMessage] = useState("");
  const [listening, setListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeRecent, setActiveRecent] = useState<string | null>(null);

  function submitMessage(text = message) {
    const prompt = text.trim();
    if (!prompt || isThinking) return;
    setMessages((current) => [...current, { role: "user", text: prompt }]);
    setMessage("");
    setIsThinking(true);
    window.setTimeout(() => {
      setMessages((current) => [...current, { role: "assistant", text: getReply(prompt) }]);
      setIsThinking(false);
    }, 650);
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
          <div className="topbar-title"><span>New conversation</span><ChevronDown size={15} /></div>
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
            <button className={`mic ${listening ? "listening" : ""}`} onClick={() => { setListening(!listening); setMessage(listening ? "" : "Listening is not available in this preview."); }} aria-label="Use voice input"><Mic size={19} /></button>
            <button className="send" onClick={() => submitMessage()} disabled={!message.trim()} aria-label="Send message"><ArrowUp size={18} /></button>
          </div>
          <div className="composer-meta"><span><Volume2 size={14} />Voice ready</span><span>Jarvis can make mistakes. Check important info.</span></div>
        </div>
      </section>
    </main>
  );
}
