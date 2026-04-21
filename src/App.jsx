import { useState, useEffect, useRef } from "react";

const OLLAMA_URL = "http://localhost:11434/api/chat";

const LUMA_SYSTEM = (profile) => `You are Luma, a warm, intelligent, and deeply personal AI life companion. You are not a generic chatbot — you are a trusted friend who knows the person you're talking to.

Your personality:
- Warm, encouraging, and genuinely caring
- Intelligent and insightful without being overwhelming
- Honest — you give real advice, not just validation
- Proactive — you notice patterns and offer suggestions
- Concise but thorough — you explain your thinking clearly

Your capabilities:
- Career growth and development coaching
- Interest and hobby development guidance
- Daily task and reminder management
- Communication drafting (emails, texts, messages)
- Decision support with clear reasoning
- Goal setting and progress tracking
- Life organization and planning
- Learning paths for any topic

User Profile:
${profile.name ? `Name: ${profile.name}` : "Name: not set yet"}
${profile.career ? `Career: ${profile.career}` : ""}
${profile.interests ? `Interests: ${profile.interests}` : ""}
${profile.goals ? `Goals: ${profile.goals}` : ""}
${profile.location ? `Location: ${profile.location}` : ""}

Always address the user personally when you know their name. Always explain your thinking briefly after giving advice. Always end responses with one actionable next step when relevant. Be the companion that makes their life feel more manageable and their goals feel achievable.`;

const QUICK_PROMPTS = [
  { icon: "🌅", label: "Morning Briefing", prompt: "Give me my morning briefing. Help me start my day with intention — what should I focus on, what mindset should I have, and what's one thing I can do today to move closer to my goals?" },
  { icon: "🎯", label: "Career Growth", prompt: "I want to grow in my career. Based on what you know about me, what are the most impactful things I can do right now to advance, improve my skills, and become more valuable in my field?" },
  { icon: "📋", label: "Plan My Week", prompt: "Help me plan my week effectively. Ask me what I have coming up and help me organize my time, priorities, and energy so I feel in control and productive." },
  { icon: "✉️", label: "Draft a Message", prompt: "I need help writing something. Ask me who it's to, what the situation is, and what I want to communicate — then draft something clear and professional for me." },
  { icon: "🤔", label: "Help Me Decide", prompt: "I have a decision to make and I need help thinking it through. Ask me what the decision is, then help me weigh the options clearly and make the best choice for my life." },
  { icon: "📚", label: "Learn Something", prompt: "I want to learn something new or get better at something I already do. Ask me what it is and build me a personalized learning path with clear next steps." },
  { icon: "💆", label: "I'm Overwhelmed", prompt: "I'm feeling overwhelmed and don't know where to start. Help me slow down, organize my thoughts, prioritize what actually matters, and take one step forward." },
  { icon: "🎸", label: "Hobby Development", prompt: "I want to develop one of my hobbies or interests further. Ask me which one and help me go deeper — with resources, practice plans, and ways to make real progress." }
];

const GREETING = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

export default function App() {
  const [screen, setScreen] = useState("home");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem("luma_profile") || "{}"); } catch { return {}; }
  });
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("luma_tasks") || "[]"); } catch { return []; }
  });
  const [newTask, setNewTask] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(profile);
  const [ollamaStatus, setOllamaStatus] = useState("checking");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    localStorage.setItem("luma_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("luma_tasks", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    fetch("http://localhost:11434/api/tags")
      .then(() => setOllamaStatus("online"))
      .catch(() => setOllamaStatus("offline"));
  }, []);

  const sendMessage = async (text) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setInput("");
    const userMsg = { role: "user", content: msg };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    setScreen("chat");

    try {
      const res = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistral-nemo:latest",
          messages: [
            { role: "system", content: LUMA_SYSTEM(profile) },
            ...updated
          ],
          stream: false
        })
      });
      const data = await res.json();
      const reply = data.message?.content || "I'm having trouble connecting. Please make sure Ollama is running.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "I couldn't connect to your local AI. Please make sure Ollama is running on your Mac." }]);
    }
    setLoading(false);
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, { id: Date.now(), text: newTask, done: false, created: new Date().toLocaleDateString() }]);
    setNewTask("");
  };

  const toggleTask = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTask = (id) => setTasks(prev => prev.filter(t => t.id !== id));

  const saveProfile = () => {
    setProfile(profileDraft);
    setEditingProfile(false);
  };

  const S = {
    app: {
      minHeight: "100vh",
      background: "#0d0c0a",
      fontFamily: "'DM Sans', -apple-system, sans-serif",
      color: "#f0ebe0",
      display: "flex",
      flexDirection: "column"
    },
    nav: {
      display: "flex",
      alignItems: "center",
      padding: "0 28px",
      height: "60px",
      borderBottom: "0.5px solid rgba(240,235,224,0.08)",
      background: "rgba(13,12,10,0.8)",
      backdropFilter: "blur(20px)",
      position: "sticky",
      top: 0,
      zIndex: 100,
      flexShrink: 0
    },
    logo: {
      fontSize: "20px",
      fontWeight: 700,
      fontFamily: "'DM Serif Display', Georgia, serif",
      color: "#e8c97a",
      letterSpacing: "-0.02em",
      marginRight: "auto",
      cursor: "pointer"
    },
    navBtn: (active) => ({
      padding: "6px 14px",
      borderRadius: "8px",
      border: "none",
      background: active ? "rgba(232,201,122,0.12)" : "transparent",
      color: active ? "#e8c97a" : "rgba(240,235,224,0.45)",
      fontSize: "13px",
      fontWeight: 500,
      cursor: "pointer",
      transition: "all 0.2s",
      marginLeft: "4px"
    }),
    content: { flex: 1, overflowY: "auto", padding: "32px 24px" },
    center: { maxWidth: "720px", margin: "0 auto" }
  };

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 0; }
        ::placeholder { color: rgba(240,235,224,0.25); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes glow { 0%,100%{box-shadow:0 0 20px rgba(232,201,122,0.1)} 50%{box-shadow:0 0 40px rgba(232,201,122,0.2)} }
        .fade-up { animation: fadeUp 0.5s ease forwards; }
        .quick-btn:hover { background: rgba(232,201,122,0.1) !important; border-color: rgba(232,201,122,0.3) !important; transform: translateY(-2px); }
        .send-btn:hover { background: #d4b86a !important; }
        .task-item:hover .task-delete { opacity: 1 !important; }
        textarea:focus, input:focus { outline: none; }
      `}</style>

      {/* Nav */}
      <nav style={S.nav}>
        <div style={S.logo} onClick={() => setScreen("home")}>Luma</div>
        <div style={{ fontSize: "10px", color: ollamaStatus === "online" ? "#34c759" : "#ff3b30", marginRight: "16px", display: "flex", alignItems: "center", gap: "5px" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: ollamaStatus === "online" ? "#34c759" : "#ff3b30" }} />
          {ollamaStatus === "online" ? "Connected" : "Offline"}
        </div>
        {["home", "chat", "tasks", "profile"].map(s => (
          <button key={s} style={S.navBtn(screen === s)} onClick={() => setScreen(s)}>
            {s === "home" ? "Home" : s === "chat" ? "Chat" : s === "tasks" ? "Tasks" : "Profile"}
          </button>
        ))}
      </nav>

      {/* Home */}
      {screen === "home" && (
        <div style={S.content}>
          <div style={S.center}>
            <div className="fade-up" style={{ marginBottom: "48px" }}>
              <div style={{ fontSize: "13px", color: "#e8c97a", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>
                {GREETING()}{profile.name ? `, ${profile.name}` : ""}
              </div>
              <h1 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1.15, color: "#f0ebe0", marginBottom: "16px" }}>
                What can I help you<br />
                <span style={{ color: "#e8c97a", fontStyle: "italic" }}>illuminate</span> today?
              </h1>
              <p style={{ fontSize: "16px", color: "rgba(240,235,224,0.5)", lineHeight: 1.65 }}>
                Your private AI companion — for your career, your interests, your life.
              </p>
            </div>

            {/* Quick input */}
            <div className="fade-up" style={{ animationDelay: "0.1s", opacity: 0, marginBottom: "40px" }}>
              <div style={{ display: "flex", gap: "10px", background: "rgba(240,235,224,0.04)", border: "0.5px solid rgba(240,235,224,0.12)", borderRadius: "16px", padding: "12px 16px", animation: "glow 4s infinite" }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Ask Luma anything about your life, career, goals, or tasks…"
                  rows={1}
                  style={{ flex: 1, background: "transparent", border: "none", color: "#f0ebe0", fontSize: "15px", resize: "none", fontFamily: "inherit", lineHeight: 1.6, maxHeight: "120px", overflowY: "auto" }}
                  onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                />
                <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{ background: "#e8c97a", border: "none", borderRadius: "10px", width: "38px", height: "38px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "flex-end", transition: "background 0.2s", opacity: !input.trim() ? 0.4 : 1 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d0c0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick prompts */}
            <div className="fade-up" style={{ animationDelay: "0.2s", opacity: 0 }}>
              <div style={{ fontSize: "11px", color: "rgba(240,235,224,0.3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "14px" }}>Quick Start</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
                {QUICK_PROMPTS.map(q => (
                  <button key={q.label} className="quick-btn" onClick={() => sendMessage(q.prompt)} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "14px 16px", background: "rgba(240,235,224,0.03)", border: "0.5px solid rgba(240,235,224,0.08)", borderRadius: "12px", cursor: "pointer", textAlign: "left", transition: "all 0.2s", color: "#f0ebe0" }}>
                    <span style={{ fontSize: "18px", flexShrink: 0 }}>{q.icon}</span>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "2px" }}>{q.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tasks preview */}
            {tasks.filter(t => !t.done).length > 0 && (
              <div className="fade-up" style={{ animationDelay: "0.3s", opacity: 0, marginTop: "40px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", color: "rgba(240,235,224,0.3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Pending Tasks</div>
                  <button onClick={() => setScreen("tasks")} style={{ fontSize: "12px", color: "#e8c97a", background: "none", border: "none", cursor: "pointer" }}>See all →</button>
                </div>
                {tasks.filter(t => !t.done).slice(0, 3).map(task => (
                  <div key={task.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "rgba(240,235,224,0.03)", border: "0.5px solid rgba(240,235,224,0.08)", borderRadius: "10px", marginBottom: "6px" }}>
                    <div onClick={() => toggleTask(task.id)} style={{ width: "16px", height: "16px", border: "1.5px solid rgba(240,235,224,0.3)", borderRadius: "4px", cursor: "pointer", flexShrink: 0 }} />
                    <span style={{ fontSize: "14px", color: "rgba(240,235,224,0.7)" }}>{task.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat */}
      {screen === "chat" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            <div style={S.center}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(240,235,224,0.3)" }}>
                  <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: "32px", color: "#e8c97a", marginBottom: "12px", fontStyle: "italic" }}>Luma</div>
                  <div style={{ fontSize: "15px" }}>Start a conversation — I'm here for anything.</div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: "20px", display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", animation: "fadeUp 0.3s ease" }}>
                  <div style={{ fontSize: "11px", color: "rgba(240,235,224,0.3)", marginBottom: "6px", paddingLeft: m.role !== "user" ? "4px" : 0, paddingRight: m.role === "user" ? "4px" : 0 }}>
                    {m.role === "user" ? (profile.name || "You") : "Luma"}
                  </div>
                  <div style={{ maxWidth: "80%", padding: "14px 18px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px", background: m.role === "user" ? "#e8c97a" : "rgba(240,235,224,0.06)", color: m.role === "user" ? "#0d0c0a" : "#f0ebe0", fontSize: "15px", lineHeight: 1.65, whiteSpace: "pre-wrap", border: m.role !== "user" ? "0.5px solid rgba(240,235,224,0.1)" : "none", fontWeight: m.role === "user" ? 500 : 400 }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginBottom: "20px" }}>
                  <div style={{ fontSize: "11px", color: "rgba(240,235,224,0.3)", marginBottom: "6px", paddingLeft: "4px" }}>Luma</div>
                  <div style={{ padding: "14px 18px", background: "rgba(240,235,224,0.06)", border: "0.5px solid rgba(240,235,224,0.1)", borderRadius: "4px 18px 18px 18px", display: "flex", gap: "6px", alignItems: "center" }}>
                    {[0, 0.2, 0.4].map((d, i) => (
                      <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#e8c97a", animation: `shimmer 1.4s infinite ${d}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Chat input */}
          <div style={{ borderTop: "0.5px solid rgba(240,235,224,0.08)", padding: "16px 24px", background: "rgba(13,12,10,0.8)", backdropFilter: "blur(20px)" }}>
            <div style={S.center}>
              <div style={{ display: "flex", gap: "10px", background: "rgba(240,235,224,0.04)", border: "0.5px solid rgba(240,235,224,0.12)", borderRadius: "14px", padding: "10px 14px" }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Message Luma…"
                  rows={1}
                  style={{ flex: 1, background: "transparent", border: "none", color: "#f0ebe0", fontSize: "15px", resize: "none", fontFamily: "inherit", lineHeight: 1.6, maxHeight: "120px" }}
                  onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                />
                <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{ background: "#e8c97a", border: "none", borderRadius: "8px", width: "34px", height: "34px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "flex-end", transition: "background 0.2s", opacity: !input.trim() ? 0.4 : 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d0c0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                  </svg>
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
                <div style={{ fontSize: "11px", color: "rgba(240,235,224,0.2)" }}>Enter to send · Shift+Enter for new line</div>
                <button onClick={() => { setMessages([]); }} style={{ fontSize: "11px", color: "rgba(240,235,224,0.2)", background: "none", border: "none", cursor: "pointer" }}>Clear chat</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tasks */}
      {screen === "tasks" && (
        <div style={S.content}>
          <div style={S.center}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "32px", fontWeight: 400, color: "#f0ebe0", marginBottom: "8px" }}>Your Tasks</h2>
            <p style={{ fontSize: "14px", color: "rgba(240,235,224,0.4)", marginBottom: "28px" }}>Stay on top of what matters most.</p>

            {/* Add task */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "28px" }}>
              <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} placeholder="Add a task…" style={{ flex: 1, background: "rgba(240,235,224,0.04)", border: "0.5px solid rgba(240,235,224,0.12)", borderRadius: "10px", padding: "12px 16px", color: "#f0ebe0", fontSize: "14px", fontFamily: "inherit" }} />
              <button onClick={addTask} style={{ background: "#e8c97a", border: "none", borderRadius: "10px", padding: "12px 20px", color: "#0d0c0a", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>Add</button>
            </div>

            {/* Ask Luma to help with tasks */}
            <button onClick={() => sendMessage("Help me organize and prioritize my tasks. Here's what I have: " + tasks.filter(t => !t.done).map(t => t.text).join(", "))} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", background: "rgba(232,201,122,0.08)", border: "0.5px solid rgba(232,201,122,0.2)", borderRadius: "10px", color: "#e8c97a", fontSize: "13px", fontWeight: 500, cursor: "pointer", marginBottom: "24px", width: "100%" }}>
              <span>✨</span> Ask Luma to help prioritize these tasks
            </button>

            {/* Pending */}
            {tasks.filter(t => !t.done).length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <div style={{ fontSize: "11px", color: "rgba(240,235,224,0.3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>Pending ({tasks.filter(t => !t.done).length})</div>
                {tasks.filter(t => !t.done).map(task => (
                  <div key={task.id} className="task-item" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", background: "rgba(240,235,224,0.03)", border: "0.5px solid rgba(240,235,224,0.08)", borderRadius: "10px", marginBottom: "6px", transition: "all 0.2s" }}>
                    <div onClick={() => toggleTask(task.id)} style={{ width: "18px", height: "18px", border: "1.5px solid rgba(240,235,224,0.25)", borderRadius: "5px", cursor: "pointer", flexShrink: 0, transition: "all 0.2s" }} />
                    <span style={{ flex: 1, fontSize: "14px", color: "rgba(240,235,224,0.8)" }}>{task.text}</span>
                    <span style={{ fontSize: "11px", color: "rgba(240,235,224,0.2)" }}>{task.created}</span>
                    <button className="task-delete" onClick={() => deleteTask(task.id)} style={{ opacity: 0, background: "none", border: "none", color: "#ff3b30", cursor: "pointer", fontSize: "16px", transition: "opacity 0.2s", padding: "0 4px" }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Completed */}
            {tasks.filter(t => t.done).length > 0 && (
              <div>
                <div style={{ fontSize: "11px", color: "rgba(240,235,224,0.3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>Completed ({tasks.filter(t => t.done).length})</div>
                {tasks.filter(t => t.done).map(task => (
                  <div key={task.id} className="task-item" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", background: "rgba(240,235,224,0.02)", border: "0.5px solid rgba(240,235,224,0.05)", borderRadius: "10px", marginBottom: "6px" }}>
                    <div onClick={() => toggleTask(task.id)} style={{ width: "18px", height: "18px", background: "#34c759", border: "1.5px solid #34c759", borderRadius: "5px", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span style={{ flex: 1, fontSize: "14px", color: "rgba(240,235,224,0.3)", textDecoration: "line-through" }}>{task.text}</span>
                    <button className="task-delete" onClick={() => deleteTask(task.id)} style={{ opacity: 0, background: "none", border: "none", color: "#ff3b30", cursor: "pointer", fontSize: "16px", transition: "opacity 0.2s", padding: "0 4px" }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {tasks.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(240,235,224,0.2)" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>✓</div>
                <div style={{ fontSize: "15px" }}>No tasks yet — add one above or ask Luma to help you plan.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile */}
      {screen === "profile" && (
        <div style={S.content}>
          <div style={S.center}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
              <div>
                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "32px", fontWeight: 400, color: "#f0ebe0", marginBottom: "8px" }}>Your Profile</h2>
                <p style={{ fontSize: "14px", color: "rgba(240,235,224,0.4)" }}>Help Luma know you better for more personalized support.</p>
              </div>
              <button onClick={() => editingProfile ? saveProfile() : setEditingProfile(true)} style={{ padding: "8px 18px", background: editingProfile ? "#e8c97a" : "rgba(240,235,224,0.06)", border: `0.5px solid ${editingProfile ? "#e8c97a" : "rgba(240,235,224,0.12)"}`, borderRadius: "8px", color: editingProfile ? "#0d0c0a" : "#f0ebe0", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                {editingProfile ? "Save Profile" : "Edit Profile"}
              </button>
            </div>

            {[
              { key: "name", label: "Your Name", placeholder: "e.g. Deandre", icon: "👤" },
              { key: "career", label: "Career & Role", placeholder: "e.g. QA Engineer at Apple, transitioning from bioengineering", icon: "💼" },
              { key: "interests", label: "Hobbies & Interests", placeholder: "e.g. music production, photography, cooking, fitness", icon: "🎯" },
              { key: "goals", label: "Current Goals", placeholder: "e.g. get promoted, learn Swift, start a business, get healthier", icon: "🚀" },
              { key: "location", label: "Location", placeholder: "e.g. San Jose, CA", icon: "📍" }
            ].map(field => (
              <div key={field.key} style={{ marginBottom: "16px", background: "rgba(240,235,224,0.03)", border: "0.5px solid rgba(240,235,224,0.08)", borderRadius: "12px", padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "16px" }}>{field.icon}</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(240,235,224,0.4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{field.label}</span>
                </div>
                {editingProfile ? (
                  <input value={profileDraft[field.key] || ""} onChange={e => setProfileDraft(p => ({ ...p, [field.key]: e.target.value }))} placeholder={field.placeholder} style={{ width: "100%", background: "rgba(240,235,224,0.04)", border: "0.5px solid rgba(240,235,224,0.15)", borderRadius: "8px", padding: "10px 14px", color: "#f0ebe0", fontSize: "14px", fontFamily: "inherit" }} />
                ) : (
                  <div style={{ fontSize: "15px", color: profile[field.key] ? "#f0ebe0" : "rgba(240,235,224,0.2)" }}>
                    {profile[field.key] || `Add your ${field.label.toLowerCase()}…`}
                  </div>
                )}
              </div>
            ))}

            {/* Ask Luma based on profile */}
            <div style={{ marginTop: "24px", padding: "20px", background: "rgba(232,201,122,0.05)", border: "0.5px solid rgba(232,201,122,0.15)", borderRadius: "12px" }}>
              <div style={{ fontSize: "13px", color: "#e8c97a", fontWeight: 600, marginBottom: "8px" }}>✨ Luma knows you</div>
              <div style={{ fontSize: "14px", color: "rgba(240,235,224,0.5)", lineHeight: 1.6, marginBottom: "14px" }}>
                The more you share, the more personalized Luma's guidance becomes. Every response adapts to your life, career, and goals.
              </div>
              <button onClick={() => sendMessage("Based on my profile, what are the three most impactful things I should focus on right now to improve my life and move closer to my goals?")} style={{ padding: "10px 18px", background: "#e8c97a", border: "none", borderRadius: "8px", color: "#0d0c0a", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                Ask Luma for personalized advice →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}