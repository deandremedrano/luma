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

Always address the user personally when you know their name. Always explain your thinking briefly after giving advice. Always end responses with one actionable next step when relevant. Be warm, real, and human. Never be robotic or generic.`;

const GREETING = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const ONBOARDING_STEPS = [
  { key: "name", question: "What should I call you?", placeholder: "Your name…", hint: "This helps me make every conversation feel personal." },
  { key: "career", question: "What do you do, or what are you working toward?", placeholder: "e.g. I'm a nurse transitioning to healthcare admin…", hint: "I'll help you grow and advance in your field." },
  { key: "interests", question: "What are your hobbies and interests?", placeholder: "e.g. music, photography, fitness, cooking…", hint: "I'll help you go deeper in the things that bring you joy." },
  { key: "goals", question: "What are your biggest goals right now?", placeholder: "e.g. get promoted, start a business, get healthier…", hint: "I'll keep you focused and moving forward every day." }
];

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
  const [showOnboarding, setShowOnboarding] = useState(!localStorage.getItem("luma_profile") || !JSON.parse(localStorage.getItem("luma_profile") || "{}").name);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState({});
  const [onboardingInput, setOnboardingInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { localStorage.setItem("luma_profile", JSON.stringify(profile)); }, [profile]);
  useEffect(() => { localStorage.setItem("luma_tasks", JSON.stringify(tasks)); }, [tasks]);
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
        body: JSON.stringify({ model: "mistral-nemo:latest", messages: [{ role: "system", content: LUMA_SYSTEM(profile) }, ...updated], stream: false })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.message?.content || "Connection error." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Couldn't connect to Ollama. Make sure it's running on your Mac." }]);
    }
    setLoading(false);
  };

  const nextOnboardingStep = () => {
    const step = ONBOARDING_STEPS[onboardingStep];
    const updated = { ...onboardingData, [step.key]: onboardingInput };
    setOnboardingData(updated);
    setOnboardingInput("");
    if (onboardingStep < ONBOARDING_STEPS.length - 1) {
      setOnboardingStep(s => s + 1);
    } else {
      setProfile(updated);
      setShowOnboarding(false);
    }
  };

  const skipOnboarding = () => { setProfile(onboardingData); setShowOnboarding(false); };
  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, { id: Date.now(), text: newTask, done: false, created: new Date().toLocaleDateString() }]);
    setNewTask("");
  };
  const toggleTask = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTask = (id) => setTasks(prev => prev.filter(t => t.id !== id));
  const saveProfile = () => { setProfile(profileDraft); setEditingProfile(false); };

  const currentStep = ONBOARDING_STEPS[onboardingStep];

  return (
    <div style={{ minHeight: "100vh", background: "#f5f2ee", fontFamily: "'Nunito', -apple-system, sans-serif", color: "#1a1a1a", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        @keyframes aurora1 { 0%,100%{transform:translate(0,0) scale(1) rotate(0deg)} 33%{transform:translate(40px,-30px) scale(1.08) rotate(3deg)} 66%{transform:translate(-30px,20px) scale(0.95) rotate(-2deg)} }
        @keyframes aurora2 { 0%,100%{transform:translate(0,0) scale(1) rotate(0deg)} 33%{transform:translate(-35px,25px) scale(1.05) rotate(-3deg)} 66%{transform:translate(25px,-35px) scale(0.97) rotate(2deg)} }
        @keyframes aurora3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,30px) scale(1.06)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.7)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(48px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:0; }
        ::placeholder { color:rgba(26,26,26,0.28); font-family:'Nunito',sans-serif; }
        textarea:focus, input:focus { outline:none; }
        .nav-btn { background:transparent; border:none; color:rgba(26,26,26,0.38); font-size:15px; font-weight:700; cursor:pointer; padding:8px 18px; border-radius:100px; transition:all 0.22s; font-family:'Nunito',sans-serif; }
        .nav-btn:hover { color:#1a1a1a; background:rgba(26,26,26,0.06); }
        .nav-btn.active { color:#1a1a1a; background:rgba(26,26,26,0.08); }
        .card { background:rgba(255,255,255,0.7); border:0.5px solid rgba(26,26,26,0.07); border-radius:24px; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); transition:all 0.3s cubic-bezier(0.34,1.4,0.64,1); }
        .card:hover { background:rgba(255,255,255,0.88); border-color:rgba(26,26,26,0.1); transform:translateY(-2px); box-shadow:0 8px 40px rgba(0,0,0,0.06); }
        .input-wrap { background:rgba(255,255,255,0.75); border:0.5px solid rgba(26,26,26,0.09); border-radius:28px; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); transition:border-color 0.2s, box-shadow 0.2s; }
        .input-wrap:focus-within { border-color:rgba(26,26,26,0.15); box-shadow:0 4px 32px rgba(0,0,0,0.06); }
        .send-btn { transition:all 0.22s cubic-bezier(0.34,1.4,0.64,1); }
        .send-btn:hover:not(:disabled) { transform:scale(1.08); }
        .send-btn:active:not(:disabled) { transform:scale(0.95); }
        .aurora-text { background:linear-gradient(135deg, #00c896, #0ea5e9, #8b5cf6, #ec4899, #00c896); background-size:300% 100%; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:shimmer 6s linear infinite; }
        .suggest-btn { background:rgba(255,255,255,0.6); border:0.5px solid rgba(26,26,26,0.07); border-radius:18px; padding:18px 22px; cursor:pointer; color:#1a1a1a; font-size:17px; font-weight:700; font-family:'Nunito',sans-serif; text-align:left; display:flex; align-items:center; justify-content:space-between; transition:all 0.25s cubic-bezier(0.34,1.4,0.64,1); width:100%; }
        .suggest-btn:hover { background:rgba(255,255,255,0.92); border-color:rgba(26,26,26,0.12); transform:translateY(-2px); box-shadow:0 6px 28px rgba(0,0,0,0.07); }
        .task-row:hover .del-btn { opacity:1 !important; }
        .luma-logo { font-size:24px; font-weight:900; letter-spacing:-0.02em; cursor:pointer; font-family:'Nunito',sans-serif; }
        .pill-label { font-size:11px; font-weight:800; color:rgba(26,26,26,0.3); letter-spacing:0.1em; text-transform:uppercase; }
        .ob-input { width:100%; background:rgba(255,255,255,0.8); border:0.5px solid rgba(26,26,26,0.1); border-radius:20px; padding:18px 24px; color:#1a1a1a; font-size:18px; font-family:'Nunito',sans-serif; font-weight:600; transition:all 0.2s; }
        .ob-input:focus { border-color:rgba(14,165,233,0.4); box-shadow:0 0 0 4px rgba(14,165,233,0.08); }
        .ob-btn { padding:16px 36px; border:none; border-radius:20px; font-size:17px; font-weight:900; cursor:pointer; font-family:'Nunito',sans-serif; transition:all 0.25s cubic-bezier(0.34,1.4,0.64,1); background:linear-gradient(135deg, #00c896, #0ea5e9, #8b5cf6); color:#fff; }
        .ob-btn:hover { transform:translateY(-2px) scale(1.02); box-shadow:0 8px 32px rgba(14,165,233,0.25); }
        .ob-btn:active { transform:scale(0.97); }
        .nav-glass { background:rgba(245,242,238,0.82); backdrop-filter:blur(40px) saturate(180%); -webkit-backdrop-filter:blur(40px) saturate(180%); border-bottom:0.5px solid rgba(26,26,26,0.06); }
      `}</style>

      {/* Aurora borealis background orbs */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"-10%", left:"-5%", width:"700px", height:"500px", borderRadius:"60%", background:"radial-gradient(ellipse, rgba(0,200,150,0.18) 0%, rgba(0,200,150,0.06) 40%, transparent 70%)", filter:"blur(40px)", animation:"aurora1 18s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"20%", right:"-10%", width:"600px", height:"600px", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(14,165,233,0.16) 0%, rgba(14,165,233,0.05) 40%, transparent 70%)", filter:"blur(50px)", animation:"aurora2 22s ease-in-out infinite" }} />
        <div style={{ position:"absolute", bottom:"-5%", left:"20%", width:"550px", height:"400px", borderRadius:"60%", background:"radial-gradient(ellipse, rgba(139,92,246,0.14) 0%, rgba(139,92,246,0.04) 40%, transparent 70%)", filter:"blur(45px)", animation:"aurora3 26s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"50%", left:"40%", width:"400px", height:"400px", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(236,72,153,0.1) 0%, rgba(236,72,153,0.03) 40%, transparent 70%)", filter:"blur(40px)", animation:"aurora1 30s ease-in-out infinite reverse" }} />
        <div style={{ position:"absolute", top:"10%", left:"35%", width:"350px", height:"250px", borderRadius:"60%", background:"radial-gradient(ellipse, rgba(0,200,150,0.1) 0%, transparent 70%)", filter:"blur(35px)", animation:"aurora2 14s ease-in-out infinite" }} />
      </div>

      {/* Onboarding */}
      {showOnboarding && (
        <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(245,242,238,0.88)", backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", animation:"fadeIn 0.4s ease" }}>
          <div style={{ background:"rgba(255,255,255,0.85)", border:"0.5px solid rgba(26,26,26,0.08)", borderRadius:"36px", padding:"52px 48px", maxWidth:"500px", width:"100%", animation:"slideUp 0.5s cubic-bezier(0.34,1.2,0.64,1)", boxShadow:"0 24px 80px rgba(0,0,0,0.08)", backdropFilter:"blur(20px)" }}>

            {/* Progress */}
            <div style={{ display:"flex", gap:"8px", marginBottom:"40px", justifyContent:"center" }}>
              {ONBOARDING_STEPS.map((_, i) => (
                <div key={i} style={{ width: i === onboardingStep ? "28px" : "8px", height:"8px", borderRadius:"100px", background: i <= onboardingStep ? "linear-gradient(90deg, #00c896, #0ea5e9)" : "rgba(26,26,26,0.1)", transition:"all 0.35s cubic-bezier(0.34,1.4,0.64,1)" }} />
              ))}
            </div>

            {/* Brand */}
            <div style={{ textAlign:"center", marginBottom:"36px" }}>
              <div style={{ fontSize:"40px", fontWeight:900, fontFamily:"'Nunito',sans-serif", letterSpacing:"-0.02em", marginBottom:"6px" }}>
                <span className="aurora-text">Luma</span>
              </div>
              <div style={{ fontSize:"13px", fontWeight:700, color:"rgba(26,26,26,0.3)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Your life. Illuminated.</div>
            </div>

            {/* Question */}
            <div style={{ marginBottom:"28px" }}>
              <h2 style={{ fontSize:"26px", fontWeight:800, letterSpacing:"-0.02em", lineHeight:1.3, marginBottom:"10px", color:"#1a1a1a" }}>
                {currentStep.question}
              </h2>
              <p style={{ fontSize:"15px", color:"rgba(26,26,26,0.4)", fontWeight:500, lineHeight:1.6 }}>
                {currentStep.hint}
              </p>
            </div>

            <input className="ob-input" value={onboardingInput} onChange={e => setOnboardingInput(e.target.value)} onKeyDown={e => e.key==="Enter"&&nextOnboardingStep()} placeholder={currentStep.placeholder} autoFocus />

            <div style={{ display:"flex", gap:"12px", marginTop:"20px", alignItems:"center" }}>
              <button className="ob-btn" onClick={nextOnboardingStep} style={{ flex:1 }}>
                {onboardingStep < ONBOARDING_STEPS.length - 1 ? "Continue" : "Start with Luma"}
              </button>
              <button onClick={skipOnboarding} style={{ background:"none", border:"none", color:"rgba(26,26,26,0.28)", fontSize:"14px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif", padding:"8px 12px", whiteSpace:"nowrap" }}>
                Skip
              </button>
            </div>

            {onboardingStep > 0 && (
              <button onClick={() => { setOnboardingStep(s=>s-1); setOnboardingInput(onboardingData[ONBOARDING_STEPS[onboardingStep-1].key]||""); }} style={{ background:"none", border:"none", color:"rgba(26,26,26,0.22)", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif", marginTop:"14px", display:"block", width:"100%", textAlign:"center" }}>
                Back
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="nav-glass" style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, height:"64px", display:"flex", alignItems:"center", padding:"0 28px", gap:"4px" }}>
        <div className="luma-logo aurora-text" onClick={() => setScreen("home")} style={{ marginRight:"auto" }}>Luma</div>
        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginRight:"16px" }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background: ollamaStatus==="online" ? "#00c896" : "#ff453a", boxShadow: ollamaStatus==="online" ? "0 0 8px rgba(0,200,150,0.6)" : "0 0 8px rgba(255,69,58,0.6)" }} />
          <span style={{ fontSize:"13px", fontWeight:700, color: ollamaStatus==="online" ? "#00a87c" : "#ff453a" }}>
            {ollamaStatus==="online" ? "Connected" : "Offline"}
          </span>
        </div>
        {[["home","Home"],["chat","Chat"],["tasks","Tasks"],["profile","Profile"]].map(([s,l]) => (
          <button key={s} className={`nav-btn ${screen===s?"active":""}`} onClick={() => setScreen(s)}>{l}</button>
        ))}
      </nav>

      {/* Home */}
      {screen === "home" && (
        <div style={{ flex:1, overflowY:"auto", padding:"28px 24px", paddingTop:"92px", position:"relative", zIndex:1, minHeight:"100vh" }}>
          <div style={{ maxWidth:"660px", margin:"0 auto" }}>

            <div style={{ marginBottom:"52px", animation:"fadeUp 0.6s ease" }}>
              <div className="pill-label" style={{ marginBottom:"18px" }}>
                {GREETING()}{profile.name ? `, ${profile.name}` : ""} &nbsp;·&nbsp; {new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}
              </div>
              <h1 style={{ fontSize:"clamp(42px,6.5vw,66px)", fontWeight:900, letterSpacing:"-0.03em", lineHeight:1.08, marginBottom:"18px", color:"#1a1a1a" }}>
                What's on your<br />
                <span className="aurora-text">mind today?</span>
              </h1>
              <p style={{ fontSize:"18px", color:"rgba(26,26,26,0.42)", lineHeight:1.65, fontWeight:500, maxWidth:"460px" }}>
                I'm here for your career, your goals, your tasks, and anything else. Just talk to me.
              </p>
            </div>

            <div style={{ animation:"fadeUp 0.6s ease 0.1s both", marginBottom:"32px" }}>
              <div className="input-wrap" style={{ padding:"18px 20px", display:"flex", alignItems:"flex-end", gap:"14px" }}>
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }} placeholder={`What can I help you with${profile.name?`, ${profile.name}`:""}?`} rows={1} style={{ flex:1, background:"transparent", border:"none", color:"#1a1a1a", fontSize:"18px", resize:"none", fontFamily:"'Nunito',sans-serif", fontWeight:600, lineHeight:1.6, maxHeight:"160px", overflowY:"auto" }} onInput={e => { e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,160)+"px"; }} />
                <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim()||loading} style={{ width:"46px", height:"46px", borderRadius:"16px", background: input.trim() ? "linear-gradient(135deg, #00c896, #0ea5e9)" : "rgba(26,26,26,0.06)", border:"none", cursor: input.trim() ? "pointer" : "default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {loading ? <div style={{ width:"16px", height:"16px", border:"2.5px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim()?"#fff":"rgba(26,26,26,0.3)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>}
                </button>
              </div>
              <div style={{ fontSize:"12px", fontWeight:600, color:"rgba(26,26,26,0.18)", marginTop:"10px", paddingLeft:"4px" }}>Enter to send · Shift+Enter for new line</div>
            </div>

            <div style={{ animation:"fadeUp 0.6s ease 0.2s both" }}>
              <div className="pill-label" style={{ marginBottom:"14px" }}>Suggested</div>
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {[
                  { label:"Start my morning", prompt:"Give me my morning briefing. What should I focus on today, what mindset should I have, and what's one thing I can do to move closer to my goals?" },
                  { label:"Help me grow in my career", prompt:"I want to grow in my career. Based on what you know about me, what are the most impactful things I can do right now?" },
                  { label:"I need help with something", prompt:"I need your help with something. Ask me what it is and then let's work through it together." }
                ].map(s => (
                  <button key={s.label} className="suggest-btn" onClick={() => sendMessage(s.prompt)}>
                    <span>{s.label}</span>
                    <span style={{ fontSize:"16px", opacity:0.3, marginLeft:"12px", fontWeight:400 }}>→</span>
                  </button>
                ))}
              </div>
            </div>

            {tasks.filter(t=>!t.done).length > 0 && (
              <div style={{ marginTop:"40px", animation:"fadeUp 0.6s ease 0.3s both" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
                  <div className="pill-label">{tasks.filter(t=>!t.done).length} pending task{tasks.filter(t=>!t.done).length!==1?"s":""}</div>
                  <button onClick={() => setScreen("tasks")} style={{ fontSize:"13px", fontWeight:800, color:"rgba(26,26,26,0.3)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>See all</button>
                </div>
                {tasks.filter(t=>!t.done).slice(0,2).map(task => (
                  <div key={task.id} className="card" style={{ display:"flex", alignItems:"center", gap:"14px", padding:"15px 20px", borderRadius:"18px", marginBottom:"8px" }}>
                    <div onClick={() => toggleTask(task.id)} style={{ width:"20px", height:"20px", border:"2px solid rgba(26,26,26,0.15)", borderRadius:"8px", cursor:"pointer", flexShrink:0 }} />
                    <span style={{ fontSize:"16px", fontWeight:600, color:"rgba(26,26,26,0.75)" }}>{task.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat */}
      {screen === "chat" && (
        <div style={{ display:"flex", flexDirection:"column", height:"100vh", paddingTop:"64px", position:"relative", zIndex:1 }}>
          <div style={{ flex:1, overflowY:"auto", padding:"32px 24px" }}>
            <div style={{ maxWidth:"660px", margin:"0 auto" }}>
              {messages.length === 0 && (
                <div style={{ textAlign:"center", padding:"100px 0", color:"rgba(26,26,26,0.18)" }}>
                  <div style={{ fontSize:"48px", fontWeight:900, fontFamily:"'Nunito',sans-serif", marginBottom:"16px" }}>
                    <span className="aurora-text">Luma</span>
                  </div>
                  <div style={{ fontSize:"18px", fontWeight:600 }}>I'm here. What's on your mind?</div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom:"28px", display:"flex", flexDirection:"column", alignItems: m.role==="user"?"flex-end":"flex-start", animation:"fadeUp 0.35s ease" }}>
                  <div style={{ fontSize:"11px", fontWeight:800, color:"rgba(26,26,26,0.22)", marginBottom:"8px", padding: m.role==="user"?"0 6px 0 0":"0 0 0 6px", letterSpacing:"0.08em" }}>
                    {m.role==="user" ? (profile.name||"YOU").toUpperCase() : "LUMA"}
                  </div>
                  <div style={{ maxWidth:"84%", padding:"16px 22px", borderRadius: m.role==="user"?"22px 22px 6px 22px":"6px 22px 22px 22px", background: m.role==="user" ? "linear-gradient(135deg, rgba(0,200,150,0.12), rgba(14,165,233,0.12))" : "rgba(255,255,255,0.75)", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", border: m.role==="user" ? "0.5px solid rgba(0,200,150,0.2)" : "0.5px solid rgba(26,26,26,0.07)", color:"#1a1a1a", fontSize:"17px", lineHeight:1.72, whiteSpace:"pre-wrap", fontWeight:500, boxShadow: m.role!=="user" ? "0 2px 16px rgba(0,0,0,0.04)" : "none" }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", marginBottom:"28px" }}>
                  <div style={{ fontSize:"11px", fontWeight:800, color:"rgba(26,26,26,0.22)", marginBottom:"8px", paddingLeft:"6px", letterSpacing:"0.08em" }}>LUMA</div>
                  <div style={{ padding:"16px 22px", background:"rgba(255,255,255,0.75)", backdropFilter:"blur(20px)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"6px 22px 22px 22px", display:"flex", gap:"7px", alignItems:"center", boxShadow:"0 2px 16px rgba(0,0,0,0.04)" }}>
                    {[0,0.22,0.44].map((d,i) => (
                      <div key={i} style={{ width:"8px", height:"8px", borderRadius:"50%", background:`linear-gradient(135deg, #00c896, #0ea5e9)`, animation:`pulse 1.5s infinite ${d}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="nav-glass" style={{ padding:"14px 24px 24px", flexShrink:0, borderTop:"0.5px solid rgba(26,26,26,0.06)", borderBottom:"none" }}>
            <div style={{ maxWidth:"660px", margin:"0 auto" }}>
              <div className="input-wrap" style={{ padding:"12px 16px", display:"flex", alignItems:"flex-end", gap:"12px" }}>
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }} placeholder="Message Luma…" rows={1} style={{ flex:1, background:"transparent", border:"none", color:"#1a1a1a", fontSize:"17px", resize:"none", fontFamily:"'Nunito',sans-serif", fontWeight:600, lineHeight:1.6, maxHeight:"120px" }} onInput={e => { e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }} />
                <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim()||loading} style={{ width:"40px", height:"40px", borderRadius:"14px", background: input.trim() ? "linear-gradient(135deg, #00c896, #0ea5e9)" : "rgba(26,26,26,0.06)", border:"none", cursor: input.trim() ? "pointer" : "default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {loading ? <div style={{ width:"14px", height:"14px", border:"2.5px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim()?"#fff":"rgba(26,26,26,0.3)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>}
                </button>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:"10px", padding:"0 4px" }}>
                <div style={{ fontSize:"12px", fontWeight:600, color:"rgba(26,26,26,0.18)" }}>Enter to send · Shift+Enter for new line</div>
                <button onClick={() => setMessages([])} style={{ fontSize:"12px", fontWeight:700, color:"rgba(26,26,26,0.2)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Clear</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tasks */}
      {screen === "tasks" && (
        <div style={{ flex:1, overflowY:"auto", padding:"28px 24px", paddingTop:"92px", position:"relative", zIndex:1, minHeight:"100vh" }}>
          <div style={{ maxWidth:"660px", margin:"0 auto" }}>
            <div style={{ marginBottom:"36px", animation:"fadeUp 0.5s ease" }}>
              <h2 style={{ fontSize:"44px", fontWeight:900, letterSpacing:"-0.03em", marginBottom:"8px", color:"#1a1a1a" }}>Tasks</h2>
              <p style={{ fontSize:"17px", color:"rgba(26,26,26,0.36)", fontWeight:500 }}>Stay on top of what matters most.</p>
            </div>

            <div style={{ display:"flex", gap:"12px", marginBottom:"14px", animation:"fadeUp 0.5s ease 0.1s both" }}>
              <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key==="Enter"&&addTask()} placeholder="Add a task…" style={{ flex:1, background:"rgba(255,255,255,0.75)", border:"0.5px solid rgba(26,26,26,0.08)", borderRadius:"18px", padding:"15px 20px", color:"#1a1a1a", fontSize:"16px", fontFamily:"'Nunito',sans-serif", fontWeight:600 }} />
              <button onClick={addTask} style={{ padding:"15px 26px", background:"linear-gradient(135deg, #00c896, #0ea5e9)", border:"none", borderRadius:"18px", color:"#fff", fontSize:"16px", fontWeight:900, cursor:"pointer", fontFamily:"'Nunito',sans-serif", transition:"all 0.22s cubic-bezier(0.34,1.4,0.64,1)" }}>Add</button>
            </div>

            <button onClick={() => sendMessage("Help me organize and prioritize my tasks. Here's what I have: " + tasks.filter(t=>!t.done).map(t=>t.text).join(", "))} style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"13px 20px", background:"rgba(255,255,255,0.6)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"16px", color:"rgba(26,26,26,0.45)", fontSize:"14px", fontWeight:700, cursor:"pointer", marginBottom:"28px", width:"100%", fontFamily:"'Nunito',sans-serif", transition:"all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.9)"; e.currentTarget.style.color="rgba(26,26,26,0.7)"; }}
              onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.6)"; e.currentTarget.style.color="rgba(26,26,26,0.45)"; }}>
              Ask Luma to help prioritize
            </button>

            {tasks.filter(t=>!t.done).length > 0 && (
              <div style={{ marginBottom:"28px" }}>
                <div className="pill-label" style={{ marginBottom:"12px" }}>Pending — {tasks.filter(t=>!t.done).length}</div>
                {tasks.filter(t=>!t.done).map(task => (
                  <div key={task.id} className="task-row card" style={{ display:"flex", alignItems:"center", gap:"14px", padding:"15px 20px", borderRadius:"18px", marginBottom:"8px" }}>
                    <div onClick={() => toggleTask(task.id)} style={{ width:"22px", height:"22px", border:"2px solid rgba(26,26,26,0.15)", borderRadius:"8px", cursor:"pointer", flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:"16px", fontWeight:600, color:"rgba(26,26,26,0.78)" }}>{task.text}</span>
                    <span style={{ fontSize:"12px", fontWeight:600, color:"rgba(26,26,26,0.2)" }}>{task.created}</span>
                    <button className="del-btn" onClick={() => deleteTask(task.id)} style={{ opacity:0, background:"none", border:"none", color:"#ff453a", cursor:"pointer", fontSize:"22px", transition:"opacity 0.2s", padding:"0 4px", lineHeight:1 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {tasks.filter(t=>t.done).length > 0 && (
              <div>
                <div className="pill-label" style={{ marginBottom:"12px" }}>Completed — {tasks.filter(t=>t.done).length}</div>
                {tasks.filter(t=>t.done).map(task => (
                  <div key={task.id} className="task-row" style={{ display:"flex", alignItems:"center", gap:"14px", padding:"15px 20px", background:"rgba(255,255,255,0.45)", border:"0.5px solid rgba(26,26,26,0.05)", borderRadius:"18px", marginBottom:"8px" }}>
                    <div onClick={() => toggleTask(task.id)} style={{ width:"22px", height:"22px", background:"linear-gradient(135deg, #00c896, #0ea5e9)", border:"none", borderRadius:"8px", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <span style={{ flex:1, fontSize:"16px", fontWeight:500, color:"rgba(26,26,26,0.25)", textDecoration:"line-through" }}>{task.text}</span>
                    <button className="del-btn" onClick={() => deleteTask(task.id)} style={{ opacity:0, background:"none", border:"none", color:"#ff453a", cursor:"pointer", fontSize:"22px", transition:"opacity 0.2s", padding:"0 4px", lineHeight:1 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {tasks.length === 0 && (
              <div style={{ textAlign:"center", padding:"80px 0", color:"rgba(26,26,26,0.2)" }}>
                <div style={{ fontSize:"20px", fontWeight:800, marginBottom:"10px" }}>No tasks yet</div>
                <div style={{ fontSize:"16px", fontWeight:500 }}>Add one above or ask Luma to help you plan.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile */}
      {screen === "profile" && (
        <div style={{ flex:1, overflowY:"auto", padding:"28px 24px", paddingTop:"92px", position:"relative", zIndex:1, minHeight:"100vh" }}>
          <div style={{ maxWidth:"660px", margin:"0 auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"36px", animation:"fadeUp 0.5s ease" }}>
              <div>
                <h2 style={{ fontSize:"44px", fontWeight:900, letterSpacing:"-0.03em", marginBottom:"8px", color:"#1a1a1a" }}>Profile</h2>
                <p style={{ fontSize:"17px", color:"rgba(26,26,26,0.36)", fontWeight:500 }}>Help Luma know you better.</p>
              </div>
              <button onClick={() => editingProfile ? saveProfile() : setEditingProfile(true)} style={{ padding:"12px 24px", background: editingProfile ? "linear-gradient(135deg, #00c896, #0ea5e9)" : "rgba(255,255,255,0.75)", border:`0.5px solid ${editingProfile?"transparent":"rgba(26,26,26,0.1)"}`, borderRadius:"18px", color: editingProfile ? "#fff" : "#1a1a1a", fontSize:"15px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", transition:"all 0.22s cubic-bezier(0.34,1.4,0.64,1)" }}>
                {editingProfile ? "Save" : "Edit"}
              </button>
            </div>

            {[
              { key:"name", label:"Your Name", placeholder:"e.g. Deandre" },
              { key:"career", label:"Career and Role", placeholder:"e.g. QA Engineer, transitioning from bioengineering" },
              { key:"interests", label:"Hobbies and Interests", placeholder:"e.g. music production, photography, cooking" },
              { key:"goals", label:"Current Goals", placeholder:"e.g. get promoted, learn Swift, start a business" },
              { key:"location", label:"Location", placeholder:"e.g. San Jose, CA" }
            ].map((field, i) => (
              <div key={field.key} className="card" style={{ borderRadius:"22px", padding:"22px 24px", marginBottom:"10px", animation:`fadeUp 0.5s ease ${i*0.06+0.1}s both` }}>
                <div className="pill-label" style={{ marginBottom:"12px" }}>{field.label}</div>
                {editingProfile ? (
                  <input value={profileDraft[field.key]||""} onChange={e => setProfileDraft(p=>({...p,[field.key]:e.target.value}))} placeholder={field.placeholder} style={{ width:"100%", background:"rgba(245,242,238,0.8)", border:"0.5px solid rgba(26,26,26,0.1)", borderRadius:"14px", padding:"12px 16px", color:"#1a1a1a", fontSize:"16px", fontFamily:"'Nunito',sans-serif", fontWeight:600 }} />
                ) : (
                  <div style={{ fontSize:"17px", fontWeight:600, color: profile[field.key] ? "#1a1a1a" : "rgba(26,26,26,0.22)" }}>
                    {profile[field.key] || `Add your ${field.label.toLowerCase()}…`}
                  </div>
                )}
              </div>
            ))}

            <div className="card" style={{ borderRadius:"22px", padding:"24px", marginTop:"8px" }}>
              <div style={{ fontSize:"17px", fontWeight:800, color:"rgba(26,26,26,0.65)", marginBottom:"10px" }}>Luma knows you</div>
              <div style={{ fontSize:"16px", fontWeight:500, color:"rgba(26,26,26,0.38)", lineHeight:1.65, marginBottom:"20px" }}>
                The more you share, the more personalized every conversation becomes.
              </div>
              <button onClick={() => sendMessage("Based on my profile, what are the three most impactful things I should focus on right now to improve my life and move closer to my goals?")} style={{ padding:"13px 22px", background:"linear-gradient(135deg, #00c896, #0ea5e9)", border:"none", borderRadius:"16px", color:"#fff", fontSize:"15px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", transition:"all 0.22s cubic-bezier(0.34,1.4,0.64,1)" }}>
                Ask Luma for personalized advice
              </button>
            </div>

            <div style={{ textAlign:"center", marginTop:"24px", paddingBottom:"8px" }}>
              <button onClick={() => { setShowOnboarding(true); setOnboardingStep(0); setOnboardingInput(""); setOnboardingData({}); }} style={{ fontSize:"13px", fontWeight:700, color:"rgba(26,26,26,0.22)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                Redo onboarding
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}