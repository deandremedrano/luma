import { useState, useEffect, useRef } from "react";

const OLLAMA_URL = "http://localhost:11434/api/chat";
const MAX_MEMORY_MESSAGES = 50;
const MAX_SUMMARY_MESSAGES = 10;

const LUMA_SYSTEM = (profile, memoryContext) => {
  const conditionGuidance = {
    adhd: "The user has ADHD. Use SHORT paragraphs. Be energetic and direct. Break everything into bullet points. Celebrate momentum. Never give long walls of text. End with ONE specific next action.",
    anxiety: "The user has anxiety. Be calm, structured, and reassuring. Always explain your reasoning. No surprises. Validate feelings first. Provide structured options.",
    depression: "The user has depression. Be warm, gentle, never overwhelming. Celebrate the tiniest wins. Never push harder than they can handle. One small thing at a time. Lead with compassion.",
    autism: "The user is autistic. Be literal and precise. Never use idioms, sarcasm, or vague language. Be consistent and structured. Mean exactly what you say.",
    executive_dysfunction: "The user has executive dysfunction. Break everything into the absolute smallest possible steps. Ask questions rather than waiting. Keep responses digestible.",
    ptsd: "The user has PTSD. Be gentle. Never use triggering language. Always ask before giving advice. Respect boundaries. Focus on safety and grounding first.",
    general: ""
  };

  const condition = profile.condition || "general";
  const conditionNote = conditionGuidance[condition] || "";

  return `You are Luma, a warm, intelligent, deeply personal AI life companion and the most caring support system anyone has ever had.

${conditionNote}

Your core personality:
- Genuinely warm and caring — like a best friend who happens to be very wise
- Adaptive — you change your communication style completely based on the user's needs
- Honest but kind — you give real help, not just validation
- Proactive — you notice patterns across conversations and bring them up naturally
- Comfort and success are your only goals

MEMORY RULES — CRITICAL:
- You have access to the user's conversation history below
- Reference past conversations naturally — like a friend who remembers
- If you notice patterns (recurring stress, consistent goals, repeated topics) mention them gently
- Never make the user feel surveilled — use memory warmly, not clinically
- If they mentioned something important last time, ask about it naturally

IMPORTANT RULES:
- Always ask one gentle question first to understand how the person is doing TODAY
- Celebrate every win no matter how small
- Never shame, never pressure, never overwhelm
- If someone seems to be struggling emotionally, address that FIRST
- Break every task into the smallest possible step
- End every response with ONE clear, gentle next step
- If someone says they're having a hard day, switch to comfort mode immediately

User Profile:
${profile.name ? `Name: ${profile.name}` : ""}
${profile.career ? `Career: ${profile.career}` : ""}
${profile.interests ? `Interests: ${profile.interests}` : ""}
${profile.goals ? `Goals: ${profile.goals}` : ""}
${profile.condition && profile.condition !== "none" ? `Condition: ${profile.condition}` : ""}
${profile.hardDay ? `Hard day looks like: ${profile.hardDay}` : ""}

${memoryContext ? `MEMORY FROM PAST CONVERSATIONS:
${memoryContext}

Use this memory to make the conversation feel continuous and personal. Reference it naturally when relevant.` : ""}`;
};

const GREETING = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const ONBOARDING_STEPS = [
  { key:"name", question:"Hey. Let's start simple — what should I call you?", placeholder:"Your name…", hint:"This helps every conversation feel personal.", type:"text" },
  { key:"feeling", question:"How are you feeling today — honestly?", placeholder:"e.g. Pretty good, exhausted, anxious, okay I guess…", hint:"No right answer. Luma meets you where you are.", type:"text" },
  { key:"condition", question:"Do you have any conditions that affect your daily life?", placeholder:"", hint:"Completely optional and 100% private. Helps Luma communicate in the way that works best for your brain.", type:"select", options:[
    { value:"none", label:"None or prefer not to say" },
    { value:"adhd", label:"ADHD" },
    { value:"anxiety", label:"Anxiety" },
    { value:"depression", label:"Depression" },
    { value:"autism", label:"Autism / Asperger's" },
    { value:"executive_dysfunction", label:"Executive Dysfunction" },
    { value:"ptsd", label:"PTSD" },
    { value:"general", label:"Something else" }
  ]},
  { key:"hardDay", question:"What does a really hard day look like for you?", placeholder:"e.g. I can't get out of bed, I feel frozen, I forget everything…", hint:"Luma will recognize these signs and respond with extra care.", type:"text" },
  { key:"goals", question:"What's the one thing you most want Luma's help with?", placeholder:"e.g. staying organized, managing anxiety, growing my career…", hint:"This becomes Luma's north star for everything it does for you.", type:"text" }
];

const conditionColors = { adhd:"#0ea5e9", anxiety:"#8b5cf6", depression:"#00c896", autism:"#ec4899", executive_dysfunction:"#f59e0b", ptsd:"#f97316", general:"rgba(26,26,26,0.3)" };
const conditionLabels = { adhd:"ADHD", anxiety:"Anxiety", depression:"Depression", autism:"Autism", executive_dysfunction:"Executive Dysfunction", ptsd:"PTSD", general:"Other", none:"" };

// ── Memory utilities ────────────────────────────────────────────────────────

function saveConversation(messages, profile) {
  if (!messages.length) return;
  try {
    const existing = JSON.parse(localStorage.getItem("luma_conversations") || "[]");
    const session = {
      id: Date.now(),
      date: new Date().toISOString(),
      dateLabel: new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", hour:"numeric", minute:"2-digit" }),
      messages: messages.slice(-MAX_SUMMARY_MESSAGES),
      messageCount: messages.length,
      profile: { name: profile.name, condition: profile.condition }
    };
    const updated = [session, ...existing].slice(0, 30);
    localStorage.setItem("luma_conversations", JSON.stringify(updated));
  } catch (e) { console.error("Memory save error:", e); }
}

function buildMemoryContext(conversations) {
  if (!conversations.length) return "";
  const recent = conversations.slice(0, 8);
  return recent.map(conv => {
    const msgs = conv.messages
      .filter(m => m.role !== "system")
      .map(m => `${m.role === "user" ? "User" : "Luma"}: ${m.content.slice(0, 200)}`)
      .join("\n");
    return `[${conv.dateLabel}]\n${msgs}`;
  }).join("\n\n---\n\n");
}

function extractMemoryHighlights(conversations) {
  if (!conversations.length) return [];
  const highlights = [];
  conversations.slice(0, 5).forEach(conv => {
    const lastUser = conv.messages.filter(m => m.role === "user").slice(-1)[0];
    const lastLuma = conv.messages.filter(m => m.role === "assistant").slice(-1)[0];
    if (lastUser && lastLuma) {
      highlights.push({
        date: conv.dateLabel,
        topic: lastUser.content.slice(0, 80),
        response: lastLuma.content.slice(0, 120),
        id: conv.id
      });
    }
  });
  return highlights;
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(() => { try { return JSON.parse(localStorage.getItem("luma_profile")||"{}"); } catch { return {}; } });
  const [tasks, setTasks] = useState(() => { try { return JSON.parse(localStorage.getItem("luma_tasks")||"[]"); } catch { return []; } });
  const [conversations, setConversations] = useState(() => { try { return JSON.parse(localStorage.getItem("luma_conversations")||"[]"); } catch { return []; } });
  const [newTask, setNewTask] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(profile);
  const [ollamaStatus, setOllamaStatus] = useState("checking");
  const [showOnboarding, setShowOnboarding] = useState(!localStorage.getItem("luma_profile")||!JSON.parse(localStorage.getItem("luma_profile")||"{}").name);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingData, setOnboardingData] = useState({});
  const [onboardingInput, setOnboardingInput] = useState("");
  const [onboardingSelect, setOnboardingSelect] = useState("none");
  const [isListening, setIsListening] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);
  useEffect(() => { localStorage.setItem("luma_profile", JSON.stringify(profile)); }, [profile]);
  useEffect(() => { localStorage.setItem("luma_tasks", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { fetch("http://localhost:11434/api/tags").then(() => setOllamaStatus("online")).catch(() => setOllamaStatus("offline")); }, []);

  // Auto-save conversation when user navigates away or closes
  useEffect(() => {
    const handleUnload = () => { if (messages.length > 0) saveConversation(messages, profile); };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [messages, profile]);

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) { alert("Voice requires Chrome."); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SR();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "en-US";
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onresult = (e) => { setInput(p => p + (p?" ":"") + e.results[0][0].transcript); setIsListening(false); };
    recognitionRef.current.onerror = () => setIsListening(false);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.start();
  };

  const stopListening = () => { recognitionRef.current?.stop(); setIsListening(false); };

  const sendMessage = async (text) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setInput("");
    const userMsg = { role:"user", content:msg };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    setScreen("chat");

    const memoryContext = buildMemoryContext(conversations);

    try {
      const res = await fetch(OLLAMA_URL, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"mistral-nemo:latest",
          messages:[
            { role:"system", content:LUMA_SYSTEM(profile, memoryContext) },
            ...updated.slice(-MAX_MEMORY_MESSAGES)
          ],
          stream:false
        })
      });
      const data = await res.json();
      const reply = data.message?.content || "Connection error.";
      setMessages(prev => [...prev, { role:"assistant", content:reply }]);
    } catch {
      setMessages(prev => [...prev, { role:"assistant", content:"Couldn't connect to Ollama. Make sure it's running on your Mac." }]);
    }
    setLoading(false);
  };

  const saveCurrentSession = () => {
    if (messages.length === 0) return;
    saveConversation(messages, profile);
    const updated = JSON.parse(localStorage.getItem("luma_conversations") || "[]");
    setConversations(updated);
    setSessionSaved(true);
    setTimeout(() => setSessionSaved(false), 2000);
  };

  const clearCurrentChat = () => {
    if (messages.length > 0) saveConversation(messages, profile);
    const updated = JSON.parse(localStorage.getItem("luma_conversations") || "[]");
    setConversations(updated);
    setMessages([]);
  };

  const deleteConversation = (id) => {
    const updated = conversations.filter(c => c.id !== id);
    setConversations(updated);
    localStorage.setItem("luma_conversations", JSON.stringify(updated));
  };

  const loadConversation = (conv) => {
    setMessages(conv.messages);
    setScreen("chat");
    setShowMemory(false);
  };

  const nextOnboardingStep = () => {
    const step = ONBOARDING_STEPS[onboardingStep];
    const value = step.type === "select" ? onboardingSelect : onboardingInput;
    const updated = { ...onboardingData, [step.key]: value };
    setOnboardingData(updated);
    setOnboardingInput("");
    setOnboardingSelect("none");
    if (onboardingStep < ONBOARDING_STEPS.length - 1) { setOnboardingStep(s => s+1); }
    else { setProfile(updated); setShowOnboarding(false); }
  };

  const skipOnboarding = () => { setProfile(onboardingData); setShowOnboarding(false); };
  const addTask = () => { if (!newTask.trim()) return; setTasks(prev => [...prev, { id:Date.now(), text:newTask, done:false, created:new Date().toLocaleDateString() }]); setNewTask(""); };
  const toggleTask = (id) => setTasks(prev => prev.map(t => t.id===id ? {...t,done:!t.done} : t));
  const deleteTask = (id) => setTasks(prev => prev.filter(t => t.id!==id));
  const saveProfile = () => { setProfile(profileDraft); setEditingProfile(false); };

  const currentStep = ONBOARDING_STEPS[onboardingStep];
  const memoryHighlights = extractMemoryHighlights(conversations);
  const lastSession = conversations[0];

  return (
    <div style={{ minHeight:"100vh", background:"#f5f2ee", fontFamily:"'Nunito',-apple-system,sans-serif", color:"#1a1a1a", position:"relative", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        @keyframes aurora1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.08)}66%{transform:translate(-30px,20px) scale(0.95)}}
        @keyframes aurora2{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-35px,25px) scale(1.05)}66%{transform:translate(25px,-35px) scale(0.97)}}
        @keyframes aurora3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,30px) scale(1.06)}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.3;transform:scale(0.75)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(48px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,69,58,0.4)}50%{box-shadow:0 0 0 10px rgba(255,69,58,0)}}
        @keyframes slideRight{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:0;}
        ::placeholder{color:rgba(26,26,26,0.25);font-family:'Nunito',sans-serif;}
        textarea:focus,input:focus,select:focus{outline:none;}
        .aurora-text{background:linear-gradient(135deg,#00c896,#0ea5e9,#8b5cf6,#ec4899,#00c896);background-size:300% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 6s linear infinite;}
        .nav-glass{background:rgba(245,242,238,0.82);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border-bottom:0.5px solid rgba(26,26,26,0.06);}
        .nav-btn{background:transparent;border:none;color:rgba(26,26,26,0.38);font-size:15px;font-weight:700;cursor:pointer;padding:8px 18px;border-radius:100px;transition:all 0.2s;font-family:'Nunito',sans-serif;}
        .nav-btn:hover{color:#1a1a1a;background:rgba(26,26,26,0.06);}
        .nav-btn.active{color:#1a1a1a;background:rgba(26,26,26,0.08);}
        .card{background:rgba(255,255,255,0.75);border:0.5px solid rgba(26,26,26,0.07);border-radius:24px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:all 0.3s cubic-bezier(0.34,1.4,0.64,1);}
        .card:hover{background:rgba(255,255,255,0.92);transform:translateY(-2px);box-shadow:0 8px 40px rgba(0,0,0,0.06);}
        .input-wrap{background:rgba(255,255,255,0.75);border:0.5px solid rgba(26,26,26,0.09);border-radius:28px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);transition:border-color 0.2s,box-shadow 0.2s;}
        .input-wrap:focus-within{border-color:rgba(26,26,26,0.15);box-shadow:0 4px 32px rgba(0,0,0,0.06);}
        .suggest-btn{background:rgba(255,255,255,0.6);border:0.5px solid rgba(26,26,26,0.07);border-radius:18px;padding:18px 22px;cursor:pointer;color:#1a1a1a;font-size:17px;font-weight:700;font-family:'Nunito',sans-serif;text-align:left;display:flex;align-items:center;justify-content:space-between;transition:all 0.25s cubic-bezier(0.34,1.4,0.64,1);width:100%;}
        .suggest-btn:hover{background:rgba(255,255,255,0.92);border-color:rgba(26,26,26,0.12);transform:translateY(-2px);box-shadow:0 6px 28px rgba(0,0,0,0.07);}
        .send-btn{transition:all 0.22s cubic-bezier(0.34,1.4,0.64,1);}
        .send-btn:hover:not(:disabled){transform:scale(1.08);}
        .send-btn:active:not(:disabled){transform:scale(0.95);}
        .mic-btn{transition:all 0.22s cubic-bezier(0.34,1.4,0.64,1);}
        .mic-btn:hover{transform:scale(1.05);}
        .mic-btn.listening{animation:micPulse 1.5s ease-in-out infinite;}
        .task-row:hover .del-btn{opacity:1!important;}
        .mem-card:hover .mem-del{opacity:1!important;}
        .pill-label{font-size:11px;font-weight:800;color:rgba(26,26,26,0.3);letter-spacing:0.1em;text-transform:uppercase;}
        .pill{display:inline-flex;align-items:center;gap:7px;padding:5px 14px;background:rgba(255,255,255,0.7);border:0.5px solid rgba(26,26,26,0.07);border-radius:100px;font-size:12px;font-weight:800;color:rgba(26,26,26,0.45);letter-spacing:0.06em;text-transform:uppercase;backdrop-filter:blur(10px);}
        .pill-dot{width:6px;height:6px;border-radius:50%;background:linear-gradient(135deg,#00c896,#0ea5e9);animation:pulse 2s infinite;}
        .ob-input{width:100%;background:rgba(255,255,255,0.85);border:0.5px solid rgba(26,26,26,0.1);border-radius:18px;padding:18px 22px;color:#1a1a1a;font-size:17px;font-family:'Nunito',sans-serif;font-weight:600;transition:all 0.2s;}
        .ob-input:focus{border-color:rgba(14,165,233,0.35);box-shadow:0 0 0 4px rgba(14,165,233,0.08);}
        .ob-select{width:100%;background:rgba(255,255,255,0.85);border:0.5px solid rgba(26,26,26,0.1);border-radius:18px;padding:18px 22px;color:#1a1a1a;font-size:17px;font-family:'Nunito',sans-serif;font-weight:600;transition:all 0.2s;appearance:none;cursor:pointer;}
        .ob-select:focus{border-color:rgba(14,165,233,0.35);box-shadow:0 0 0 4px rgba(14,165,233,0.08);}
        .ob-btn{padding:16px 36px;border:none;border-radius:18px;font-size:17px;font-weight:900;cursor:pointer;font-family:'Nunito',sans-serif;transition:all 0.25s cubic-bezier(0.34,1.4,0.64,1);background:linear-gradient(135deg,#00c896,#0ea5e9);color:#fff;}
        .ob-btn:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 8px 32px rgba(14,165,233,0.25);}
        .section-scroll{flex:1;overflow-y:auto;padding:28px 24px;}
        .luma-logo{font-size:22px;font-weight:900;letter-spacing:-0.02em;cursor:pointer;font-family:'Nunito',sans-serif;}
        .memory-panel{position:fixed;top:64px;right:0;bottom:0;width:320px;background:rgba(245,242,238,0.96);backdrop-filter:blur(40px);border-left:0.5px solid rgba(26,26,26,0.07);z-index:90;overflow-y:auto;padding:24px;animation:slideRight 0.3s ease;}
        .mem-card{background:rgba(255,255,255,0.75);border:0.5px solid rgba(26,26,26,0.07);border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:all 0.2s;}
        .mem-card:hover{background:rgba(255,255,255,0.95);transform:translateY(-1px);box-shadow:0 4px 20px rgba(0,0,0,0.06);}
      `}</style>

      {/* Aurora orbs */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"-10%", left:"-5%", width:"700px", height:"500px", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(0,200,150,0.18) 0%, transparent 70%)", filter:"blur(60px)", animation:"aurora1 18s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"20%", right:"-10%", width:"600px", height:"600px", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(14,165,233,0.15) 0%, transparent 70%)", filter:"blur(60px)", animation:"aurora2 22s ease-in-out infinite" }} />
        <div style={{ position:"absolute", bottom:"-5%", left:"20%", width:"550px", height:"400px", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(139,92,246,0.13) 0%, transparent 70%)", filter:"blur(60px)", animation:"aurora3 26s ease-in-out infinite" }} />
        <div style={{ position:"absolute", top:"50%", left:"40%", width:"400px", height:"400px", borderRadius:"50%", background:"radial-gradient(ellipse, rgba(236,72,153,0.09) 0%, transparent 70%)", filter:"blur(60px)", animation:"aurora1 30s ease-in-out infinite reverse" }} />
      </div>

      {/* Onboarding */}
      {showOnboarding && (
        <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(245,242,238,0.9)", backdropFilter:"blur(24px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", animation:"fadeIn 0.4s ease" }}>
          <div style={{ background:"rgba(255,255,255,0.88)", border:"0.5px solid rgba(26,26,26,0.08)", borderRadius:"36px", padding:"52px 48px", maxWidth:"500px", width:"100%", animation:"slideUp 0.5s cubic-bezier(0.34,1.2,0.64,1)", boxShadow:"0 24px 80px rgba(0,0,0,0.08)" }}>
            <div style={{ display:"flex", gap:"8px", marginBottom:"40px", justifyContent:"center" }}>
              {ONBOARDING_STEPS.map((_,i) => (
                <div key={i} style={{ width:i===onboardingStep?"28px":"8px", height:"8px", borderRadius:"100px", background:i<=onboardingStep?"linear-gradient(90deg,#00c896,#0ea5e9)":"rgba(26,26,26,0.1)", transition:"all 0.35s cubic-bezier(0.34,1.4,0.64,1)" }} />
              ))}
            </div>
            <div style={{ textAlign:"center", marginBottom:"36px" }}>
              <div style={{ fontSize:"40px", fontWeight:900, letterSpacing:"-0.02em", marginBottom:"6px" }}><span className="aurora-text">Luma</span></div>
              <div style={{ fontSize:"13px", fontWeight:700, color:"rgba(26,26,26,0.3)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Your life. Illuminated.</div>
            </div>
            <div style={{ marginBottom:"24px" }}>
              <h2 style={{ fontSize:"24px", fontWeight:800, letterSpacing:"-0.02em", lineHeight:1.3, marginBottom:"10px" }}>{currentStep.question}</h2>
              <p style={{ fontSize:"14px", color:"rgba(26,26,26,0.38)", fontWeight:500, lineHeight:1.6 }}>{currentStep.hint}</p>
            </div>
            {currentStep.type === "select" ? (
              <select className="ob-select" value={onboardingSelect} onChange={e => setOnboardingSelect(e.target.value)}>
                {currentStep.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            ) : (
              <input className="ob-input" value={onboardingInput} onChange={e => setOnboardingInput(e.target.value)} onKeyDown={e => e.key==="Enter"&&nextOnboardingStep()} placeholder={currentStep.placeholder} autoFocus />
            )}
            <div style={{ display:"flex", gap:"12px", marginTop:"20px", alignItems:"center" }}>
              <button className="ob-btn" onClick={nextOnboardingStep} style={{ flex:1 }}>
                {onboardingStep < ONBOARDING_STEPS.length-1 ? "Continue" : "Start with Luma"}
              </button>
              <button onClick={skipOnboarding} style={{ background:"none", border:"none", color:"rgba(26,26,26,0.28)", fontSize:"14px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif", padding:"8px 12px" }}>Skip</button>
            </div>
            {onboardingStep > 0 && (
              <button onClick={() => { setOnboardingStep(s=>s-1); setOnboardingInput(""); }} style={{ background:"none", border:"none", color:"rgba(26,26,26,0.22)", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif", marginTop:"14px", display:"block", width:"100%", textAlign:"center" }}>Back</button>
            )}
          </div>
        </div>
      )}

      {/* Memory Panel */}
      {showMemory && (
        <div className="memory-panel">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
            <div style={{ fontSize:"17px", fontWeight:800 }}>Memory</div>
            <button onClick={() => setShowMemory(false)} style={{ background:"none", border:"none", fontSize:"20px", color:"rgba(26,26,26,0.3)", cursor:"pointer", lineHeight:1 }}>×</button>
          </div>
          <p style={{ fontSize:"13px", color:"rgba(26,26,26,0.4)", fontWeight:500, lineHeight:1.6, marginBottom:"20px" }}>
            Luma remembers your past conversations and uses them to give you more personalized support.
          </p>
          {conversations.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(26,26,26,0.22)" }}>
              <div style={{ fontSize:"15px", fontWeight:700, marginBottom:"8px" }}>No memories yet</div>
              <div style={{ fontSize:"13px", fontWeight:500 }}>Start chatting and Luma will remember your conversations.</div>
            </div>
          ) : conversations.map(conv => (
            <div key={conv.id} className="mem-card" onClick={() => loadConversation(conv)}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                <div style={{ fontSize:"11px", fontWeight:800, color:"rgba(26,26,26,0.3)", letterSpacing:"0.06em", textTransform:"uppercase" }}>{conv.dateLabel}</div>
                <button className="mem-del" onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }} style={{ opacity:0, background:"none", border:"none", color:"#ff453a", cursor:"pointer", fontSize:"16px", transition:"opacity 0.2s", lineHeight:1, padding:"0 2px" }}>×</button>
              </div>
              <div style={{ fontSize:"14px", fontWeight:600, color:"rgba(26,26,26,0.75)", lineHeight:1.5, marginBottom:"4px" }}>
                {conv.messages.filter(m=>m.role==="user")[0]?.content.slice(0,80)}…
              </div>
              <div style={{ fontSize:"12px", fontWeight:500, color:"rgba(26,26,26,0.35)" }}>{conv.messageCount} messages</div>
            </div>
          ))}
          {conversations.length > 0 && (
            <button onClick={() => { setConversations([]); localStorage.removeItem("luma_conversations"); }} style={{ width:"100%", padding:"12px", background:"rgba(255,69,58,0.06)", border:"0.5px solid rgba(255,69,58,0.15)", borderRadius:"12px", color:"#ff453a", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif", marginTop:"12px" }}>
              Clear all memories
            </button>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="nav-glass" style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, height:"64px", display:"flex", alignItems:"center", padding:"0 40px", justifyContent:"space-between" }}>
        <div className="luma-logo aurora-text" onClick={() => setScreen("home")}>Luma</div>
        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          {profile.condition && profile.condition !== "none" && (
            <span style={{ fontSize:"11px", fontWeight:800, color:conditionColors[profile.condition], background:`${conditionColors[profile.condition]}15`, padding:"4px 10px", borderRadius:"100px", marginRight:"4px" }}>
              {conditionLabels[profile.condition]}
            </span>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:"5px", marginRight:"8px" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:ollamaStatus==="online"?"#00c896":"#ff453a", boxShadow:ollamaStatus==="online"?"0 0 8px rgba(0,200,150,0.5)":"0 0 8px rgba(255,69,58,0.5)" }} />
            <span style={{ fontSize:"13px", fontWeight:700, color:ollamaStatus==="online"?"#00a87c":"#ff453a" }}>{ollamaStatus==="online"?"Connected":"Offline"}</span>
          </div>
          {[["home","Home"],["chat","Chat"],["tasks","Tasks"],["profile","Profile"]].map(([s,l]) => (
            <button key={s} className={`nav-btn ${screen===s?"active":""}`} onClick={() => setScreen(s)}>{l}</button>
          ))}
          <button className={`nav-btn ${showMemory?"active":""}`} onClick={() => setShowMemory(m=>!m)} style={{ position:"relative" }}>
            Memory
            {conversations.length > 0 && <span style={{ position:"absolute", top:"4px", right:"8px", width:"6px", height:"6px", borderRadius:"50%", background:"linear-gradient(135deg,#00c896,#0ea5e9)" }} />}
          </button>
        </div>
      </nav>

      {/* HOME */}
      {screen === "home" && (
        <div className="section-scroll" style={{ paddingTop:"92px", position:"relative", zIndex:1, minHeight:"100vh" }}>
          <div style={{ maxWidth:"720px", margin:"0 auto" }}>

            {/* Last session recall */}
            {lastSession && (
              <div style={{ background:"rgba(255,255,255,0.65)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"20px", padding:"16px 20px", marginBottom:"28px", backdropFilter:"blur(20px)", animation:"fadeUp 0.5s ease", cursor:"pointer" }} onClick={() => loadConversation(lastSession)}>
                <div style={{ fontSize:"11px", fontWeight:800, color:"rgba(26,26,26,0.3)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"6px" }}>Continue from last time · {lastSession.dateLabel}</div>
                <div style={{ fontSize:"15px", fontWeight:600, color:"rgba(26,26,26,0.65)", lineHeight:1.5 }}>
                  "{lastSession.messages.filter(m=>m.role==="user")[0]?.content.slice(0,100)}…"
                </div>
              </div>
            )}

            <div style={{ marginBottom:"20px", animation:"fadeUp 0.6s ease" }}>
              <div className="pill" style={{ marginBottom:"20px" }}>
                <div className="pill-dot" />
                {GREETING()}{profile.name?`, ${profile.name}`:""} &nbsp;·&nbsp; {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
              </div>
              <h1 style={{ fontSize:"clamp(44px,7vw,72px)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.05, marginBottom:"20px", color:"#1a1a1a" }}>
                Your life.<br /><span className="aurora-text">Illuminated.</span>
              </h1>
              <p style={{ fontSize:"clamp(17px,2vw,20px)", color:"rgba(26,26,26,0.45)", lineHeight:1.65, fontWeight:500, maxWidth:"520px" }}>
                I'm here for you — your career, your goals, your hard days, and everything in between.
              </p>
            </div>

            <div style={{ animation:"fadeUp 0.6s ease 0.1s both", marginBottom:"36px" }}>
              <div className="input-wrap" style={{ padding:"18px 20px", display:"flex", alignItems:"flex-end", gap:"12px" }}>
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }} placeholder={`What can I help you with${profile.name?`, ${profile.name}`:""}?`} rows={1} style={{ flex:1, background:"transparent", border:"none", color:"#1a1a1a", fontSize:"17px", resize:"none", fontFamily:"'Nunito',sans-serif", fontWeight:600, lineHeight:1.6, maxHeight:"160px", overflowY:"auto" }} onInput={e => { e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,160)+"px"; }} />
                <button className={`mic-btn ${isListening?"listening":""}`} onClick={isListening?stopListening:startListening} style={{ width:"44px", height:"44px", borderRadius:"14px", background:isListening?"#ff453a":"rgba(26,26,26,0.07)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={isListening?"#fff":"rgba(26,26,26,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                </button>
                <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim()||loading} style={{ width:"44px", height:"44px", borderRadius:"14px", background:input.trim()?"linear-gradient(135deg,#00c896,#0ea5e9)":"rgba(26,26,26,0.06)", border:"none", cursor:input.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {loading?<div style={{ width:"16px", height:"16px", border:"2.5px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim()?"#fff":"rgba(26,26,26,0.3)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>}
                </button>
              </div>
              <div style={{ fontSize:"12px", fontWeight:600, color:"rgba(26,26,26,0.18)", marginTop:"10px", paddingLeft:"4px" }}>
                {isListening?"Listening… tap mic to stop":"Tap mic to speak · Enter to send"}
              </div>
            </div>

            <div style={{ animation:"fadeUp 0.6s ease 0.2s both" }}>
              <div className="pill-label" style={{ marginBottom:"14px" }}>Suggested</div>
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {[
                  { label:"How are you doing today?", prompt:"Hey Luma. Check in with me — ask me how I'm doing and then help me figure out what kind of support I need today." },
                  { label:"Help me start my day", prompt:"Give me my morning briefing. Help me start with intention — keep it gentle and simple." },
                  { label:"I need help with something", prompt:"I need your help with something. Ask me what it is and then let's work through it together at my own pace." }
                ].map(s => (
                  <button key={s.label} className="suggest-btn" onClick={() => sendMessage(s.prompt)}>
                    <span>{s.label}</span>
                    <span style={{ fontSize:"16px", opacity:0.25, marginLeft:"12px" }}>→</span>
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
                    <span style={{ fontSize:"16px", fontWeight:600, color:"rgba(26,26,26,0.72)" }}>{task.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHAT */}
      {screen === "chat" && (
        <div style={{ display:"flex", flexDirection:"column", height:"100vh", paddingTop:"64px", position:"relative", zIndex:1 }}>
          <div style={{ flex:1, overflowY:"auto", padding:"32px 24px" }}>
            <div style={{ maxWidth:"720px", margin:"0 auto" }}>
              {messages.length === 0 && (
                <div style={{ textAlign:"center", padding:"100px 0" }}>
                  <div style={{ fontSize:"48px", fontWeight:900, marginBottom:"16px" }}><span className="aurora-text">Luma</span></div>
                  <div style={{ fontSize:"18px", fontWeight:600, color:"rgba(26,26,26,0.3)" }}>I'm here. What's on your mind?</div>
                  {conversations.length > 0 && (
                    <div style={{ marginTop:"24px", fontSize:"14px", fontWeight:600, color:"rgba(26,26,26,0.3)" }}>
                      I remember our past {conversations.length} conversation{conversations.length!==1?"s":""} — I'll use them to give you more personalized support.
                    </div>
                  )}
                </div>
              )}
              {messages.map((m,i) => (
                <div key={i} style={{ marginBottom:"28px", display:"flex", flexDirection:"column", alignItems:m.role==="user"?"flex-end":"flex-start", animation:"fadeUp 0.35s ease" }}>
                  <div style={{ fontSize:"11px", fontWeight:800, color:"rgba(26,26,26,0.22)", marginBottom:"8px", padding:m.role==="user"?"0 6px 0 0":"0 0 0 6px", letterSpacing:"0.08em" }}>
                    {m.role==="user"?(profile.name||"YOU").toUpperCase():"LUMA"}
                  </div>
                  <div style={{ maxWidth:"82%", padding:"16px 22px", borderRadius:m.role==="user"?"22px 22px 6px 22px":"6px 22px 22px 22px", background:m.role==="user"?"linear-gradient(135deg,rgba(0,200,150,0.1),rgba(14,165,233,0.1))":"rgba(255,255,255,0.82)", backdropFilter:"blur(20px)", border:m.role==="user"?"0.5px solid rgba(0,200,150,0.18)":"0.5px solid rgba(26,26,26,0.07)", color:"#1a1a1a", fontSize:"17px", lineHeight:1.72, whiteSpace:"pre-wrap", fontWeight:500, boxShadow:m.role!=="user"?"0 2px 16px rgba(0,0,0,0.04)":"none" }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", marginBottom:"28px" }}>
                  <div style={{ fontSize:"11px", fontWeight:800, color:"rgba(26,26,26,0.22)", marginBottom:"8px", paddingLeft:"6px", letterSpacing:"0.08em" }}>LUMA</div>
                  <div style={{ padding:"16px 22px", background:"rgba(255,255,255,0.82)", backdropFilter:"blur(20px)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"6px 22px 22px 22px", display:"flex", gap:"7px", alignItems:"center", boxShadow:"0 2px 16px rgba(0,0,0,0.04)" }}>
                    {[0,0.22,0.44].map((d,i) => <div key={i} style={{ width:"8px", height:"8px", borderRadius:"50%", background:"linear-gradient(135deg,#00c896,#0ea5e9)", animation:`pulse 1.5s infinite ${d}s` }} />)}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
          <div className="nav-glass" style={{ padding:"14px 40px 24px", flexShrink:0, borderTop:"0.5px solid rgba(26,26,26,0.06)" }}>
            <div style={{ maxWidth:"720px", margin:"0 auto" }}>
              <div className="input-wrap" style={{ padding:"12px 16px", display:"flex", alignItems:"flex-end", gap:"10px" }}>
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} }} placeholder="Message Luma… or tap mic to speak" rows={1} style={{ flex:1, background:"transparent", border:"none", color:"#1a1a1a", fontSize:"16px", resize:"none", fontFamily:"'Nunito',sans-serif", fontWeight:600, lineHeight:1.6, maxHeight:"120px" }} onInput={e => { e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,120)+"px"; }} />
                <button className={`mic-btn ${isListening?"listening":""}`} onClick={isListening?stopListening:startListening} style={{ width:"38px", height:"38px", borderRadius:"12px", background:isListening?"#ff453a":"rgba(26,26,26,0.06)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={isListening?"#fff":"rgba(26,26,26,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                </button>
                <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim()||loading} style={{ width:"38px", height:"38px", borderRadius:"12px", background:input.trim()?"linear-gradient(135deg,#00c896,#0ea5e9)":"rgba(26,26,26,0.06)", border:"none", cursor:input.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {loading?<div style={{ width:"14px", height:"14px", border:"2.5px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim()?"#fff":"rgba(26,26,26,0.3)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>}
                </button>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:"10px" }}>
                <div style={{ fontSize:"12px", fontWeight:600, color:"rgba(26,26,26,0.18)" }}>{isListening?"Listening… tap mic to stop":"Enter to send · Shift+Enter for new line"}</div>
                <div style={{ display:"flex", gap:"12px" }}>
                  <button onClick={saveCurrentSession} style={{ fontSize:"12px", fontWeight:700, color:sessionSaved?"#00c896":"rgba(26,26,26,0.2)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif", transition:"color 0.2s" }}>
                    {sessionSaved?"✓ Saved":"Save"}
                  </button>
                  <button onClick={clearCurrentChat} style={{ fontSize:"12px", fontWeight:700, color:"rgba(26,26,26,0.2)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>New chat</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TASKS */}
      {screen === "tasks" && (
        <div className="section-scroll" style={{ paddingTop:"92px", position:"relative", zIndex:1, minHeight:"100vh" }}>
          <div style={{ maxWidth:"720px", margin:"0 auto" }}>
            <div style={{ marginBottom:"36px", animation:"fadeUp 0.5s ease" }}>
              <h2 style={{ fontSize:"clamp(36px,5vw,52px)", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"8px" }}>Tasks</h2>
              <p style={{ fontSize:"17px", color:"rgba(26,26,26,0.36)", fontWeight:500 }}>One step at a time. Every step counts.</p>
            </div>
            <div style={{ display:"flex", gap:"12px", marginBottom:"14px", animation:"fadeUp 0.5s ease 0.1s both" }}>
              <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key==="Enter"&&addTask()} placeholder="Add a task — as small as you need it to be…" style={{ flex:1, background:"rgba(255,255,255,0.75)", border:"0.5px solid rgba(26,26,26,0.08)", borderRadius:"18px", padding:"15px 20px", color:"#1a1a1a", fontSize:"16px", fontFamily:"'Nunito',sans-serif", fontWeight:600 }} />
              <button onClick={addTask} style={{ padding:"15px 26px", background:"linear-gradient(135deg,#00c896,#0ea5e9)", border:"none", borderRadius:"18px", color:"#fff", fontSize:"16px", fontWeight:900, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Add</button>
            </div>
            <button onClick={() => sendMessage("Help me with my tasks. Break them into the smallest possible steps and help me figure out where to start — gently, no pressure. Here's what I have: " + tasks.filter(t=>!t.done).map(t=>t.text).join(", "))} style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"13px 20px", background:"rgba(255,255,255,0.6)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"16px", color:"rgba(26,26,26,0.45)", fontSize:"14px", fontWeight:700, cursor:"pointer", marginBottom:"28px", width:"100%", fontFamily:"'Nunito',sans-serif", transition:"all 0.2s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.92)";e.currentTarget.style.color="rgba(26,26,26,0.7)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.6)";e.currentTarget.style.color="rgba(26,26,26,0.45)";}}>
              Ask Luma to help break these down gently
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
                    <div onClick={() => toggleTask(task.id)} style={{ width:"22px", height:"22px", background:"linear-gradient(135deg,#00c896,#0ea5e9)", borderRadius:"8px", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
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
                <div style={{ fontSize:"16px", fontWeight:500 }}>Add one above — even the smallest step counts.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PROFILE */}
      {screen === "profile" && (
        <div className="section-scroll" style={{ paddingTop:"92px", position:"relative", zIndex:1, minHeight:"100vh" }}>
          <div style={{ maxWidth:"720px", margin:"0 auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"36px", animation:"fadeUp 0.5s ease" }}>
              <div>
                <h2 style={{ fontSize:"clamp(36px,5vw,52px)", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"8px" }}>Profile</h2>
                <p style={{ fontSize:"17px", color:"rgba(26,26,26,0.36)", fontWeight:500 }}>Help Luma know you better.</p>
              </div>
              <button onClick={() => editingProfile ? saveProfile() : setEditingProfile(true)} style={{ padding:"12px 24px", background:editingProfile?"linear-gradient(135deg,#00c896,#0ea5e9)":"rgba(255,255,255,0.75)", border:`0.5px solid ${editingProfile?"transparent":"rgba(26,26,26,0.1)"}`, borderRadius:"18px", color:editingProfile?"#fff":"#1a1a1a", fontSize:"15px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                {editingProfile?"Save":"Edit"}
              </button>
            </div>

            {/* Memory stats */}
            {conversations.length > 0 && (
              <div style={{ background:"rgba(0,200,150,0.06)", border:"0.5px solid rgba(0,200,150,0.15)", borderRadius:"20px", padding:"18px 22px", marginBottom:"16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:"13px", fontWeight:800, color:"#00a87c", marginBottom:"4px" }}>Luma remembers you</div>
                  <div style={{ fontSize:"14px", fontWeight:500, color:"rgba(26,26,26,0.5)" }}>{conversations.length} past conversation{conversations.length!==1?"s":""} saved locally</div>
                </div>
                <button onClick={() => setShowMemory(true)} style={{ padding:"8px 16px", background:"rgba(0,200,150,0.12)", border:"0.5px solid rgba(0,200,150,0.2)", borderRadius:"12px", color:"#00a87c", fontSize:"13px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>View</button>
              </div>
            )}

            {[
              { key:"name", label:"Your Name", placeholder:"e.g. Deandre" },
              { key:"career", label:"Career and Role", placeholder:"e.g. QA Engineer, bioengineering background" },
              { key:"interests", label:"Hobbies and Interests", placeholder:"e.g. music production, photography, cooking" },
              { key:"goals", label:"What you need most from Luma", placeholder:"e.g. staying organized, managing anxiety, career growth" },
              { key:"hardDay", label:"What a hard day looks like", placeholder:"e.g. I can't get started, I feel frozen, I forget everything" },
              { key:"location", label:"Location", placeholder:"e.g. San Jose, CA" }
            ].map((field,i) => (
              <div key={field.key} className="card" style={{ borderRadius:"22px", padding:"22px 24px", marginBottom:"10px", animation:`fadeUp 0.5s ease ${i*0.06+0.1}s both` }}>
                <div className="pill-label" style={{ marginBottom:"12px" }}>{field.label}</div>
                {editingProfile ? (
                  <input value={profileDraft[field.key]||""} onChange={e => setProfileDraft(p=>({...p,[field.key]:e.target.value}))} placeholder={field.placeholder} style={{ width:"100%", background:"rgba(245,242,238,0.8)", border:"0.5px solid rgba(26,26,26,0.1)", borderRadius:"14px", padding:"12px 16px", color:"#1a1a1a", fontSize:"16px", fontFamily:"'Nunito',sans-serif", fontWeight:600 }} />
                ) : (
                  <div style={{ fontSize:"17px", fontWeight:600, color:profile[field.key]?"#1a1a1a":"rgba(26,26,26,0.22)" }}>
                    {profile[field.key]||`Add your ${field.label.toLowerCase()}…`}
                  </div>
                )}
              </div>
            ))}

            <div className="card" style={{ borderRadius:"22px", padding:"22px 24px", marginBottom:"10px" }}>
              <div className="pill-label" style={{ marginBottom:"12px" }}>Condition or Challenge</div>
              {editingProfile ? (
                <select value={profileDraft.condition||"none"} onChange={e => setProfileDraft(p=>({...p,condition:e.target.value}))} style={{ width:"100%", background:"rgba(245,242,238,0.8)", border:"0.5px solid rgba(26,26,26,0.1)", borderRadius:"14px", padding:"12px 16px", color:"#1a1a1a", fontSize:"16px", fontFamily:"'Nunito',sans-serif", fontWeight:600, appearance:"none" }}>
                  <option value="none">None or prefer not to say</option>
                  <option value="adhd">ADHD</option>
                  <option value="anxiety">Anxiety</option>
                  <option value="depression">Depression</option>
                  <option value="autism">Autism / Asperger's</option>
                  <option value="executive_dysfunction">Executive Dysfunction</option>
                  <option value="ptsd">PTSD</option>
                  <option value="general">Something else</option>
                </select>
              ) : (
                <div style={{ fontSize:"17px", fontWeight:600, color:profile.condition&&profile.condition!=="none"?conditionColors[profile.condition]:"rgba(26,26,26,0.22)" }}>
                  {profile.condition&&profile.condition!=="none"?conditionLabels[profile.condition]:"Not set — always optional"}
                </div>
              )}
              <div style={{ fontSize:"13px", fontWeight:500, color:"rgba(26,26,26,0.3)", marginTop:"10px", lineHeight:1.5 }}>
                Helps Luma adapt its communication style to how your brain works. 100% private — never leaves your device.
              </div>
            </div>

            <div className="card" style={{ borderRadius:"22px", padding:"24px", marginTop:"8px" }}>
              <div style={{ fontSize:"17px", fontWeight:800, color:"rgba(26,26,26,0.65)", marginBottom:"10px" }}>Luma knows you</div>
              <div style={{ fontSize:"15px", fontWeight:500, color:"rgba(26,26,26,0.38)", lineHeight:1.65, marginBottom:"20px" }}>The more you share, the more Luma adapts to your pace, your style, and exactly what you need.</div>
              <button onClick={() => sendMessage("Based on my profile and our past conversations, what are the most helpful things you can do for me right now? Be specific and gentle.")} style={{ padding:"13px 22px", background:"linear-gradient(135deg,#00c896,#0ea5e9)", border:"none", borderRadius:"16px", color:"#fff", fontSize:"15px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
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