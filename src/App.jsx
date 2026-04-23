import { useState, useEffect, useRef } from "react";

const OLLAMA_URL = "http://localhost:11434/api/chat";
const MAX_MEMORY_MESSAGES = 50;

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
  return `You are Luma, a warm, intelligent, deeply personal AI life companion.

${conditionNote}

Your core personality:
- Genuinely warm and caring — like a best friend who happens to be very wise
- Adaptive — you change your communication style completely based on the user's needs
- Honest but kind — you give real help, not just validation
- Proactive — you notice patterns across conversations and bring them up naturally
- Comfort and success are your only goals

MEMORY RULES:
- Reference past conversations naturally — like a friend who remembers
- If you notice patterns mention them gently
- Never make the user feel surveilled — use memory warmly

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

${memoryContext ? `MEMORY FROM PAST CONVERSATIONS:\n${memoryContext}` : ""}`;
};

const MORNING_BRIEFING_SYSTEM = (profile, tasks, memoryContext, dayInfo) => {
  const conditionStyle = {
    adhd: "Keep it SHORT and punchy. Use bullet points. Max 3 focus items. High energy. End with ONE tiny action.",
    anxiety: "Be calm and reassuring. Structure everything clearly. No surprises. Validate that today is manageable.",
    depression: "Be warm and gentle. Keep expectations low and achievable. Celebrate that they showed up today.",
    autism: "Be literal and structured. Use clear headers. No ambiguity. Predictable format.",
    executive_dysfunction: "Ultra simple. One thing at a time. Make starting feel easy. Short sentences.",
    ptsd: "Gentle and grounding. Focus on safety and small wins. No pressure.",
    general: "Warm and encouraging."
  };
  const style = conditionStyle[profile.condition || "general"] || conditionStyle.general;
  const pendingTasks = tasks.filter(t => !t.done).slice(0, 5).map(t => `- ${t.text}${t.dueDate ? ` (due ${t.dueDate})` : ""}${t.priority === "urgent" ? " [URGENT]" : ""}`).join("\n");
  return `You are Luma generating a personalized morning briefing. Style: ${style}
User: ${profile.name || "friend"} | Day: ${dayInfo.dayName}, ${dayInfo.date} | Goals: ${profile.goals || "not set"} | Condition: ${profile.condition || "none"}
Pending tasks:\n${pendingTasks || "None"}
${memoryContext ? `Recent context:\n${memoryContext}` : ""}
Generate a warm personal morning briefing under 200 words. Feel like a text from a caring friend. Include: greeting, one check-in question, 1-2 focus areas, acknowledge tasks gently, one encouragement.`;
};

const GREETING = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const getDayInfo = () => {
  const now = new Date();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const h = now.getHours();
  return {
    dayName: days[now.getDay()],
    date: now.toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" }),
    timeOfDay: h < 12 ? "morning" : h < 17 ? "afternoon" : "evening",
    hour: h
  };
};

const ONBOARDING_STEPS = [
  { key:"name", question:"Hey. What should I call you?", placeholder:"Your name…", hint:"This helps every conversation feel personal.", type:"text" },
  { key:"feeling", question:"How are you feeling today — honestly?", placeholder:"e.g. Pretty good, exhausted, anxious…", hint:"No right answer. Luma meets you where you are.", type:"text" },
  { key:"condition", question:"Do you have any conditions that affect your daily life?", placeholder:"", hint:"Completely optional and 100% private.", type:"select", options:[
    { value:"none", label:"None or prefer not to say" },
    { value:"adhd", label:"ADHD" },
    { value:"anxiety", label:"Anxiety" },
    { value:"depression", label:"Depression" },
    { value:"autism", label:"Autism / Asperger's" },
    { value:"executive_dysfunction", label:"Executive Dysfunction" },
    { value:"ptsd", label:"PTSD" },
    { value:"general", label:"Something else" }
  ]},
  { key:"hardDay", question:"What does a really hard day look like for you?", placeholder:"e.g. I can't get out of bed, I feel frozen…", hint:"Luma will recognize these signs and respond with extra care.", type:"text" },
  { key:"goals", question:"What's the one thing you most want Luma's help with?", placeholder:"e.g. staying organized, managing anxiety…", hint:"This becomes Luma's north star.", type:"text" }
];

const conditionColors = { adhd:"#0ea5e9", anxiety:"#8b5cf6", depression:"#00c896", autism:"#ec4899", executive_dysfunction:"#f59e0b", ptsd:"#f97316", general:"rgba(26,26,26,0.3)" };
const conditionLabels = { adhd:"ADHD", anxiety:"Anxiety", depression:"Depression", autism:"Autism", executive_dysfunction:"Executive Dysfunction", ptsd:"PTSD", general:"Other", none:"" };

const PRIORITY_CONFIG = {
  urgent: { label:"Urgent", color:"#ff453a", bg:"rgba(255,69,58,0.1)", border:"rgba(255,69,58,0.2)" },
  high:   { label:"High",   color:"#ff9500", bg:"rgba(255,149,0,0.1)", border:"rgba(255,149,0,0.2)" },
  normal: { label:"Normal", color:"#0ea5e9", bg:"rgba(14,165,233,0.1)", border:"rgba(14,165,233,0.2)" },
  low:    { label:"Low",    color:"rgba(26,26,26,0.3)", bg:"rgba(26,26,26,0.04)", border:"rgba(26,26,26,0.1)" }
};

const RECURRENCE_OPTIONS = [
  { value:"none", label:"No repeat" },
  { value:"daily", label:"Every day" },
  { value:"weekdays", label:"Weekdays" },
  { value:"weekly", label:"Every week" },
  { value:"monthly", label:"Every month" }
];

const GROWTH_CATEGORIES = [
  { key:"career", label:"Career", color:"#0ea5e9", bg:"rgba(14,165,233,0.08)", icon:"◎" },
  { key:"skills", label:"Skills", color:"#8b5cf6", bg:"rgba(139,92,246,0.08)", icon:"◈" },
  { key:"interests", label:"Interests", color:"#00c896", bg:"rgba(0,200,150,0.08)", icon:"★" },
  { key:"health", label:"Health", color:"#ec4899", bg:"rgba(236,72,153,0.08)", icon:"♡" }
];

function saveConversation(messages, profile) {
  if (!messages.length) return;
  try {
    const existing = JSON.parse(localStorage.getItem("luma_conversations") || "[]");
    const session = {
      id: Date.now(),
      date: new Date().toISOString(),
      dateLabel: new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", hour:"numeric", minute:"2-digit" }),
      messages: messages.slice(-10),
      messageCount: messages.length,
      profile: { name: profile.name, condition: profile.condition }
    };
    localStorage.setItem("luma_conversations", JSON.stringify([session, ...existing].slice(0, 30)));
  } catch(e) { console.error(e); }
}

function buildMemoryContext(conversations) {
  if (!conversations.length) return "";
  return conversations.slice(0, 5).map(conv => {
    const msgs = conv.messages.filter(m => m.role !== "system").map(m => `${m.role==="user"?"User":"Luma"}: ${m.content.slice(0,150)}`).join("\n");
    return `[${conv.dateLabel}]\n${msgs}`;
  }).join("\n\n---\n\n");
}

function shouldShowBriefing() {
  const last = localStorage.getItem("luma_last_briefing");
  if (!last) return true;
  return new Date(last).toDateString() !== new Date().toDateString() && new Date().getHours() >= 5;
}

function scheduleReminder(task) {
  if (!task.reminderTime || !("Notification" in window)) return;
  if (Notification.permission !== "granted") { Notification.requestPermission().then(p => { if (p === "granted") scheduleReminder(task); }); return; }
  const [hours, minutes] = task.reminderTime.split(":").map(Number);
  const now = new Date();
  const reminderDate = new Date();
  reminderDate.setHours(hours, minutes, 0, 0);
  if (task.dueDate) { const [year, month, day] = task.dueDate.split("-").map(Number); reminderDate.setFullYear(year, month - 1, day); }
  const delay = reminderDate.getTime() - now.getTime();
  if (delay > 0) setTimeout(() => new Notification("Luma Reminder", { body: task.text, icon: "/favicon.ico", tag: `luma-task-${task.id}` }), delay);
}

function scheduleDailyBriefingNotif(time, name) {
  if (!time || !("Notification" in window) || Notification.permission !== "granted") return;
  const [hours, minutes] = time.split(":").map(Number);
  const now = new Date(); const next = new Date();
  next.setHours(hours, minutes, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(() => { new Notification("Good morning from Luma", { body: `Hey${name ? ` ${name}` : ""}! Your morning briefing is ready.`, icon: "/favicon.ico", tag: "luma-morning-briefing" }); scheduleDailyBriefingNotif(time, name); }, next.getTime() - now.getTime());
}

function scheduleCheckIn(hour, name) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date(); const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(() => { new Notification("Luma is thinking of you", { body: `Hey${name ? ` ${name}` : ""}. Just checking in — how are you doing today?`, icon: "/favicon.ico", tag: "luma-checkin" }); scheduleCheckIn(hour, name); }, next.getTime() - now.getTime());
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [growthTab, setGrowthTab] = useState("career");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(() => { try { return JSON.parse(localStorage.getItem("luma_profile")||"{}"); } catch { return {}; } });
  const [tasks, setTasks] = useState(() => { try { return JSON.parse(localStorage.getItem("luma_tasks")||"[]"); } catch { return []; } });
  const [conversations, setConversations] = useState(() => { try { return JSON.parse(localStorage.getItem("luma_conversations")||"[]"); } catch { return []; } });
  const [growthData, setGrowthData] = useState(() => { try { return JSON.parse(localStorage.getItem("luma_growth")||"{}"); } catch { return {}; } });
  const [wins, setWins] = useState(() => { try { return JSON.parse(localStorage.getItem("luma_wins")||"[]"); } catch { return []; } });
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
  const [briefing, setBriefing] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingDismissed, setBriefingDismissed] = useState(false);
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskSort, setTaskSort] = useState("priority");
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [newTask, setNewTask] = useState({ text:"", priority:"normal", dueDate:"", dueTime:"", reminderTime:"", recurrence:"none", notes:"" });
  const [suggestingTasks, setSuggestingTasks] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState([]);
  const [notifSettings, setNotifSettings] = useState(() => { try { return JSON.parse(localStorage.getItem("luma_notif_settings")||"{}"); } catch { return {}; } });
  const [notifPermission, setNotifPermission] = useState(() => "Notification" in window ? Notification.permission : "unsupported");
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddWin, setShowAddWin] = useState(false);
  const [newGoal, setNewGoal] = useState({ title:"", category:"career", description:"", targetDate:"", progress:0 });
  const [newWin, setNewWin] = useState({ text:"", category:"career", date:"" });
  const [growthInsight, setGrowthInsight] = useState("");
  const [growthInsightLoading, setGrowthInsightLoading] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);
  useEffect(() => { localStorage.setItem("luma_profile", JSON.stringify(profile)); }, [profile]);
  useEffect(() => { localStorage.setItem("luma_tasks", JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem("luma_notif_settings", JSON.stringify(notifSettings)); }, [notifSettings]);
  useEffect(() => { localStorage.setItem("luma_growth", JSON.stringify(growthData)); }, [growthData]);
  useEffect(() => { localStorage.setItem("luma_wins", JSON.stringify(wins)); }, [wins]);
  useEffect(() => { fetch("http://localhost:11434/api/tags").then(() => setOllamaStatus("online")).catch(() => setOllamaStatus("offline")); }, []);
  useEffect(() => { if (!showOnboarding && profile.name && shouldShowBriefing() && ollamaStatus === "online") generateBriefing(); }, [showOnboarding, ollamaStatus]);
  useEffect(() => { const h = () => { if (messages.length > 0) saveConversation(messages, profile); }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, [messages, profile]);
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().then(p => setNotifPermission(p));
    tasks.filter(t => !t.done && t.reminderTime).forEach(scheduleReminder);
    const s = JSON.parse(localStorage.getItem("luma_notif_settings") || "{}");
    if (s.briefingEnabled && s.briefingTime) scheduleDailyBriefingNotif(s.briefingTime, profile.name);
    if (s.checkInEnabled && s.checkInHour) scheduleCheckIn(parseInt(s.checkInHour), profile.name);
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTasks(prev => prev.map(task => {
        if (!task.done && task.dueDate && !task.overdue) { const due = new Date(`${task.dueDate}T${task.dueTime || "23:59"}`); if (due < now) return { ...task, overdue:true }; }
        return task;
      }));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const generateBriefing = async () => {
    setBriefingLoading(true); setBriefing(null);
    const memoryContext = buildMemoryContext(conversations);
    const dayInfo = getDayInfo();
    try {
      const res = await fetch(OLLAMA_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"mistral-nemo:latest", messages:[{ role:"user", content:MORNING_BRIEFING_SYSTEM(profile, tasks, memoryContext, dayInfo) }], stream:false }) });
      const data = await res.json();
      setBriefing(data.message?.content || "Good morning! I'm here whenever you're ready.");
      localStorage.setItem("luma_last_briefing", new Date().toISOString());
    } catch { setBriefing("Good morning! Couldn't connect — but I'm here when you need me."); }
    setBriefingLoading(false);
  };

  const generateGrowthInsight = async () => {
    setGrowthInsightLoading(true); setGrowthInsight("");
    const goals = growthData[growthTab] || [];
    const recentWins = wins.filter(w => w.category === growthTab).slice(0, 5);
    try {
      const res = await fetch(OLLAMA_URL, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"mistral-nemo:latest",
          messages:[{ role:"user", content:`You are Luma, a warm personal AI coach. Give a short (3-4 sentence), specific, encouraging insight and ONE clear next step for this person's ${growthTab} growth.

Name: ${profile.name || ""}
Goals in this area: ${goals.map(g => `${g.title} (${g.progress}% complete)`).join(", ") || "none set yet"}
Recent wins: ${recentWins.map(w => w.text).join(", ") || "none logged yet"}
Career: ${profile.career || ""}
Overall goals: ${profile.goals || ""}
Condition: ${profile.condition || "none"}

Be warm, specific, and genuinely helpful. Reference their actual goals and wins if available.` }],
          stream:false
        })
      });
      const data = await res.json();
      setGrowthInsight(data.message?.content || "Keep going — every step forward counts.");
    } catch { setGrowthInsight("Keep going — every step forward counts."); }
    setGrowthInsightLoading(false);
  };

  const suggestTasksFromGoals = async () => {
    if (suggestingTasks) return;
    setSuggestingTasks(true); setSuggestedTasks([]);
    try {
      const res = await fetch(OLLAMA_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"mistral-nemo:latest", messages:[{ role:"user", content:`Based on this person's goals and profile, suggest 5 specific actionable tasks. Return ONLY a JSON array: ["task 1","task 2","task 3","task 4","task 5"]. No other text.\nName: ${profile.name||""}\nGoals: ${profile.goals||""}\nCareer: ${profile.career||""}\nCondition: ${profile.condition||"none"}\nCurrent tasks: ${tasks.filter(t=>!t.done).map(t=>t.text).join(", ")||"none"}` }], stream:false }) });
      const data = await res.json();
      const match = (data.message?.content || "[]").match(/\[[\s\S]*?\]/);
      if (match) setSuggestedTasks(JSON.parse(match[0]));
    } catch { setSuggestedTasks(["Check in with your goals today","Do one small thing toward your career","Take 5 minutes to plan your week","Reach out to someone important to you","Do something kind for yourself"]); }
    setSuggestingTasks(false);
  };

  const addSuggestedTask = (text) => { setTasks(prev => [...prev, { id:Date.now(), text, priority:"normal", dueDate:"", dueTime:"", reminderTime:"", recurrence:"none", notes:"", done:false, created:new Date().toLocaleDateString(), overdue:false }]); setSuggestedTasks(prev => prev.filter(t => t !== text)); };

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) { alert("Voice requires Chrome."); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SR();
    recognitionRef.current.continuous = false; recognitionRef.current.interimResults = false; recognitionRef.current.lang = "en-US";
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onresult = (e) => { setInput(p => p+(p?" ":"")+e.results[0][0].transcript); setIsListening(false); };
    recognitionRef.current.onerror = () => setIsListening(false);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.start();
  };
  const stopListening = () => { recognitionRef.current?.stop(); setIsListening(false); };

  const sendMessage = async (text) => {
    const msg = text || ""; if (!msg.trim() || loading) return;
    setInput("");
    const userMsg = { role:"user", content:msg };
    const updated = [...messages, userMsg];
    setMessages(updated); setLoading(true); setScreen("chat");
    const memoryContext = buildMemoryContext(conversations);
    try {
      const res = await fetch(OLLAMA_URL, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"mistral-nemo:latest", messages:[{ role:"system", content:LUMA_SYSTEM(profile, memoryContext) }, ...updated.slice(-MAX_MEMORY_MESSAGES)], stream:false }) });
      const data = await res.json();
      setMessages(prev => [...prev, { role:"assistant", content:data.message?.content || "Connection error." }]);
    } catch { setMessages(prev => [...prev, { role:"assistant", content:"Couldn't connect to Ollama." }]); }
    setLoading(false);
  };

  const respondToBriefing = () => { if (!briefing) return; setMessages([{ role:"assistant", content:briefing }]); setScreen("chat"); setBriefingDismissed(true); };
  const saveCurrentSession = () => { if (messages.length === 0) return; saveConversation(messages, profile); setConversations(JSON.parse(localStorage.getItem("luma_conversations")||"[]")); setSessionSaved(true); setTimeout(() => setSessionSaved(false), 2000); };
  const clearCurrentChat = () => { if (messages.length > 0) saveConversation(messages, profile); setConversations(JSON.parse(localStorage.getItem("luma_conversations")||"[]")); setMessages([]); };
  const deleteConversation = (id) => { const u = conversations.filter(c => c.id!==id); setConversations(u); localStorage.setItem("luma_conversations", JSON.stringify(u)); };
  const loadConversation = (conv) => { setMessages(conv.messages); setScreen("chat"); setShowMemory(false); };

  const saveTask = () => {
    if (!newTask.text.trim()) return;
    const task = { ...newTask, id:editingTask?editingTask.id:Date.now(), done:editingTask?editingTask.done:false, created:editingTask?editingTask.created:new Date().toLocaleDateString(), overdue:false };
    if (editingTask) { setTasks(prev => prev.map(t => t.id===editingTask.id?task:t)); } else { setTasks(prev => [...prev, task]); }
    if (task.reminderTime && notifSettings.taskRemindersEnabled !== false) scheduleReminder(task);
    setNewTask({ text:"", priority:"normal", dueDate:"", dueTime:"", reminderTime:"", recurrence:"none", notes:"" }); setShowAddTask(false); setEditingTask(null);
  };
  const startEditTask = (task) => { setNewTask({ text:task.text, priority:task.priority||"normal", dueDate:task.dueDate||"", dueTime:task.dueTime||"", reminderTime:task.reminderTime||"", recurrence:task.recurrence||"none", notes:task.notes||"" }); setEditingTask(task); setShowAddTask(true); };
  const toggleTask = (id) => { setTasks(prev => prev.map(t => { if (t.id!==id) return t; const done=!t.done; if (done&&t.recurrence&&t.recurrence!=="none"&&t.dueDate) { const due=new Date(t.dueDate); if(t.recurrence==="daily")due.setDate(due.getDate()+1); else if(t.recurrence==="weekdays"){due.setDate(due.getDate()+1);while([0,6].includes(due.getDay()))due.setDate(due.getDate()+1);} else if(t.recurrence==="weekly")due.setDate(due.getDate()+7); else if(t.recurrence==="monthly")due.setMonth(due.getMonth()+1); return {...t,done:false,dueDate:due.toISOString().split("T")[0],overdue:false}; } return {...t,done,overdue:false}; })); };
  const deleteTask = (id) => setTasks(prev => prev.filter(t => t.id!==id));

  const saveGoal = () => {
    if (!newGoal.title.trim()) return;
    const goal = { ...newGoal, id:editingGoal?editingGoal.id:Date.now(), created:editingGoal?editingGoal.created:new Date().toLocaleDateString() };
    const existing = growthData[newGoal.category] || [];
    if (editingGoal) { setGrowthData(p => ({ ...p, [newGoal.category]: existing.map(g => g.id===editingGoal.id?goal:g) })); }
    else { setGrowthData(p => ({ ...p, [newGoal.category]: [...existing, goal] })); }
    setNewGoal({ title:"", category:growthTab, description:"", targetDate:"", progress:0 }); setShowAddGoal(false); setEditingGoal(null);
  };

  const updateGoalProgress = (category, id, progress) => { setGrowthData(p => ({ ...p, [category]: (p[category]||[]).map(g => g.id===id?{...g,progress}:g) })); };
  const deleteGoal = (category, id) => { setGrowthData(p => ({ ...p, [category]: (p[category]||[]).filter(g => g.id!==id) })); };

  const saveWin = () => {
    if (!newWin.text.trim()) return;
    const win = { ...newWin, id:Date.now(), date:newWin.date || new Date().toLocaleDateString(), created:new Date().toISOString() };
    setWins(prev => [win, ...prev]);
    setNewWin({ text:"", category:growthTab, date:"" }); setShowAddWin(false);
  };
  const deleteWin = (id) => setWins(prev => prev.filter(w => w.id!==id));

  const nextOnboardingStep = () => {
    const step = ONBOARDING_STEPS[onboardingStep]; const value = step.type==="select"?onboardingSelect:onboardingInput;
    const updated = { ...onboardingData, [step.key]:value }; setOnboardingData(updated); setOnboardingInput(""); setOnboardingSelect("none");
    if (onboardingStep < ONBOARDING_STEPS.length-1) { setOnboardingStep(s=>s+1); } else { setProfile(updated); setShowOnboarding(false); }
  };
  const skipOnboarding = () => { setProfile(onboardingData); setShowOnboarding(false); };
  const saveProfile = () => { setProfile(profileDraft); setEditingProfile(false); };

  const currentStep = ONBOARDING_STEPS[onboardingStep];
  const lastSession = conversations[0];
  const dayInfo = getDayInfo();
  const showBriefingCard = (briefing || briefingLoading) && !briefingDismissed;
  const urgentCount = tasks.filter(t => !t.done && t.priority==="urgent").length;
  const todayCount = tasks.filter(t => !t.done && t.dueDate===new Date().toISOString().split("T")[0]).length;
  const overdueCount = tasks.filter(t => !t.done && t.overdue).length;
  const totalGoals = Object.values(growthData).flat().length;
  const totalWins = wins.length;

  const getFilteredTasks = () => {
    let filtered = tasks;
    if (taskFilter==="today") filtered = tasks.filter(t => !t.done && t.dueDate===new Date().toISOString().split("T")[0]);
    else if (taskFilter==="urgent") filtered = tasks.filter(t => !t.done && t.priority==="urgent");
    else if (taskFilter==="pending") filtered = tasks.filter(t => !t.done);
    else if (taskFilter==="done") filtered = tasks.filter(t => t.done);
    return filtered.sort((a,b) => { if (taskSort==="priority") { const o={urgent:0,high:1,normal:2,low:3}; return (o[a.priority]||2)-(o[b.priority]||2); } if (taskSort==="due") return (a.dueDate||"9999")<(b.dueDate||"9999")?-1:1; return 0; });
  };

  const currentCat = GROWTH_CATEGORIES.find(c => c.key === growthTab);
  const currentGoals = growthData[growthTab] || [];
  const currentWins = wins.filter(w => w.category === growthTab);

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
        @keyframes briefingIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes progressFill{from{width:0}to{width:var(--progress)}}
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:0;}
        ::placeholder{color:rgba(26,26,26,0.25);font-family:'Nunito',sans-serif;}
        textarea:focus,input:focus,select:focus{outline:none;}
        .aurora-text{background:linear-gradient(135deg,#00c896,#0ea5e9,#8b5cf6,#ec4899,#00c896);background-size:300% 100%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:shimmer 6s linear infinite;}
        .nav-glass{background:rgba(245,242,238,0.82);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border-bottom:0.5px solid rgba(26,26,26,0.06);}
        .nav-btn{background:transparent;border:none;color:rgba(26,26,26,0.38);font-size:15px;font-weight:700;cursor:pointer;padding:8px 18px;border-radius:100px;transition:all 0.2s;font-family:'Nunito',sans-serif;}
        .nav-btn:hover{color:#1a1a1a;background:rgba(26,26,26,0.06);}
        .nav-btn.active{color:#1a1a1a;background:rgba(26,26,26,0.08);}
        .card{background:rgba(255,255,255,0.75);border:0.5px solid rgba(26,26,26,0.07);border-radius:24px;backdrop-filter:blur(20px);transition:all 0.3s cubic-bezier(0.34,1.4,0.64,1);}
        .card-hover:hover{background:rgba(255,255,255,0.92);transform:translateY(-2px);box-shadow:0 8px 40px rgba(0,0,0,0.06);}
        .input-wrap{background:rgba(255,255,255,0.75);border:0.5px solid rgba(26,26,26,0.09);border-radius:28px;backdrop-filter:blur(20px);transition:border-color 0.2s,box-shadow 0.2s;}
        .input-wrap:focus-within{border-color:rgba(26,26,26,0.15);box-shadow:0 4px 32px rgba(0,0,0,0.06);}
        .suggest-btn{background:rgba(255,255,255,0.6);border:0.5px solid rgba(26,26,26,0.07);border-radius:18px;padding:18px 22px;cursor:pointer;color:#1a1a1a;font-size:17px;font-weight:700;font-family:'Nunito',sans-serif;text-align:left;display:flex;align-items:center;justify-content:space-between;transition:all 0.25s;width:100%;}
        .suggest-btn:hover{background:rgba(255,255,255,0.92);transform:translateY(-2px);box-shadow:0 6px 28px rgba(0,0,0,0.07);}
        .send-btn{transition:all 0.22s cubic-bezier(0.34,1.4,0.64,1);}
        .send-btn:hover:not(:disabled){transform:scale(1.08);}
        .mic-btn{transition:all 0.22s;}
        .mic-btn.listening{animation:micPulse 1.5s ease-in-out infinite;}
        .task-row{transition:all 0.2s;}
        .task-row:hover .del-btn{opacity:1!important;}
        .task-row:hover .edit-btn{opacity:1!important;}
        .goal-row:hover .goal-del{opacity:1!important;}
        .win-row:hover .win-del{opacity:1!important;}
        .mem-card:hover .mem-del{opacity:1!important;}
        .pill-label{font-size:11px;font-weight:800;color:rgba(26,26,26,0.3);letter-spacing:0.1em;text-transform:uppercase;}
        .pill{display:inline-flex;align-items:center;gap:7px;padding:5px 14px;background:rgba(255,255,255,0.7);border:0.5px solid rgba(26,26,26,0.07);border-radius:100px;font-size:12px;font-weight:800;color:rgba(26,26,26,0.45);letter-spacing:0.06em;text-transform:uppercase;backdrop-filter:blur(10px);}
        .pill-dot{width:6px;height:6px;border-radius:50%;background:linear-gradient(135deg,#00c896,#0ea5e9);animation:pulse 2s infinite;}
        .ob-input{width:100%;background:rgba(255,255,255,0.85);border:0.5px solid rgba(26,26,26,0.1);border-radius:18px;padding:18px 22px;color:#1a1a1a;font-size:17px;font-family:'Nunito',sans-serif;font-weight:600;transition:all 0.2s;}
        .ob-input:focus{border-color:rgba(14,165,233,0.35);box-shadow:0 0 0 4px rgba(14,165,233,0.08);}
        .ob-select{width:100%;background:rgba(255,255,255,0.85);border:0.5px solid rgba(26,26,26,0.1);border-radius:18px;padding:18px 22px;color:#1a1a1a;font-size:17px;font-family:'Nunito',sans-serif;font-weight:600;transition:all 0.2s;appearance:none;cursor:pointer;}
        .ob-btn{padding:16px 36px;border:none;border-radius:18px;font-size:17px;font-weight:900;cursor:pointer;font-family:'Nunito',sans-serif;transition:all 0.25s;background:linear-gradient(135deg,#00c896,#0ea5e9);color:#fff;}
        .ob-btn:hover{transform:translateY(-2px);box-shadow:0 8px 32px rgba(14,165,233,0.25);}
        .section-scroll{flex:1;overflow-y:auto;padding:28px 24px;}
        .luma-logo{font-size:22px;font-weight:900;letter-spacing:-0.02em;cursor:pointer;font-family:'Nunito',sans-serif;}
        .memory-panel{position:fixed;top:64px;right:0;bottom:0;width:320px;background:rgba(245,242,238,0.96);backdrop-filter:blur(40px);border-left:0.5px solid rgba(26,26,26,0.07);z-index:90;overflow-y:auto;padding:24px;animation:slideRight 0.3s ease;}
        .mem-card{background:rgba(255,255,255,0.75);border:0.5px solid rgba(26,26,26,0.07);border-radius:16px;padding:16px;margin-bottom:10px;cursor:pointer;transition:all 0.2s;}
        .mem-card:hover{background:rgba(255,255,255,0.95);transform:translateY(-1px);}
        .briefing-shimmer{background:linear-gradient(90deg,rgba(26,26,26,0.04) 25%,rgba(26,26,26,0.08) 50%,rgba(26,26,26,0.04) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;}
        .filter-btn{padding:7px 14px;border-radius:100px;border:0.5px solid rgba(26,26,26,0.09);background:rgba(255,255,255,0.6);color:rgba(26,26,26,0.5);font-size:13px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;transition:all 0.2s;white-space:nowrap;}
        .filter-btn.active{background:linear-gradient(135deg,#00c896,#0ea5e9);color:#fff;border-color:transparent;}
        .field-label{font-size:11px;font-weight:800;color:rgba(26,26,26,0.35);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;display:block;}
        .field-input{width:100%;background:rgba(245,242,238,0.8);border:0.5px solid rgba(26,26,26,0.1);border-radius:12px;padding:11px 14px;color:#1a1a1a;font-size:15px;font-family:'Nunito',sans-serif;font-weight:600;}
        .field-input:focus{border-color:rgba(14,165,233,0.35);box-shadow:0 0 0 3px rgba(14,165,233,0.08);}
        .priority-btn{padding:8px 14px;border-radius:10px;border:0.5px solid;font-size:13px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;transition:all 0.2s;}
        .toggle{width:44px;height:26px;border-radius:100px;cursor:pointer;position:relative;transition:all 0.25s;flex-shrink:0;}
        .toggle-knob{position:absolute;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left 0.25s;box-shadow:0 1px 4px rgba(0,0,0,0.15);}
        .progress-bar-bg{height:6px;background:rgba(26,26,26,0.08);border-radius:100px;overflow:hidden;}
        .progress-bar-fill{height:100%;border-radius:100px;transition:width 0.5s ease;}
        .growth-tab-btn{padding:8px 18px;border-radius:100px;border:0.5px solid rgba(26,26,26,0.09);background:rgba(255,255,255,0.6);font-size:14px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;transition:all 0.2s;display:flex;align-items:center;gap:6px;}
        input[type="range"]{-webkit-appearance:none;width:100%;height:4px;border-radius:100px;outline:none;cursor:pointer;}
        input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#00c896,#0ea5e9);cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.15);}
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
              {ONBOARDING_STEPS.map((_,i) => <div key={i} style={{ width:i===onboardingStep?"28px":"8px", height:"8px", borderRadius:"100px", background:i<=onboardingStep?"linear-gradient(90deg,#00c896,#0ea5e9)":"rgba(26,26,26,0.1)", transition:"all 0.35s" }} />)}
            </div>
            <div style={{ textAlign:"center", marginBottom:"36px" }}>
              <div style={{ fontSize:"40px", fontWeight:900, letterSpacing:"-0.02em", marginBottom:"6px" }}><span className="aurora-text">Luma</span></div>
              <div style={{ fontSize:"13px", fontWeight:700, color:"rgba(26,26,26,0.3)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Your life. Illuminated.</div>
            </div>
            <div style={{ marginBottom:"24px" }}>
              <h2 style={{ fontSize:"24px", fontWeight:800, lineHeight:1.3, marginBottom:"10px" }}>{currentStep.question}</h2>
              <p style={{ fontSize:"14px", color:"rgba(26,26,26,0.38)", fontWeight:500, lineHeight:1.6 }}>{currentStep.hint}</p>
            </div>
            {currentStep.type==="select" ? (
              <select className="ob-select" value={onboardingSelect} onChange={e=>setOnboardingSelect(e.target.value)}>
                {currentStep.options.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            ) : (
              <input className="ob-input" value={onboardingInput} onChange={e=>setOnboardingInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&nextOnboardingStep()} placeholder={currentStep.placeholder} autoFocus />
            )}
            <div style={{ display:"flex", gap:"12px", marginTop:"20px", alignItems:"center" }}>
              <button className="ob-btn" onClick={nextOnboardingStep} style={{ flex:1 }}>{onboardingStep<ONBOARDING_STEPS.length-1?"Continue":"Start with Luma"}</button>
              <button onClick={skipOnboarding} style={{ background:"none", border:"none", color:"rgba(26,26,26,0.28)", fontSize:"14px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif", padding:"8px 12px" }}>Skip</button>
            </div>
            {onboardingStep>0&&<button onClick={()=>{setOnboardingStep(s=>s-1);setOnboardingInput("");}} style={{ background:"none", border:"none", color:"rgba(26,26,26,0.22)", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif", marginTop:"14px", display:"block", width:"100%", textAlign:"center" }}>Back</button>}
          </div>
        </div>
      )}

      {/* Add/Edit Task Modal */}
      {showAddTask && (
        <div style={{ position:"fixed", inset:0, zIndex:150, background:"rgba(245,242,238,0.88)", backdropFilter:"blur(24px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", animation:"fadeIn 0.3s ease" }}>
          <div style={{ background:"rgba(255,255,255,0.92)", border:"0.5px solid rgba(26,26,26,0.08)", borderRadius:"32px", padding:"36px", maxWidth:"520px", width:"100%", animation:"slideUp 0.4s cubic-bezier(0.34,1.2,0.64,1)", boxShadow:"0 24px 80px rgba(0,0,0,0.08)", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"28px" }}>
              <h2 style={{ fontSize:"22px", fontWeight:900, letterSpacing:"-0.02em" }}>{editingTask?"Edit Task":"New Task"}</h2>
              <button onClick={()=>{setShowAddTask(false);setEditingTask(null);setNewTask({text:"",priority:"normal",dueDate:"",dueTime:"",reminderTime:"",recurrence:"none",notes:""});}} style={{ background:"none", border:"none", fontSize:"20px", color:"rgba(26,26,26,0.3)", cursor:"pointer" }}>×</button>
            </div>
            <div style={{ marginBottom:"20px" }}><label className="field-label">What needs to be done?</label><textarea value={newTask.text} onChange={e=>setNewTask(p=>({...p,text:e.target.value}))} placeholder="Describe your task…" rows={2} className="field-input" style={{ resize:"none", lineHeight:1.5 }} autoFocus /></div>
            <div style={{ marginBottom:"20px" }}><label className="field-label">Priority</label><div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>{Object.entries(PRIORITY_CONFIG).map(([key,cfg])=><button key={key} className="priority-btn" onClick={()=>setNewTask(p=>({...p,priority:key}))} style={{ background:newTask.priority===key?cfg.bg:"transparent", borderColor:newTask.priority===key?cfg.border:"rgba(26,26,26,0.1)", color:newTask.priority===key?cfg.color:"rgba(26,26,26,0.4)" }}>{cfg.label}</button>)}</div></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"20px" }}>
              <div><label className="field-label">Due Date</label><input type="date" value={newTask.dueDate} onChange={e=>setNewTask(p=>({...p,dueDate:e.target.value}))} className="field-input" /></div>
              <div><label className="field-label">Due Time</label><input type="time" value={newTask.dueTime} onChange={e=>setNewTask(p=>({...p,dueTime:e.target.value}))} className="field-input" /></div>
            </div>
            <div style={{ marginBottom:"20px" }}><label className="field-label">Reminder Time</label><input type="time" value={newTask.reminderTime} onChange={e=>setNewTask(p=>({...p,reminderTime:e.target.value}))} className="field-input" /><div style={{ fontSize:"12px", color:"rgba(26,26,26,0.3)", fontWeight:500, marginTop:"6px" }}>You'll get a browser notification at this time</div></div>
            <div style={{ marginBottom:"20px" }}><label className="field-label">Repeat</label><select value={newTask.recurrence} onChange={e=>setNewTask(p=>({...p,recurrence:e.target.value}))} className="field-input" style={{ appearance:"none", cursor:"pointer" }}>{RECURRENCE_OPTIONS.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
            <div style={{ marginBottom:"28px" }}><label className="field-label">Notes (optional)</label><textarea value={newTask.notes} onChange={e=>setNewTask(p=>({...p,notes:e.target.value}))} placeholder="Any extra context…" rows={2} className="field-input" style={{ resize:"none", lineHeight:1.5 }} /></div>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={saveTask} disabled={!newTask.text.trim()} style={{ flex:1, padding:"14px", background:newTask.text.trim()?"linear-gradient(135deg,#00c896,#0ea5e9)":"rgba(26,26,26,0.06)", border:"none", borderRadius:"16px", color:newTask.text.trim()?"#fff":"rgba(26,26,26,0.3)", fontSize:"16px", fontWeight:900, cursor:newTask.text.trim()?"pointer":"default", fontFamily:"'Nunito',sans-serif" }}>{editingTask?"Save Changes":"Add Task"}</button>
              <button onClick={()=>{setShowAddTask(false);setEditingTask(null);}} style={{ padding:"14px 20px", background:"rgba(26,26,26,0.05)", border:"none", borderRadius:"16px", color:"rgba(26,26,26,0.4)", fontSize:"15px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div style={{ position:"fixed", inset:0, zIndex:150, background:"rgba(245,242,238,0.88)", backdropFilter:"blur(24px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", animation:"fadeIn 0.3s ease" }}>
          <div style={{ background:"rgba(255,255,255,0.92)", border:"0.5px solid rgba(26,26,26,0.08)", borderRadius:"32px", padding:"36px", maxWidth:"500px", width:"100%", animation:"slideUp 0.4s cubic-bezier(0.34,1.2,0.64,1)", boxShadow:"0 24px 80px rgba(0,0,0,0.08)", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"28px" }}>
              <h2 style={{ fontSize:"22px", fontWeight:900, letterSpacing:"-0.02em" }}>{editingGoal?"Edit Goal":"New Goal"}</h2>
              <button onClick={()=>{setShowAddGoal(false);setEditingGoal(null);setNewGoal({title:"",category:growthTab,description:"",targetDate:"",progress:0});}} style={{ background:"none", border:"none", fontSize:"20px", color:"rgba(26,26,26,0.3)", cursor:"pointer" }}>×</button>
            </div>
            <div style={{ marginBottom:"20px" }}><label className="field-label">Goal Title</label><input value={newGoal.title} onChange={e=>setNewGoal(p=>({...p,title:e.target.value}))} placeholder="What do you want to achieve?" className="field-input" autoFocus /></div>
            <div style={{ marginBottom:"20px" }}>
              <label className="field-label">Category</label>
              <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                {GROWTH_CATEGORIES.map(cat=>(
                  <button key={cat.key} onClick={()=>setNewGoal(p=>({...p,category:cat.key}))} style={{ padding:"8px 14px", borderRadius:"10px", border:`0.5px solid ${newGoal.category===cat.key?cat.color+"50":"rgba(26,26,26,0.1)"}`, background:newGoal.category===cat.key?cat.bg:"transparent", color:newGoal.category===cat.key?cat.color:"rgba(26,26,26,0.4)", fontSize:"13px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:"20px" }}><label className="field-label">Description (optional)</label><textarea value={newGoal.description} onChange={e=>setNewGoal(p=>({...p,description:e.target.value}))} placeholder="What does success look like?" rows={2} className="field-input" style={{ resize:"none", lineHeight:1.5 }} /></div>
            <div style={{ marginBottom:"20px" }}><label className="field-label">Target Date (optional)</label><input type="date" value={newGoal.targetDate} onChange={e=>setNewGoal(p=>({...p,targetDate:e.target.value}))} className="field-input" /></div>
            <div style={{ marginBottom:"28px" }}>
              <label className="field-label">Starting Progress — {newGoal.progress}%</label>
              <input type="range" min="0" max="100" value={newGoal.progress} onChange={e=>setNewGoal(p=>({...p,progress:parseInt(e.target.value)}))} style={{ background:`linear-gradient(to right, #00c896 ${newGoal.progress}%, rgba(26,26,26,0.1) ${newGoal.progress}%)` }} />
            </div>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={saveGoal} disabled={!newGoal.title.trim()} style={{ flex:1, padding:"14px", background:newGoal.title.trim()?"linear-gradient(135deg,#00c896,#0ea5e9)":"rgba(26,26,26,0.06)", border:"none", borderRadius:"16px", color:newGoal.title.trim()?"#fff":"rgba(26,26,26,0.3)", fontSize:"16px", fontWeight:900, cursor:newGoal.title.trim()?"pointer":"default", fontFamily:"'Nunito',sans-serif" }}>{editingGoal?"Save Changes":"Add Goal"}</button>
              <button onClick={()=>{setShowAddGoal(false);setEditingGoal(null);}} style={{ padding:"14px 20px", background:"rgba(26,26,26,0.05)", border:"none", borderRadius:"16px", color:"rgba(26,26,26,0.4)", fontSize:"15px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Win Modal */}
      {showAddWin && (
        <div style={{ position:"fixed", inset:0, zIndex:150, background:"rgba(245,242,238,0.88)", backdropFilter:"blur(24px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", animation:"fadeIn 0.3s ease" }}>
          <div style={{ background:"rgba(255,255,255,0.92)", border:"0.5px solid rgba(26,26,26,0.08)", borderRadius:"32px", padding:"36px", maxWidth:"480px", width:"100%", animation:"slideUp 0.4s cubic-bezier(0.34,1.2,0.64,1)", boxShadow:"0 24px 80px rgba(0,0,0,0.08)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"28px" }}>
              <h2 style={{ fontSize:"22px", fontWeight:900, letterSpacing:"-0.02em" }}>Log a Win</h2>
<button onClick={()=>{setShowAddWin(false);setNewWin({text:"",category:growthTab,date:""});}} style={{ background:"none", border:"none", fontSize:"20px", color:"rgba(26,26,26,0.3)", cursor:"pointer" }}>×</button>            </div>
            <div style={{ background:"rgba(0,200,150,0.06)", border:"0.5px solid rgba(0,200,150,0.15)", borderRadius:"16px", padding:"14px 18px", marginBottom:"24px" }}>
              <div style={{ fontSize:"14px", fontWeight:600, color:"#00a87c", lineHeight:1.6 }}>Every win counts — big or small. Getting out of bed, sending one email, finishing a task. All of it matters.</div>
            </div>
            <div style={{ marginBottom:"20px" }}><label className="field-label">What did you accomplish?</label><textarea value={newWin.text} onChange={e=>setNewWin(p=>({...p,text:e.target.value}))} placeholder="e.g. I finally sent that email I'd been putting off…" rows={3} className="field-input" style={{ resize:"none", lineHeight:1.5 }} autoFocus /></div>
            <div style={{ marginBottom:"20px" }}>
              <label className="field-label">Category</label>
              <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                {GROWTH_CATEGORIES.map(cat=>(
                  <button key={cat.key} onClick={()=>setNewWin(p=>({...p,category:cat.key}))} style={{ padding:"8px 14px", borderRadius:"10px", border:`0.5px solid ${newWin.category===cat.key?cat.color+"50":"rgba(26,26,26,0.1)"}`, background:newWin.category===cat.key?cat.bg:"transparent", color:newWin.category===cat.key?cat.color:"rgba(26,26,26,0.4)", fontSize:"13px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:"28px" }}><label className="field-label">Date (optional)</label><input type="date" value={newWin.date} onChange={e=>setNewWin(p=>({...p,date:e.target.value}))} className="field-input" /></div>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={saveWin} disabled={!newWin.text.trim()} style={{ flex:1, padding:"14px", background:newWin.text.trim()?"linear-gradient(135deg,#00c896,#0ea5e9)":"rgba(26,26,26,0.06)", border:"none", borderRadius:"16px", color:newWin.text.trim()?"#fff":"rgba(26,26,26,0.3)", fontSize:"16px", fontWeight:900, cursor:newWin.text.trim()?"pointer":"default", fontFamily:"'Nunito',sans-serif" }}>Log this Win</button>
              <button onClick={()=>setShowAddWin(false)} style={{ padding:"14px 20px", background:"rgba(26,26,26,0.05)", border:"none", borderRadius:"16px", color:"rgba(26,26,26,0.4)", fontSize:"15px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Memory Panel */}
      {showMemory && (
        <div className="memory-panel">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
            <div style={{ fontSize:"17px", fontWeight:800 }}>Memory</div>
            <button onClick={()=>setShowMemory(false)} style={{ background:"none", border:"none", fontSize:"20px", color:"rgba(26,26,26,0.3)", cursor:"pointer" }}>×</button>
          </div>
          <p style={{ fontSize:"13px", color:"rgba(26,26,26,0.4)", fontWeight:500, lineHeight:1.6, marginBottom:"20px" }}>Luma remembers your past conversations for more personalized support.</p>
          {conversations.length===0 ? (
            <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(26,26,26,0.22)" }}><div style={{ fontSize:"15px", fontWeight:700, marginBottom:"8px" }}>No memories yet</div><div style={{ fontSize:"13px" }}>Start chatting and Luma will remember.</div></div>
          ) : conversations.map(conv=>(
            <div key={conv.id} className="mem-card" onClick={()=>loadConversation(conv)}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
                <div style={{ fontSize:"11px", fontWeight:800, color:"rgba(26,26,26,0.3)", letterSpacing:"0.06em", textTransform:"uppercase" }}>{conv.dateLabel}</div>
                <button className="mem-del" onClick={e=>{e.stopPropagation();deleteConversation(conv.id);}} style={{ opacity:0, background:"none", border:"none", color:"#ff453a", cursor:"pointer", fontSize:"16px", transition:"opacity 0.2s" }}>×</button>
              </div>
              <div style={{ fontSize:"14px", fontWeight:600, color:"rgba(26,26,26,0.75)", lineHeight:1.5, marginBottom:"4px" }}>{conv.messages.filter(m=>m.role==="user")[0]?.content.slice(0,80)}…</div>
              <div style={{ fontSize:"12px", color:"rgba(26,26,26,0.35)" }}>{conv.messageCount} messages</div>
            </div>
          ))}
          {conversations.length>0&&<button onClick={()=>{setConversations([]);localStorage.removeItem("luma_conversations");}} style={{ width:"100%", padding:"12px", background:"rgba(255,69,58,0.06)", border:"0.5px solid rgba(255,69,58,0.15)", borderRadius:"12px", color:"#ff453a", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif", marginTop:"12px" }}>Clear all memories</button>}
        </div>
      )}

      {/* Nav */}
      <nav className="nav-glass" style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, height:"64px", display:"flex", alignItems:"center", padding:"0 40px", justifyContent:"space-between" }}>
        <div className="luma-logo aurora-text" onClick={()=>setScreen("home")}>Luma</div>
        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          {profile.condition&&profile.condition!=="none"&&<span style={{ fontSize:"11px", fontWeight:800, color:conditionColors[profile.condition], background:`${conditionColors[profile.condition]}15`, padding:"4px 10px", borderRadius:"100px", marginRight:"4px" }}>{conditionLabels[profile.condition]}</span>}
          <div style={{ display:"flex", alignItems:"center", gap:"5px", marginRight:"8px" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:ollamaStatus==="online"?"#00c896":"#ff453a", boxShadow:ollamaStatus==="online"?"0 0 8px rgba(0,200,150,0.5)":"0 0 8px rgba(255,69,58,0.5)" }} />
            <span style={{ fontSize:"13px", fontWeight:700, color:ollamaStatus==="online"?"#00a87c":"#ff453a" }}>{ollamaStatus==="online"?"Connected":"Offline"}</span>
          </div>
          {[["home","Home"],["chat","Chat"],["tasks","Tasks"],["growth","Growth"],["profile","Profile"]].map(([s,l])=>(
            <button key={s} className={`nav-btn ${screen===s?"active":""}`} onClick={()=>setScreen(s)} style={{ position:"relative" }}>
              {l}
              {s==="tasks"&&(urgentCount>0||overdueCount>0)&&<span style={{ position:"absolute", top:"4px", right:"8px", width:"7px", height:"7px", borderRadius:"50%", background:"#ff453a" }} />}
              {s==="growth"&&totalWins>0&&<span style={{ position:"absolute", top:"4px", right:"8px", width:"6px", height:"6px", borderRadius:"50%", background:"linear-gradient(135deg,#00c896,#0ea5e9)" }} />}
            </button>
          ))}
          <button className={`nav-btn ${showMemory?"active":""}`} onClick={()=>setShowMemory(m=>!m)} style={{ position:"relative" }}>
            Memory
            {conversations.length>0&&<span style={{ position:"absolute", top:"4px", right:"8px", width:"6px", height:"6px", borderRadius:"50%", background:"linear-gradient(135deg,#00c896,#0ea5e9)" }} />}
          </button>
        </div>
      </nav>

      {/* HOME */}
      {screen==="home"&&(
        <div className="section-scroll" style={{ paddingTop:"92px", position:"relative", zIndex:1, minHeight:"100vh" }}>
          <div style={{ maxWidth:"720px", margin:"0 auto" }}>
            {showBriefingCard&&(
              <div style={{ background:"rgba(255,255,255,0.82)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"28px", padding:"28px 32px", marginBottom:"28px", backdropFilter:"blur(20px)", boxShadow:"0 4px 32px rgba(0,0,0,0.06)", animation:"briefingIn 0.5s cubic-bezier(0.34,1.2,0.64,1)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"linear-gradient(135deg,#00c896,#0ea5e9)", animation:"pulse 2s infinite" }} />
                    <div style={{ fontSize:"12px", fontWeight:800, color:"rgba(26,26,26,0.35)", letterSpacing:"0.08em", textTransform:"uppercase" }}>{dayInfo.dayName} Morning Briefing</div>
                  </div>
                  <button onClick={()=>setBriefingDismissed(true)} style={{ background:"none", border:"none", fontSize:"18px", color:"rgba(26,26,26,0.25)", cursor:"pointer" }}>×</button>
                </div>
                {briefingLoading ? (
                  <div>{[75,90,65,80].map((w,i)=><div key={i} style={{ height:"14px", borderRadius:"8px", marginBottom:"10px", width:`${w}%` }} className="briefing-shimmer" />)}<div style={{ fontSize:"13px", fontWeight:600, color:"rgba(26,26,26,0.3)", marginTop:"12px" }}>Generating your morning briefing…</div></div>
                ) : (
                  <div>
                    <div style={{ fontSize:"16px", fontWeight:500, color:"#1a1a1a", lineHeight:1.72, whiteSpace:"pre-wrap", marginBottom:"20px" }}>{briefing}</div>
                    <div style={{ display:"flex", gap:"10px" }}>
                      <button onClick={respondToBriefing} style={{ padding:"11px 22px", background:"linear-gradient(135deg,#00c896,#0ea5e9)", border:"none", borderRadius:"14px", color:"#fff", fontSize:"14px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Respond to Luma</button>
                      <button onClick={generateBriefing} style={{ padding:"11px 18px", background:"rgba(26,26,26,0.05)", border:"0.5px solid rgba(26,26,26,0.08)", borderRadius:"14px", color:"rgba(26,26,26,0.5)", fontSize:"14px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Refresh</button>
                      <button onClick={()=>setBriefingDismissed(true)} style={{ padding:"11px 18px", background:"transparent", border:"none", color:"rgba(26,26,26,0.3)", fontSize:"14px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Dismiss</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {!showBriefingCard&&lastSession&&(
              <div style={{ background:"rgba(255,255,255,0.65)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"20px", padding:"16px 20px", marginBottom:"28px", backdropFilter:"blur(20px)", cursor:"pointer", animation:"fadeUp 0.5s ease" }} onClick={()=>loadConversation(lastSession)}>
                <div style={{ fontSize:"11px", fontWeight:800, color:"rgba(26,26,26,0.3)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"6px" }}>Continue from last time · {lastSession.dateLabel}</div>
                <div style={{ fontSize:"15px", fontWeight:600, color:"rgba(26,26,26,0.65)", lineHeight:1.5 }}>"{lastSession.messages.filter(m=>m.role==="user")[0]?.content.slice(0,100)}…"</div>
              </div>
            )}
            <div style={{ marginBottom:"20px", animation:"fadeUp 0.6s ease" }}>
              <div className="pill" style={{ marginBottom:"20px" }}><div className="pill-dot" />{GREETING()}{profile.name?`, ${profile.name}`:""} &nbsp;·&nbsp; {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
              <h1 style={{ fontSize:"clamp(44px,7vw,72px)", fontWeight:900, letterSpacing:"-0.04em", lineHeight:1.05, marginBottom:"20px" }}>Your life.<br /><span className="aurora-text">Illuminated.</span></h1>
              <p style={{ fontSize:"clamp(17px,2vw,20px)", color:"rgba(26,26,26,0.45)", lineHeight:1.65, fontWeight:500, maxWidth:"520px" }}>I'm here for you — your career, your goals, your hard days, and everything in between.</p>
            </div>
            <div style={{ animation:"fadeUp 0.6s ease 0.1s both", marginBottom:"36px" }}>
              <div className="input-wrap" style={{ padding:"18px 20px", display:"flex", alignItems:"flex-end", gap:"12px" }}>
                <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage(input);}}} placeholder={`What can I help you with${profile.name?`, ${profile.name}`:""}?`} rows={1} style={{ flex:1, background:"transparent", border:"none", color:"#1a1a1a", fontSize:"17px", resize:"none", fontFamily:"'Nunito',sans-serif", fontWeight:600, lineHeight:1.6, maxHeight:"160px", overflowY:"auto" }} onInput={e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,160)+"px";}} />
                <button className={`mic-btn ${isListening?"listening":""}`} onClick={isListening?stopListening:startListening} style={{ width:"44px", height:"44px", borderRadius:"14px", background:isListening?"#ff453a":"rgba(26,26,26,0.07)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={isListening?"#fff":"rgba(26,26,26,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                </button>
                <button className="send-btn" onClick={()=>sendMessage(input)} disabled={!input.trim()||loading} style={{ width:"44px", height:"44px", borderRadius:"14px", background:input.trim()?"linear-gradient(135deg,#00c896,#0ea5e9)":"rgba(26,26,26,0.06)", border:"none", cursor:input.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {loading?<div style={{ width:"16px", height:"16px", border:"2.5px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim()?"#fff":"rgba(26,26,26,0.3)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>}
                </button>
              </div>
              <div style={{ fontSize:"12px", fontWeight:600, color:"rgba(26,26,26,0.18)", marginTop:"10px", paddingLeft:"4px" }}>{isListening?"Listening… tap mic to stop":"Tap mic to speak · Enter to send"}</div>
            </div>
            <div style={{ animation:"fadeUp 0.6s ease 0.2s both" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
                <div className="pill-label">Suggested</div>
                {briefingDismissed&&<button onClick={()=>{setBriefingDismissed(false);generateBriefing();}} style={{ fontSize:"12px", fontWeight:800, color:"rgba(26,26,26,0.3)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Get morning briefing</button>}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {[
                  { label:"How are you doing today?", prompt:"Hey Luma. Check in with me — ask me how I'm doing and help me figure out what kind of support I need today." },
                  { label:"Help me start my day", prompt:"Give me my morning briefing. Help me start with intention — keep it gentle and simple." },
                  { label:"I need help with something", prompt:"I need your help. Ask me what it is and let's work through it together at my own pace." }
                ].map(s=>(
                  <button key={s.label} className="suggest-btn" onClick={()=>sendMessage(s.prompt)}>
                    <span>{s.label}</span><span style={{ fontSize:"16px", opacity:0.25 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
            {tasks.filter(t=>!t.done).length>0&&(
              <div style={{ marginTop:"40px", animation:"fadeUp 0.6s ease 0.3s both" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
                  <div className="pill-label">{urgentCount>0&&<span style={{ color:"#ff453a" }}>{urgentCount} urgent · </span>}{todayCount>0&&<span style={{ color:"#0ea5e9" }}>{todayCount} due today · </span>}{tasks.filter(t=>!t.done).length} total pending</div>
                  <button onClick={()=>setScreen("tasks")} style={{ fontSize:"13px", fontWeight:800, color:"rgba(26,26,26,0.3)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>See all</button>
                </div>
                {tasks.filter(t=>!t.done).sort((a,b)=>{const o={urgent:0,high:1,normal:2,low:3};return(o[a.priority]||2)-(o[b.priority]||2);}).slice(0,3).map(task=>{
                  const p=PRIORITY_CONFIG[task.priority||"normal"];
                  return (<div key={task.id} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"13px 18px", background:"rgba(255,255,255,0.72)", border:`0.5px solid ${task.overdue?"rgba(255,69,58,0.2)":"rgba(26,26,26,0.07)"}`, borderRadius:"16px", marginBottom:"8px", backdropFilter:"blur(20px)" }}>
                    <div onClick={()=>toggleTask(task.id)} style={{ width:"20px", height:"20px", border:`2px solid ${p.color}40`, borderRadius:"7px", cursor:"pointer", flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:"15px", fontWeight:600, color:task.overdue?"#ff453a":"rgba(26,26,26,0.72)" }}>{task.text}</span>
                    <span style={{ fontSize:"11px", fontWeight:800, color:p.color, background:p.bg, padding:"3px 8px", borderRadius:"6px" }}>{p.label}</span>
                  </div>);
                })}
              </div>
            )}
            {/* Growth summary on home */}
            {(totalGoals > 0 || totalWins > 0) && (
              <div style={{ marginTop:"32px", animation:"fadeUp 0.6s ease 0.4s both" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
                  <div className="pill-label">Growth</div>
                  <button onClick={()=>setScreen("growth")} style={{ fontSize:"13px", fontWeight:800, color:"rgba(26,26,26,0.3)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>See all</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                  <div style={{ background:"rgba(255,255,255,0.72)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"18px", padding:"16px 20px", backdropFilter:"blur(20px)", textAlign:"center" }}>
                    <div style={{ fontSize:"28px", fontWeight:900, color:"#0ea5e9", letterSpacing:"-0.02em" }}>{totalGoals}</div>
                    <div style={{ fontSize:"12px", fontWeight:700, color:"rgba(26,26,26,0.35)", marginTop:"2px" }}>Active Goals</div>
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.72)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"18px", padding:"16px 20px", backdropFilter:"blur(20px)", textAlign:"center" }}>
                    <div style={{ fontSize:"28px", fontWeight:900, color:"#00c896", letterSpacing:"-0.02em" }}>{totalWins}</div>
                    <div style={{ fontSize:"12px", fontWeight:700, color:"rgba(26,26,26,0.35)", marginTop:"2px" }}>Wins Logged</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHAT */}
      {screen==="chat"&&(
        <div style={{ display:"flex", flexDirection:"column", height:"100vh", paddingTop:"64px", position:"relative", zIndex:1 }}>
          <div style={{ flex:1, overflowY:"auto", padding:"32px 24px" }}>
            <div style={{ maxWidth:"720px", margin:"0 auto" }}>
              {messages.length===0&&(<div style={{ textAlign:"center", padding:"100px 0" }}><div style={{ fontSize:"48px", fontWeight:900, marginBottom:"16px" }}><span className="aurora-text">Luma</span></div><div style={{ fontSize:"18px", fontWeight:600, color:"rgba(26,26,26,0.3)" }}>I'm here. What's on your mind?</div>{conversations.length>0&&<div style={{ marginTop:"16px", fontSize:"14px", fontWeight:600, color:"rgba(26,26,26,0.3)" }}>I remember our past {conversations.length} conversation{conversations.length!==1?"s":""}.</div>}</div>)}
              {messages.map((m,i)=>(
                <div key={i} style={{ marginBottom:"28px", display:"flex", flexDirection:"column", alignItems:m.role==="user"?"flex-end":"flex-start", animation:"fadeUp 0.35s ease" }}>
                  <div style={{ fontSize:"11px", fontWeight:800, color:"rgba(26,26,26,0.22)", marginBottom:"8px", padding:m.role==="user"?"0 6px 0 0":"0 0 0 6px", letterSpacing:"0.08em" }}>{m.role==="user"?(profile.name||"YOU").toUpperCase():"LUMA"}</div>
                  <div style={{ maxWidth:"82%", padding:"16px 22px", borderRadius:m.role==="user"?"22px 22px 6px 22px":"6px 22px 22px 22px", background:m.role==="user"?"linear-gradient(135deg,rgba(0,200,150,0.1),rgba(14,165,233,0.1))":"rgba(255,255,255,0.82)", backdropFilter:"blur(20px)", border:m.role==="user"?"0.5px solid rgba(0,200,150,0.18)":"0.5px solid rgba(26,26,26,0.07)", color:"#1a1a1a", fontSize:"17px", lineHeight:1.72, whiteSpace:"pre-wrap", fontWeight:500, boxShadow:m.role!=="user"?"0 2px 16px rgba(0,0,0,0.04)":"none" }}>{m.content}</div>
                </div>
              ))}
              {loading&&(<div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", marginBottom:"28px" }}><div style={{ fontSize:"11px", fontWeight:800, color:"rgba(26,26,26,0.22)", marginBottom:"8px", paddingLeft:"6px", letterSpacing:"0.08em" }}>LUMA</div><div style={{ padding:"16px 22px", background:"rgba(255,255,255,0.82)", backdropFilter:"blur(20px)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"6px 22px 22px 22px", display:"flex", gap:"7px", alignItems:"center" }}>{[0,0.22,0.44].map((d,i)=><div key={i} style={{ width:"8px", height:"8px", borderRadius:"50%", background:"linear-gradient(135deg,#00c896,#0ea5e9)", animation:`pulse 1.5s infinite ${d}s` }}/>)}</div></div>)}
              <div ref={bottomRef}/>
            </div>
          </div>
          <div className="nav-glass" style={{ padding:"14px 40px 24px", flexShrink:0, borderTop:"0.5px solid rgba(26,26,26,0.06)" }}>
            <div style={{ maxWidth:"720px", margin:"0 auto" }}>
              <div className="input-wrap" style={{ padding:"12px 16px", display:"flex", alignItems:"flex-end", gap:"10px" }}>
                <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage(input);}}} placeholder="Message Luma… or tap mic to speak" rows={1} style={{ flex:1, background:"transparent", border:"none", color:"#1a1a1a", fontSize:"16px", resize:"none", fontFamily:"'Nunito',sans-serif", fontWeight:600, lineHeight:1.6, maxHeight:"120px" }} onInput={e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}}/>
                <button className={`mic-btn ${isListening?"listening":""}`} onClick={isListening?stopListening:startListening} style={{ width:"38px", height:"38px", borderRadius:"12px", background:isListening?"#ff453a":"rgba(26,26,26,0.06)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={isListening?"#fff":"rgba(26,26,26,0.45)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                </button>
                <button className="send-btn" onClick={()=>sendMessage(input)} disabled={!input.trim()||loading} style={{ width:"38px", height:"38px", borderRadius:"12px", background:input.trim()?"linear-gradient(135deg,#00c896,#0ea5e9)":"rgba(26,26,26,0.06)", border:"none", cursor:input.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {loading?<div style={{ width:"14px", height:"14px", border:"2.5px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim()?"#fff":"rgba(26,26,26,0.3)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>}
                </button>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:"10px" }}>
                <div style={{ fontSize:"12px", fontWeight:600, color:"rgba(26,26,26,0.18)" }}>{isListening?"Listening… tap mic to stop":"Enter to send · Shift+Enter for new line"}</div>
                <div style={{ display:"flex", gap:"12px" }}>
                  <button onClick={saveCurrentSession} style={{ fontSize:"12px", fontWeight:700, color:sessionSaved?"#00c896":"rgba(26,26,26,0.2)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif", transition:"color 0.2s" }}>{sessionSaved?"✓ Saved":"Save"}</button>
                  <button onClick={clearCurrentChat} style={{ fontSize:"12px", fontWeight:700, color:"rgba(26,26,26,0.2)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>New chat</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TASKS */}
      {screen==="tasks"&&(
        <div className="section-scroll" style={{ paddingTop:"92px", position:"relative", zIndex:1, minHeight:"100vh" }}>
          <div style={{ maxWidth:"720px", margin:"0 auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", animation:"fadeUp 0.5s ease" }}>
              <div>
                <h2 style={{ fontSize:"clamp(36px,5vw,52px)", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"6px" }}>Tasks</h2>
                <div style={{ display:"flex", gap:"12px", fontSize:"13px", fontWeight:700 }}>
                  {urgentCount>0&&<span style={{ color:"#ff453a" }}>{urgentCount} urgent</span>}
                  {todayCount>0&&<span style={{ color:"#0ea5e9" }}>{todayCount} due today</span>}
                  {overdueCount>0&&<span style={{ color:"#ff453a" }}>{overdueCount} overdue</span>}
                  {!urgentCount&&!todayCount&&!overdueCount&&<span style={{ color:"rgba(26,26,26,0.36)" }}>One step at a time.</span>}
                </div>
              </div>
              <button onClick={()=>{setNewTask({text:"",priority:"normal",dueDate:"",dueTime:"",reminderTime:"",recurrence:"none",notes:""});setEditingTask(null);setShowAddTask(true);}} style={{ padding:"12px 20px", background:"linear-gradient(135deg,#00c896,#0ea5e9)", border:"none", borderRadius:"16px", color:"#fff", fontSize:"15px", fontWeight:900, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>+ New Task</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px", marginBottom:"20px" }}>
              {[{label:"Total",value:tasks.length,color:"rgba(26,26,26,0.6)"},{label:"Pending",value:tasks.filter(t=>!t.done).length,color:"#0ea5e9"},{label:"Done",value:tasks.filter(t=>t.done).length,color:"#00c896"},{label:"Urgent",value:urgentCount,color:"#ff453a"}].map(stat=>(
                <div key={stat.label} style={{ background:"rgba(255,255,255,0.72)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"16px", padding:"14px 16px", backdropFilter:"blur(20px)", textAlign:"center" }}>
                  <div style={{ fontSize:"24px", fontWeight:900, color:stat.color, letterSpacing:"-0.02em" }}>{stat.value}</div>
                  <div style={{ fontSize:"11px", fontWeight:800, color:"rgba(26,26,26,0.3)", textTransform:"uppercase", letterSpacing:"0.06em", marginTop:"2px" }}>{stat.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap", alignItems:"center" }}>
              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                {[{key:"all",label:"All"},{key:"pending",label:"Pending"},{key:"today",label:"Today"},{key:"urgent",label:"Urgent"},{key:"done",label:"Done"}].map(f=>(
                  <button key={f.key} className={`filter-btn ${taskFilter===f.key?"active":""}`} onClick={()=>setTaskFilter(f.key)}>{f.label}</button>
                ))}
              </div>
              <div style={{ marginLeft:"auto", display:"flex", gap:"6px" }}>
                <button className={`filter-btn ${taskSort==="priority"?"active":""}`} onClick={()=>setTaskSort("priority")}>Priority</button>
                <button className={`filter-btn ${taskSort==="due"?"active":""}`} onClick={()=>setTaskSort("due")}>Due date</button>
              </div>
            </div>
            <button onClick={suggestTasksFromGoals} disabled={suggestingTasks} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", padding:"12px 20px", background:"rgba(255,255,255,0.6)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"14px", color:"rgba(26,26,26,0.45)", fontSize:"14px", fontWeight:700, cursor:"pointer", marginBottom:"16px", width:"100%", fontFamily:"'Nunito',sans-serif", transition:"all 0.2s" }}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.9)";e.currentTarget.style.color="rgba(26,26,26,0.7)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.6)";e.currentTarget.style.color="rgba(26,26,26,0.45)";}}>
              {suggestingTasks?<><div style={{ width:"14px", height:"14px", border:"2px solid rgba(26,26,26,0.2)", borderTopColor:"rgba(26,26,26,0.5)", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>Suggesting tasks…</>:"Ask Luma to suggest tasks based on your goals"}
            </button>
            {suggestedTasks.length>0&&(
              <div style={{ background:"rgba(0,200,150,0.05)", border:"0.5px solid rgba(0,200,150,0.15)", borderRadius:"18px", padding:"16px 20px", marginBottom:"20px" }}>
                <div style={{ fontSize:"12px", fontWeight:800, color:"#00a87c", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"12px" }}>Luma suggests</div>
                {suggestedTasks.map((text,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 0", borderBottom:i<suggestedTasks.length-1?"0.5px solid rgba(0,200,150,0.1)":"none" }}>
                    <span style={{ flex:1, fontSize:"15px", fontWeight:600, color:"rgba(26,26,26,0.72)" }}>{text}</span>
                    <button onClick={()=>addSuggestedTask(text)} style={{ padding:"6px 14px", background:"rgba(0,200,150,0.1)", border:"0.5px solid rgba(0,200,150,0.2)", borderRadius:"10px", color:"#00a87c", fontSize:"13px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif", whiteSpace:"nowrap" }}>Add</button>
                  </div>
                ))}
              </div>
            )}
            {getFilteredTasks().length===0 ? (
              <div style={{ textAlign:"center", padding:"60px 0", color:"rgba(26,26,26,0.2)" }}>
                <div style={{ fontSize:"18px", fontWeight:800, marginBottom:"8px" }}>{taskFilter==="done"?"No completed tasks yet":"No tasks here"}</div>
                <div style={{ fontSize:"15px" }}>{taskFilter==="today"?"Nothing due today — enjoy your day!":taskFilter==="urgent"?"No urgent tasks — you're doing great!":"Add one above or ask Luma to suggest some."}</div>
              </div>
            ) : getFilteredTasks().map(task=>{
              const p=PRIORITY_CONFIG[task.priority||"normal"]; const isOverdue=!task.done&&task.overdue;
              return (<div key={task.id} className="task-row" style={{ background:"rgba(255,255,255,0.72)", border:`0.5px solid ${isOverdue?"rgba(255,69,58,0.2)":task.done?"rgba(26,26,26,0.05)":"rgba(26,26,26,0.07)"}`, borderRadius:"18px", padding:"15px 18px", marginBottom:"8px", backdropFilter:"blur(20px)", display:"flex", alignItems:"flex-start", gap:"12px" }}>
                <div onClick={()=>toggleTask(task.id)} style={{ width:"22px", height:"22px", borderRadius:"7px", border:task.done?"none":`2px solid ${p.color}40`, background:task.done?"linear-gradient(135deg,#00c896,#0ea5e9)":"transparent", cursor:"pointer", flexShrink:0, marginTop:"2px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {task.done&&<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap", marginBottom:"4px" }}>
                    <span style={{ fontSize:"16px", fontWeight:600, color:task.done?"rgba(26,26,26,0.25)":isOverdue?"#ff453a":"rgba(26,26,26,0.82)", textDecoration:task.done?"line-through":"none" }}>{task.text}</span>
                    {!task.done&&<span style={{ fontSize:"11px", fontWeight:800, color:p.color, background:p.bg, padding:"2px 8px", borderRadius:"6px", border:`0.5px solid ${p.border}`, whiteSpace:"nowrap" }}>{p.label}</span>}
                    {task.recurrence&&task.recurrence!=="none"&&<span style={{ fontSize:"11px", fontWeight:700, color:"rgba(26,26,26,0.3)", background:"rgba(26,26,26,0.05)", padding:"2px 8px", borderRadius:"6px" }}>↺ {RECURRENCE_OPTIONS.find(r=>r.value===task.recurrence)?.label}</span>}
                  </div>
                  <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
                    {task.dueDate&&<span style={{ fontSize:"12px", fontWeight:600, color:isOverdue?"#ff453a":"rgba(26,26,26,0.35)" }}>{isOverdue?"Overdue · ":""}{task.dueDate}{task.dueTime?` at ${task.dueTime}`:""}</span>}
                    {task.reminderTime&&<span style={{ fontSize:"12px", fontWeight:600, color:"rgba(26,26,26,0.3)" }}>Reminder {task.reminderTime}</span>}
                    {task.notes&&<span style={{ fontSize:"12px", fontWeight:500, color:"rgba(26,26,26,0.3)" }}>{task.notes.slice(0,50)}{task.notes.length>50?"…":""}</span>}
                  </div>
                </div>
                <div style={{ display:"flex", gap:"4px", flexShrink:0 }}>
                  <button className="edit-btn" onClick={()=>startEditTask(task)} style={{ opacity:0, background:"none", border:"none", color:"rgba(26,26,26,0.3)", cursor:"pointer", fontSize:"14px", padding:"4px 6px", transition:"opacity 0.2s", fontFamily:"'Nunito',sans-serif", fontWeight:700 }}>Edit</button>
                  <button className="del-btn" onClick={()=>deleteTask(task.id)} style={{ opacity:0, background:"none", border:"none", color:"#ff453a", cursor:"pointer", fontSize:"20px", transition:"opacity 0.2s", padding:"0 4px", lineHeight:1 }}>×</button>
                </div>
              </div>);
            })}
          </div>
        </div>
      )}

      {/* GROWTH */}
      {screen==="growth"&&(
        <div className="section-scroll" style={{ paddingTop:"92px", position:"relative", zIndex:1, minHeight:"100vh" }}>
          <div style={{ maxWidth:"720px", margin:"0 auto" }}>
            <div style={{ marginBottom:"28px", animation:"fadeUp 0.5s ease" }}>
              <h2 style={{ fontSize:"clamp(36px,5vw,52px)", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"8px" }}>Growth</h2>
              <p style={{ fontSize:"17px", color:"rgba(26,26,26,0.36)", fontWeight:500 }}>Track your goals, log your wins, and see how far you've come.</p>
            </div>

            {/* Overall stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px", marginBottom:"24px" }}>
              {GROWTH_CATEGORIES.map(cat=>{
                const catGoals = growthData[cat.key] || [];
                const catWins = wins.filter(w => w.category === cat.key);
                return (
                  <div key={cat.key} onClick={()=>setGrowthTab(cat.key)} style={{ background:growthTab===cat.key?cat.bg:"rgba(255,255,255,0.72)", border:`0.5px solid ${growthTab===cat.key?cat.color+"30":"rgba(26,26,26,0.07)"}`, borderRadius:"18px", padding:"16px", backdropFilter:"blur(20px)", textAlign:"center", cursor:"pointer", transition:"all 0.25s" }}>
                    <div style={{ fontSize:"22px", marginBottom:"4px" }}>{cat.icon}</div>
                    <div style={{ fontSize:"13px", fontWeight:800, color:growthTab===cat.key?cat.color:"rgba(26,26,26,0.5)", marginBottom:"4px" }}>{cat.label}</div>
                    <div style={{ fontSize:"11px", fontWeight:700, color:"rgba(26,26,26,0.3)" }}>{catGoals.length}G · {catWins.length}W</div>
                  </div>
                );
              })}
            </div>

            {/* Category tabs */}
            <div style={{ display:"flex", gap:"8px", marginBottom:"24px", flexWrap:"wrap" }}>
              {GROWTH_CATEGORIES.map(cat=>(
                <button key={cat.key} className="growth-tab-btn" onClick={()=>setGrowthTab(cat.key)} style={{ background:growthTab===cat.key?cat.bg:"rgba(255,255,255,0.6)", borderColor:growthTab===cat.key?cat.color+"40":"rgba(26,26,26,0.09)", color:growthTab===cat.key?cat.color:"rgba(26,26,26,0.5)" }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            {/* AI Insight */}
            <div style={{ background:"rgba(255,255,255,0.75)", border:`0.5px solid ${currentCat.color}20`, borderRadius:"22px", padding:"22px 24px", marginBottom:"20px", backdropFilter:"blur(20px)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
                <div style={{ fontSize:"13px", fontWeight:800, color:currentCat.color, letterSpacing:"0.06em", textTransform:"uppercase" }}>Luma's {currentCat.label} Insight</div>
                <button onClick={generateGrowthInsight} disabled={growthInsightLoading} style={{ padding:"7px 14px", background:currentCat.bg, border:`0.5px solid ${currentCat.color}30`, borderRadius:"10px", color:currentCat.color, fontSize:"12px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>
                  {growthInsightLoading?"Thinking…":"Get Insight"}
                </button>
              </div>
              {growthInsightLoading ? (
                <div>{[80,65,90].map((w,i)=><div key={i} style={{ height:"13px", borderRadius:"8px", marginBottom:"8px", width:`${w}%` }} className="briefing-shimmer" />)}</div>
              ) : growthInsight ? (
                <div style={{ fontSize:"15px", fontWeight:500, color:"rgba(26,26,26,0.72)", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{growthInsight}</div>
              ) : (
                <div style={{ fontSize:"15px", fontWeight:500, color:"rgba(26,26,26,0.35)", lineHeight:1.7 }}>Click "Get Insight" for personalized {currentCat.label.toLowerCase()} coaching from Luma.</div>
              )}
            </div>

            {/* Goals section */}
            <div style={{ marginBottom:"28px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
                <div className="pill-label">{currentCat.label} Goals ({currentGoals.length})</div>
                <button onClick={()=>{setNewGoal({title:"",category:growthTab,description:"",targetDate:"",progress:0});setEditingGoal(null);setShowAddGoal(true);}} style={{ padding:"8px 16px", background:`linear-gradient(135deg,${currentCat.color},${currentCat.color}cc)`, border:"none", borderRadius:"12px", color:"#fff", fontSize:"13px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>+ Add Goal</button>
              </div>
              {currentGoals.length===0 ? (
                <div style={{ textAlign:"center", padding:"32px 0", color:"rgba(26,26,26,0.22)", background:"rgba(255,255,255,0.5)", borderRadius:"18px", border:"0.5px solid rgba(26,26,26,0.06)" }}>
                  <div style={{ fontSize:"16px", fontWeight:700, marginBottom:"6px" }}>No {currentCat.label.toLowerCase()} goals yet</div>
                  <div style={{ fontSize:"14px" }}>Add your first goal to start tracking your progress.</div>
                </div>
              ) : currentGoals.map(goal=>(
                <div key={goal.id} className="goal-row" style={{ background:"rgba(255,255,255,0.75)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"18px", padding:"18px 20px", marginBottom:"10px", backdropFilter:"blur(20px)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:"16px", fontWeight:800, color:"#1a1a1a", marginBottom:"4px" }}>{goal.title}</div>
                      {goal.description&&<div style={{ fontSize:"13px", fontWeight:500, color:"rgba(26,26,26,0.45)", lineHeight:1.5, marginBottom:"4px" }}>{goal.description}</div>}
                      {goal.targetDate&&<div style={{ fontSize:"12px", fontWeight:700, color:"rgba(26,26,26,0.3)" }}>Target: {goal.targetDate}</div>}
                    </div>
                    <div style={{ display:"flex", gap:"4px", marginLeft:"12px" }}>
                      <button onClick={()=>{setNewGoal({title:goal.title,category:goal.category||growthTab,description:goal.description||"",targetDate:goal.targetDate||"",progress:goal.progress||0});setEditingGoal(goal);setShowAddGoal(true);}} style={{ background:"none", border:"none", color:"rgba(26,26,26,0.3)", cursor:"pointer", fontSize:"13px", fontWeight:700, padding:"4px 6px", fontFamily:"'Nunito',sans-serif" }}>Edit</button>
                      <button className="goal-del" onClick={()=>deleteGoal(growthTab,goal.id)} style={{ opacity:0, background:"none", border:"none", color:"#ff453a", cursor:"pointer", fontSize:"18px", transition:"opacity 0.2s", padding:"0 4px", lineHeight:1 }}>×</button>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                    <div style={{ flex:1 }}>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width:`${goal.progress||0}%`, background:`linear-gradient(90deg,${currentCat.color},${currentCat.color}99)` }} />
                      </div>
                    </div>
                    <div style={{ fontSize:"13px", fontWeight:800, color:currentCat.color, minWidth:"36px", textAlign:"right" }}>{goal.progress||0}%</div>
                  </div>
                  <input type="range" min="0" max="100" value={goal.progress||0} onChange={e=>updateGoalProgress(growthTab,goal.id,parseInt(e.target.value))} style={{ width:"100%", marginTop:"8px", background:`linear-gradient(to right, ${currentCat.color} ${goal.progress||0}%, rgba(26,26,26,0.1) ${goal.progress||0}%)` }} />
                </div>
              ))}
            </div>

            {/* Wins Journal */}
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
                <div className="pill-label">{currentCat.label} Wins ({currentWins.length})</div>
                <button onClick={()=>{setNewWin({text:"",category:growthTab,date:""});setShowAddWin(true);}} style={{ padding:"8px 16px", background:"rgba(0,200,150,0.1)", border:"0.5px solid rgba(0,200,150,0.2)", borderRadius:"12px", color:"#00a87c", fontSize:"13px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>+ Log Win</button>
              </div>
              {currentWins.length===0 ? (
                <div style={{ textAlign:"center", padding:"32px 0", color:"rgba(26,26,26,0.22)", background:"rgba(255,255,255,0.5)", borderRadius:"18px", border:"0.5px solid rgba(26,26,26,0.06)" }}>
                  <div style={{ fontSize:"16px", fontWeight:700, marginBottom:"6px" }}>No wins logged yet</div>
                  <div style={{ fontSize:"14px" }}>Every step counts. Log your first win — however small.</div>
                </div>
              ) : currentWins.map(win=>(
                <div key={win.id} className="win-row" style={{ display:"flex", alignItems:"flex-start", gap:"12px", background:"rgba(0,200,150,0.05)", border:"0.5px solid rgba(0,200,150,0.12)", borderRadius:"16px", padding:"14px 18px", marginBottom:"8px" }}>
                  <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#00c896", flexShrink:0, marginTop:"6px" }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"15px", fontWeight:600, color:"rgba(26,26,26,0.78)", lineHeight:1.5 }}>{win.text}</div>
                    <div style={{ fontSize:"12px", fontWeight:700, color:"rgba(26,26,26,0.3)", marginTop:"4px" }}>{win.date}</div>
                  </div>
                  <button className="win-del" onClick={()=>deleteWin(win.id)} style={{ opacity:0, background:"none", border:"none", color:"#ff453a", cursor:"pointer", fontSize:"18px", transition:"opacity 0.2s", padding:"0 4px", lineHeight:1 }}>×</button>
                </div>
              ))}

              {/* Ask Luma to reflect on wins */}
              {currentWins.length > 0 && (
                <button onClick={()=>sendMessage(`I want to reflect on my ${currentCat.label.toLowerCase()} wins and see how far I've come. Here are my recent wins: ${currentWins.slice(0,5).map(w=>w.text).join(", ")}. Please celebrate these with me and help me see my progress.`)} style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"13px 20px", background:"rgba(255,255,255,0.6)", border:"0.5px solid rgba(26,26,26,0.07)", borderRadius:"16px", color:"rgba(26,26,26,0.45)", fontSize:"14px", fontWeight:700, cursor:"pointer", marginTop:"12px", width:"100%", fontFamily:"'Nunito',sans-serif", transition:"all 0.2s" }}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.92)";e.currentTarget.style.color="rgba(26,26,26,0.7)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.6)";e.currentTarget.style.color="rgba(26,26,26,0.45)";}}>
                  Ask Luma to celebrate my progress with me
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PROFILE */}
      {screen==="profile"&&(
        <div className="section-scroll" style={{ paddingTop:"92px", position:"relative", zIndex:1, minHeight:"100vh" }}>
          <div style={{ maxWidth:"720px", margin:"0 auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"36px", animation:"fadeUp 0.5s ease" }}>
              <div>
                <h2 style={{ fontSize:"clamp(36px,5vw,52px)", fontWeight:900, letterSpacing:"-0.04em", marginBottom:"8px" }}>Profile</h2>
                <p style={{ fontSize:"17px", color:"rgba(26,26,26,0.36)", fontWeight:500 }}>Help Luma know you better.</p>
              </div>
              <button onClick={()=>editingProfile?saveProfile():setEditingProfile(true)} style={{ padding:"12px 24px", background:editingProfile?"linear-gradient(135deg,#00c896,#0ea5e9)":"rgba(255,255,255,0.75)", border:`0.5px solid ${editingProfile?"transparent":"rgba(26,26,26,0.1)"}`, borderRadius:"18px", color:editingProfile?"#fff":"#1a1a1a", fontSize:"15px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>{editingProfile?"Save":"Edit"}</button>
            </div>
            {conversations.length>0&&(
              <div style={{ background:"rgba(0,200,150,0.06)", border:"0.5px solid rgba(0,200,150,0.15)", borderRadius:"20px", padding:"18px 22px", marginBottom:"16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div><div style={{ fontSize:"13px", fontWeight:800, color:"#00a87c", marginBottom:"4px" }}>Luma remembers you</div><div style={{ fontSize:"14px", fontWeight:500, color:"rgba(26,26,26,0.5)" }}>{conversations.length} past conversation{conversations.length!==1?"s":""} saved locally</div></div>
                <button onClick={()=>setShowMemory(true)} style={{ padding:"8px 16px", background:"rgba(0,200,150,0.12)", border:"0.5px solid rgba(0,200,150,0.2)", borderRadius:"12px", color:"#00a87c", fontSize:"13px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>View</button>
              </div>
            )}
            {[
              { key:"name", label:"Your Name", placeholder:"e.g. Deandre" },
              { key:"career", label:"Career and Role", placeholder:"e.g. QA Engineer, bioengineering background" },
              { key:"interests", label:"Hobbies and Interests", placeholder:"e.g. music production, photography, cooking" },
              { key:"goals", label:"What you need most from Luma", placeholder:"e.g. staying organized, managing anxiety" },
              { key:"hardDay", label:"What a hard day looks like", placeholder:"e.g. I can't get started, I feel frozen" },
              { key:"location", label:"Location", placeholder:"e.g. San Jose, CA" }
            ].map((field,i)=>(
              <div key={field.key} className="card" style={{ borderRadius:"22px", padding:"22px 24px", marginBottom:"10px", animation:`fadeUp 0.5s ease ${i*0.06+0.1}s both` }}>
                <div className="pill-label" style={{ marginBottom:"12px" }}>{field.label}</div>
                {editingProfile?<input value={profileDraft[field.key]||""} onChange={e=>setProfileDraft(p=>({...p,[field.key]:e.target.value}))} placeholder={field.placeholder} style={{ width:"100%", background:"rgba(245,242,238,0.8)", border:"0.5px solid rgba(26,26,26,0.1)", borderRadius:"14px", padding:"12px 16px", color:"#1a1a1a", fontSize:"16px", fontFamily:"'Nunito',sans-serif", fontWeight:600 }}/>:<div style={{ fontSize:"17px", fontWeight:600, color:profile[field.key]?"#1a1a1a":"rgba(26,26,26,0.22)" }}>{profile[field.key]||`Add your ${field.label.toLowerCase()}…`}</div>}
              </div>
            ))}
            <div className="card" style={{ borderRadius:"22px", padding:"22px 24px", marginBottom:"10px" }}>
              <div className="pill-label" style={{ marginBottom:"12px" }}>Condition or Challenge</div>
              {editingProfile?(
                <select value={profileDraft.condition||"none"} onChange={e=>setProfileDraft(p=>({...p,condition:e.target.value}))} style={{ width:"100%", background:"rgba(245,242,238,0.8)", border:"0.5px solid rgba(26,26,26,0.1)", borderRadius:"14px", padding:"12px 16px", color:"#1a1a1a", fontSize:"16px", fontFamily:"'Nunito',sans-serif", fontWeight:600, appearance:"none" }}>
                  <option value="none">None or prefer not to say</option>
                  <option value="adhd">ADHD</option>
                  <option value="anxiety">Anxiety</option>
                  <option value="depression">Depression</option>
                  <option value="autism">Autism / Asperger's</option>
                  <option value="executive_dysfunction">Executive Dysfunction</option>
                  <option value="ptsd">PTSD</option>
                  <option value="general">Something else</option>
                </select>
              ):<div style={{ fontSize:"17px", fontWeight:600, color:profile.condition&&profile.condition!=="none"?conditionColors[profile.condition]:"rgba(26,26,26,0.22)" }}>{profile.condition&&profile.condition!=="none"?conditionLabels[profile.condition]:"Not set — always optional"}</div>}
              <div style={{ fontSize:"13px", fontWeight:500, color:"rgba(26,26,26,0.3)", marginTop:"10px", lineHeight:1.5 }}>Helps Luma adapt its communication style. 100% private — never leaves your device.</div>
            </div>
            <div className="card" style={{ borderRadius:"22px", padding:"24px", marginBottom:"10px" }}>
              <div style={{ fontSize:"17px", fontWeight:800, color:"rgba(26,26,26,0.65)", marginBottom:"10px" }}>Luma knows you</div>
              <div style={{ fontSize:"15px", fontWeight:500, color:"rgba(26,26,26,0.38)", lineHeight:1.65, marginBottom:"20px" }}>The more you share, the more Luma adapts to your pace, your style, and exactly what you need.</div>
              <button onClick={()=>sendMessage("Based on my profile and our past conversations, what are the most helpful things you can do for me right now? Be specific and gentle.")} style={{ padding:"13px 22px", background:"linear-gradient(135deg,#00c896,#0ea5e9)", border:"none", borderRadius:"16px", color:"#fff", fontSize:"15px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Ask Luma for personalized advice</button>
            </div>
            <div className="card" style={{ borderRadius:"22px", padding:"24px", marginBottom:"10px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"6px" }}>
                <div style={{ fontSize:"17px", fontWeight:800, color:"rgba(26,26,26,0.65)" }}>Notifications</div>
                <button onClick={async()=>{ if(notifPermission!=="granted"){const p=await Notification.requestPermission();setNotifPermission(p);} setShowNotifSettings(s=>!s); }} style={{ padding:"8px 16px", background:"rgba(26,26,26,0.05)", border:"0.5px solid rgba(26,26,26,0.09)", borderRadius:"12px", color:"rgba(26,26,26,0.5)", fontSize:"13px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>{showNotifSettings?"Done":"Configure"}</button>
              </div>
              <div style={{ fontSize:"14px", fontWeight:500, color:"rgba(26,26,26,0.38)", lineHeight:1.6, marginBottom:showNotifSettings?"20px":"0" }}>{notifPermission==="granted"?"Notifications are enabled.":notifPermission==="denied"?"Notifications are blocked — enable them in your browser settings.":"Enable notifications to get reminders and check-ins from Luma."}</div>
              {showNotifSettings&&(
                <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"12px 16px", background:notifPermission==="granted"?"rgba(0,200,150,0.06)":"rgba(255,149,0,0.06)", border:`0.5px solid ${notifPermission==="granted"?"rgba(0,200,150,0.15)":"rgba(255,149,0,0.15)"}`, borderRadius:"14px" }}>
                    <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:notifPermission==="granted"?"#00c896":"#ff9500", flexShrink:0 }} />
                    <span style={{ fontSize:"14px", fontWeight:700, color:notifPermission==="granted"?"#00a87c":"#cc7a00" }}>{notifPermission==="granted"?"Permission granted — notifications active":notifPermission==="denied"?"Permission denied — check browser settings":"Permission not yet requested"}</span>
                    {notifPermission!=="granted"&&notifPermission!=="denied"&&<button onClick={async()=>{const p=await Notification.requestPermission();setNotifPermission(p);}} style={{ marginLeft:"auto", padding:"6px 12px", background:"linear-gradient(135deg,#00c896,#0ea5e9)", border:"none", borderRadius:"8px", color:"#fff", fontSize:"12px", fontWeight:800, cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Enable</button>}
                  </div>
                  {[
                    { key:"briefing", title:"Morning Briefing", desc:"Daily reminder to open Luma and start your day", hasTime:true, timeKey:"briefingTime", defaultTime:"08:00", onToggle:(e)=>{ setNotifSettings(p=>({...p,briefingEnabled:e})); if(e&&notifSettings.briefingTime)scheduleDailyBriefingNotif(notifSettings.briefingTime,profile.name); } },
                  ].map(item=>(
                    <div key={item.key} style={{ background:"rgba(245,242,238,0.8)", borderRadius:"16px", padding:"16px 18px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:notifSettings[`${item.key}Enabled`]&&item.hasTime?"14px":"0" }}>
                        <div><div style={{ fontSize:"15px", fontWeight:800, color:"#1a1a1a", marginBottom:"2px" }}>{item.title}</div><div style={{ fontSize:"12px", fontWeight:500, color:"rgba(26,26,26,0.4)" }}>{item.desc}</div></div>
                        <div className="toggle" style={{ background:notifSettings[`${item.key}Enabled`]?"linear-gradient(135deg,#00c896,#0ea5e9)":"rgba(26,26,26,0.12)" }} onClick={()=>item.onToggle(!notifSettings[`${item.key}Enabled`])}>
                          <div className="toggle-knob" style={{ left:notifSettings[`${item.key}Enabled`]?"21px":"3px" }} />
                        </div>
                      </div>
                      {notifSettings[`${item.key}Enabled`]&&item.hasTime&&(
                        <div><label className="field-label">Notify me at</label><input type="time" value={notifSettings[item.timeKey]||item.defaultTime} onChange={e=>{setNotifSettings(p=>({...p,[item.timeKey]:e.target.value}));if(notifSettings[`${item.key}Enabled`])scheduleDailyBriefingNotif(e.target.value,profile.name);}} style={{ background:"rgba(255,255,255,0.9)", border:"0.5px solid rgba(26,26,26,0.1)", borderRadius:"10px", padding:"9px 12px", color:"#1a1a1a", fontSize:"15px", fontFamily:"'Nunito',sans-serif", fontWeight:600 }} /></div>
                      )}
                    </div>
                  ))}
                  <div style={{ background:"rgba(245,242,238,0.8)", borderRadius:"16px", padding:"16px 18px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:notifSettings.checkInEnabled?"14px":"0" }}>
                      <div><div style={{ fontSize:"15px", fontWeight:800, color:"#1a1a1a", marginBottom:"2px" }}>Gentle Check-in</div><div style={{ fontSize:"12px", fontWeight:500, color:"rgba(26,26,26,0.4)" }}>Luma checks in with you once a day</div></div>
                      <div className="toggle" style={{ background:notifSettings.checkInEnabled?"linear-gradient(135deg,#00c896,#0ea5e9)":"rgba(26,26,26,0.12)" }} onClick={()=>{const e=!notifSettings.checkInEnabled;setNotifSettings(p=>({...p,checkInEnabled:e}));if(e&&notifSettings.checkInHour)scheduleCheckIn(parseInt(notifSettings.checkInHour),profile.name);}}>
                        <div className="toggle-knob" style={{ left:notifSettings.checkInEnabled?"21px":"3px" }} />
                      </div>
                    </div>
                    {notifSettings.checkInEnabled&&(<div><label className="field-label">Check in at</label><select value={notifSettings.checkInHour||"14"} onChange={e=>{setNotifSettings(p=>({...p,checkInHour:e.target.value}));if(notifSettings.checkInEnabled)scheduleCheckIn(parseInt(e.target.value),profile.name);}} style={{ background:"rgba(255,255,255,0.9)", border:"0.5px solid rgba(26,26,26,0.1)", borderRadius:"10px", padding:"9px 12px", color:"#1a1a1a", fontSize:"15px", fontFamily:"'Nunito',sans-serif", fontWeight:600, appearance:"none", cursor:"pointer" }}>{[{value:"9",label:"9:00 AM"},{value:"11",label:"11:00 AM"},{value:"13",label:"1:00 PM"},{value:"14",label:"2:00 PM"},{value:"16",label:"4:00 PM"},{value:"18",label:"6:00 PM"},{value:"20",label:"8:00 PM"}].map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>)}
                  </div>
                  <div style={{ background:"rgba(245,242,238,0.8)", borderRadius:"16px", padding:"16px 18px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div><div style={{ fontSize:"15px", fontWeight:800, color:"#1a1a1a", marginBottom:"2px" }}>Task Reminders</div><div style={{ fontSize:"12px", fontWeight:500, color:"rgba(26,26,26,0.4)" }}>Notifications for individual task reminder times</div></div>
                      <div className="toggle" style={{ background:notifSettings.taskRemindersEnabled!==false?"linear-gradient(135deg,#00c896,#0ea5e9)":"rgba(26,26,26,0.12)" }} onClick={()=>setNotifSettings(p=>({...p,taskRemindersEnabled:p.taskRemindersEnabled===false}))}>
                        <div className="toggle-knob" style={{ left:notifSettings.taskRemindersEnabled!==false?"21px":"3px" }} />
                      </div>
                    </div>
                  </div>
                  <button onClick={()=>{ if(notifPermission==="granted") new Notification("Hey from Luma!",{body:`Just making sure notifications are working${profile.name?`, ${profile.name}`:""}!`,icon:"/favicon.ico",tag:"luma-test"}); }} style={{ padding:"12px", background:"rgba(26,26,26,0.04)", border:"0.5px solid rgba(26,26,26,0.08)", borderRadius:"14px", color:"rgba(26,26,26,0.45)", fontSize:"14px", fontWeight:700, cursor:"pointer", fontFamily:"'Nunito',sans-serif", width:"100%", transition:"all 0.2s" }}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(26,26,26,0.08)";e.currentTarget.style.color="rgba(26,26,26,0.7)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(26,26,26,0.04)";e.currentTarget.style.color="rgba(26,26,26,0.45)";}}>Send a test notification</button>
                </div>
              )}
            </div>
            <div style={{ textAlign:"center", marginTop:"24px", paddingBottom:"8px" }}>
              <button onClick={()=>{setShowOnboarding(true);setOnboardingStep(0);setOnboardingInput("");setOnboardingData({});}} style={{ fontSize:"13px", fontWeight:700, color:"rgba(26,26,26,0.22)", background:"none", border:"none", cursor:"pointer", fontFamily:"'Nunito',sans-serif" }}>Redo onboarding</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}