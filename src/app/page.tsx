"use client";

import { useState } from "react";
import {
  ArrowUp,
  Check,
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

export default function Home() {
  const [message, setMessage] = useState("");
  const [listening, setListening] = useState(false);
  const [sent, setSent] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function submitMessage() {
    if (!message.trim()) return;
    setSent(true);
    setMessage("");
    window.setTimeout(() => setSent(false), 2400);
  }

  return (
    <main className="jarvis-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="mark"><Sparkles size={16} strokeWidth={2.4} /></div>
          <span>jarvis</span>
          <button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19} /></button>
        </div>
        <button className="new-chat"><Plus size={17} /> New conversation</button>
        <nav className="history" aria-label="Conversation history">
          <p>RECENT</p>
          {recent.map((item, index) => <button key={item} className={index === 0 ? "active" : ""}><Clock3 size={15} />{item}</button>)}
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
          <div className="welcome">
            <div className="orb-wrap"><div className="orb"><span /></div></div>
            <p className="eyebrow">YOUR PERSONAL INTELLIGENCE</p>
            <h1>Good morning, Abhishek.</h1>
            <p className="lead">What can I help you accomplish?</p>
          </div>

          <div className="suggestion-grid">
            {suggestions.map(({ icon: Icon, title, detail }) => (
              <button className="suggestion" key={title} onClick={() => setMessage(title)}>
                <span className="suggestion-icon"><Icon size={18} /></span>
                <span><strong>{title}</strong><small>{detail}</small></span>
                <ArrowUp className="suggestion-arrow" size={16} />
              </button>
            ))}
          </div>

          {sent && <div className="reply"><Check size={16} />I&apos;m on it. I&apos;ll keep this concise and let you know when it&apos;s ready.</div>}
        </div>

        <div className="composer-area">
          <div className="composer">
            <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitMessage()} placeholder="Ask Jarvis anything..." aria-label="Message Jarvis" />
            <button className={`mic ${listening ? "listening" : ""}`} onClick={() => setListening(!listening)} aria-label="Use voice input"><Mic size={19} /></button>
            <button className="send" onClick={submitMessage} disabled={!message.trim()} aria-label="Send message"><ArrowUp size={18} /></button>
          </div>
          <div className="composer-meta"><span><Volume2 size={14} />Voice ready</span><span>Jarvis can make mistakes. Check important info.</span></div>
        </div>
      </section>
    </main>
  );
}
