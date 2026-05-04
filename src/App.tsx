import { useState, useEffect, useRef } from "react";

export default function App() {
  const [screen, setScreen] = useState<"setup" | "timer" | "overlay">("setup");
  const [taskName, setTaskName] = useState("");
  const [focusMins, setFocusMins] = useState(20);
  const [breakMins, setBreakMins] = useState(10);
  const [phase, setPhase] = useState<"focus" | "break">("focus");
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [notifStatus, setNotifStatus] = useState("prompt");
  const [breakStarted, setBreakStarted] = useState(false);
  const tickRef = useRef<any>(null);
  const remainRef = useRef(0);
  const phaseRef = useRef<"focus" | "break">("focus");
  const focusMinsRef = useRef(20);
  const breakMinsRef = useRef(10);

  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission === "granted") setNotifStatus("granted");
      else if (Notification.permission === "denied") setNotifStatus("denied");
    } else setNotifStatus("unsupported");
    return () => clearInterval(tickRef.current);
  }, []);

  useEffect(() => { focusMinsRef.current = focusMins; }, [focusMins]);
  useEffect(() => { breakMinsRef.current = breakMins; }, [breakMins]);

  function fmt(s: number) {
    const m = Math.floor(s / 60), sec = s % 60;
    return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  }

  function playSound(type: "break" | "focus") {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = type === "break" ? [523, 659, 784] : [784, 659, 523];
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = "sine"; o.frequency.value = freq;
        const t = ctx.currentTime + i * 0.25;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.3, t + 0.05);
        g.gain.linearRampToValueAtTime(0, t + 0.35);
        o.start(t); o.stop(t + 0.4);
      });
    } catch (e) {}
  }

  function sendNotif(title: string, body: string) {
    if (Notification.permission === "granted") {
      try { new Notification(title, { body }); } catch (e) {}
    }
  }

  function requestNotif() {
    if (!("Notification" in window)) { setNotifStatus("unsupported"); return; }
    Notification.requestPermission().then(p => setNotifStatus(p));
  }

  function startTicker(rem: number, ph: "focus" | "break") {
    clearInterval(tickRef.current);
    remainRef.current = rem;
    phaseRef.current = ph;
    tickRef.current = setInterval(() => {
      remainRef.current--;
      setRemaining(remainRef.current);
      if (remainRef.current <= 0) {
        clearInterval(tickRef.current);
        if (phaseRef.current === "focus") {
          playSound("break");
          sendNotif("Time for a break! 🧘", "You focused for " + focusMinsRef.current + " min. Stand up and stretch.");
          setScreen("overlay");
          setBreakStarted(false);
        } else {
          setSessions(s => s + 1);
          playSound("focus");
          sendNotif("Break over — time to focus! 💪", "Start your next focus session.");
          const newRem = focusMinsRef.current * 60;
          setPhase("focus");
          setRemaining(newRem);
          setTotal(newRem);
          setScreen("timer");
          setPaused(false);
          startTicker(newRem, "focus");
        }
      }
    }, 1000);
  }

  function handleStart() {
    const rem = focusMins * 60;
    setPhase("focus");
    setRemaining(rem);
    setTotal(rem);
    setPaused(false);
    setScreen("timer");
    startTicker(rem, "focus");
  }

  function togglePause() {
    setPaused(p => {
      if (p) {
        startTicker(remainRef.current, phaseRef.current);
      } else {
        clearInterval(tickRef.current);
      }
      return !p;
    });
  }

  function resetTimer() {
    clearInterval(tickRef.current);
    const rem = (phaseRef.current === "focus" ? focusMinsRef.current : breakMinsRef.current) * 60;
    remainRef.current = rem;
    setRemaining(rem);
    setTotal(rem);
    setPaused(false);
    startTicker(rem, phaseRef.current);
  }

  function resetAll() {
    clearInterval(tickRef.current);
    setPaused(false);
    setSessions(0);
    setScreen("setup");
  }

  function handleStartBreak() {
    const rem = breakMins * 60;
    setPhase("break");
    setRemaining(rem);
    setTotal(rem);
    setBreakStarted(true);
    startTicker(rem, "break");
  }

  const pct = total > 0 ? (remaining / total) * 100 : 100;

  const nc =
    notifStatus === "granted" ? { bg: "#E1F5EE", color: "#0F6E56" } :
    notifStatus === "denied" || notifStatus === "unsupported" ? { bg: "#FCEBEB", color: "#A32D2D" } :
    { bg: "#EEEDFE", color: "#3C3489" };

  const notifLabel =
    notifStatus === "granted" ? "✅ Desktop notifications on" :
    notifStatus === "denied" ? "🔕 Notifications blocked — allow in browser settings" :
    notifStatus === "unsupported" ? "Notifications not supported" :
    "🔔 Enable desktop notifications";

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "1rem" }}>

        {/* SETUP */}
        {screen === "setup" && (
          <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 16, padding: "2rem 1.5rem" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111", textAlign: "center", marginBottom: "1.5rem", letterSpacing: "0.5px", wordSpacing: "4px"  }}>🎯 Focus Timer</h1>
            <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
              <span onClick={notifStatus === "prompt" ? requestNotif : undefined}
                style={{ display: "inline-block", fontSize: 12, padding: "5px 14px", borderRadius: 99, fontWeight: 600, cursor: notifStatus === "prompt" ? "pointer" : "default", background: nc.bg, color: nc.color }}>
                {notifLabel}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: "0.75rem" }}>What are you working on?</p>
            <input value={taskName} onChange={e => setTaskName(e.target.value)}
              placeholder="e.g. deep work, coding, reading..."
              style={{ width: "100%", padding: "10px 14px", fontSize: 15, border: "1px solid #ddd", borderRadius: 10, marginBottom: "1.25rem", color: "#111", background: "#fafafa", outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 12, marginBottom: "1.25rem" }}>
              {([["Focus (min)", focusMins, setFocusMins], ["Break (min)", breakMins, setBreakMins]] as const).map(([lbl, val, set]) => (
                <div key={lbl} style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>{lbl}</label>
                  <input type="number" value={val} min={1} max={120}
                    onChange={e => (set as (v: number) => void)(parseInt(e.target.value) || (val as number))}
                    style={{ width: "100%", padding: "8px 12px", fontSize: 15, border: "1px solid #ddd", borderRadius: 10, color: "#111", background: "#fafafa", outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <button onClick={handleStart}
              style={{ width: "100%", padding: 12, fontSize: 15, fontWeight: 700, borderRadius: 10, border: "none", background: "#534AB7", color: "#fff", cursor: "pointer" }}>
              Start focusing →
            </button>
          </div>
        )}

        {/* TIMER */}
        {screen === "timer" && (
          <div style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 16, padding: "2rem 1.5rem", textAlign: "center" }}>
            <span style={{ display: "inline-block", fontSize: 12, padding: "3px 12px", borderRadius: 99, fontWeight: 600, marginBottom: "1rem", background: phase === "focus" ? "#EEEDFE" : "#E1F5EE", color: phase === "focus" ? "#3C3489" : "#0F6E56" }}>
              {phase === "focus" ? "🎯 Focus" : "☕ Break"}
            </span>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>{taskName || "Focus session"}</p>
            <div style={{ fontSize: 72, fontWeight: 700, color: "#111", letterSpacing: 2, lineHeight: 1, margin: "0.5rem 0" }}>{fmt(remaining)}</div>
            <div style={{ background: "#f0f0f0", borderRadius: 99, height: 6, margin: "1rem 0 1.5rem", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 99, width: pct + "%", transition: "width 1s linear", background: phase === "focus" ? "#534AB7" : "#1D9E75" }} />
            </div>
            <button onClick={togglePause}
              style={{ width: "100%", padding: 11, fontSize: 15, fontWeight: 600, borderRadius: 10, border: "1.5px solid #534AB7", background: "#fff", color: "#534AB7", cursor: "pointer", marginBottom: 8 }}>
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: "0.5rem" }}>
              <button onClick={resetTimer} style={{ fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Reset timer</button>
              <button onClick={resetAll} style={{ fontSize: 13, color: "#888", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Reset all</button>
            </div>
            {sessions > 0 && <p style={{ fontSize: 13, color: "#aaa", marginTop: "0.75rem" }}>Sessions completed: {sessions}</p>}
          </div>
        )}

        {/* OVERLAY / BREAK */}
        {screen === "overlay" && (
          <div style={{ background: "#0f0f1e", borderRadius: 16, padding: "3rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 52, marginBottom: "1rem" }}>🧘</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
              {breakStarted ? "Enjoy your break" : "Time for a break!"}
            </div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", marginBottom: "1.5rem" }}>
              {breakStarted ? "Come back when the timer ends." : "Step away, stretch, and hydrate."}
            </div>
            {breakStarted && (
              <div style={{ fontSize: 60, fontWeight: 700, color: "#5DCAA5", marginBottom: "1.5rem" }}>{fmt(remaining)}</div>
            )}
            {!breakStarted && (
              <button onClick={handleStartBreak}
                style={{ padding: "13px 36px", fontSize: 15, fontWeight: 600, borderRadius: 10, border: "2px solid rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", marginBottom: 12 }}>
                Start {breakMins}-min break
              </button>
            )}
            <button onClick={resetAll} style={{ marginTop: "0.75rem", fontSize: 13, color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Reset all</button>
          </div>
        )}
      </div>
    </div>
  );
}