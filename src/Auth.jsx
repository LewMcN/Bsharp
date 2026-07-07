import React, { useState } from "react";
import { LogIn, UserPlus, Guitar, AlertTriangle, MailCheck } from "lucide-react";
import { supabase, isConfigured } from "./lib/supabase";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export default function Auth({ onGuest }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!email || !password) return setError("Email and password are required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (mode === "signup" && !USERNAME_RE.test(username))
      return setError("Username: 3–24 letters, numbers or underscores.");

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username } },
        });
        if (err) setError(err.message);
        else if (!data.session)
          setNotice("Account created — check your email to confirm, then sign in.");
        // if a session was returned (email confirmation disabled), the
        // auth listener in App takes over automatically
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) setError(err.message);
      }
    } catch (e) {
      setError("Something went wrong — try again.");
    }
    setBusy(false);
  };

  const field =
    "w-full bg-black/50 border border-white/10 rounded-lg px-3.5 py-3 text-sm text-white " +
    "outline-none focus:border-cyan-400/50 mono placeholder:text-zinc-600";

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 text-zinc-200"
      style={{
        fontFamily: "'DM Sans',ui-sans-serif,system-ui,sans-serif",
        background:
          "radial-gradient(900px 600px at 12% -5%,rgba(34,227,216,0.10),transparent 60%)," +
          "radial-gradient(900px 700px at 95% 0%,rgba(124,108,255,0.12),transparent 55%),#08080b",
      }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .display{font-family:'Bricolage Grotesque',ui-sans-serif,sans-serif;}
        .mono{font-family:'JetBrains Mono',ui-monospace,monospace;}
        .bs-up{animation:bsu .5s cubic-bezier(.2,.8,.2,1) both;}
        @keyframes bsu{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
      `}</style>

      <div className="w-full max-w-sm bs-up">
        {/* logo */}
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center display font-extrabold text-2xl text-black"
            style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)",
              boxShadow: "0 0 28px rgba(124,108,255,0.5)" }}>
            B<span style={{ fontSize: 14, marginLeft: -1 }}>♯</span>
          </div>
          <div>
            <h1 className="display font-extrabold text-2xl leading-none tracking-tight">B SHARP</h1>
            <p className="mono text-[10px] tracking-[0.22em] text-zinc-500 mt-1">FRETBOARD INTELLIGENCE</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
          {!isConfigured ? (
            <div className="text-sm text-zinc-300 space-y-3">
              <div className="flex items-center gap-2 text-orange-300">
                <AlertTriangle size={15} />
                <span className="mono text-[11px] tracking-widest">BACKEND NOT CONFIGURED</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Accounts need Supabase keys — see the README for the 5-minute setup.
                You can still play as a guest; progress saves to this device only.
              </p>
            </div>
          ) : (
            <>
              {/* mode toggle */}
              <div className="flex rounded-xl bg-black/40 border border-white/10 p-1 gap-1 mb-4">
                {[["signin", "Sign in", LogIn], ["signup", "Create account", UserPlus]].map(([v, l, Icon]) => (
                  <button key={v} onClick={() => { setMode(v); setError(null); setNotice(null); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 mono text-xs px-3 py-2.5 rounded-lg transition-colors ${
                      mode === v ? "text-black font-bold" : "text-zinc-400 hover:text-white"
                    }`}
                    style={mode === v ? { background: "linear-gradient(135deg,#22e3d8,#7c6cff)" } : {}}>
                    <Icon size={13} /> {l}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <input className={field} type="email" placeholder="email" value={email}
                  autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
                {mode === "signup" && (
                  <input className={field} type="text" placeholder="username" value={username}
                    autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
                )}
                <input className={field} type="password"
                  placeholder={mode === "signup" ? "password (6+ characters)" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !busy && submit()} />
              </div>

              {error && (
                <p className="mono text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2 mt-3">
                  {error}
                </p>
              )}
              {notice && (
                <p className="flex items-start gap-2 mono text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-3 py-2 mt-3">
                  <MailCheck size={13} className="mt-0.5 shrink-0" /> {notice}
                </p>
              )}

              <button onClick={submit} disabled={busy}
                className="w-full mt-4 display font-bold text-sm py-3 rounded-xl text-black disabled:opacity-50 transition-opacity"
                style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)",
                  boxShadow: "0 0 22px rgba(124,108,255,0.3)" }}>
                {busy ? "Working..." : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </>
          )}

          <button onClick={onGuest}
            className="w-full mt-3 flex items-center justify-center gap-2 mono text-xs py-3 rounded-xl border border-white/10 text-zinc-400 hover:text-white transition-colors">
            <Guitar size={13} /> Continue as guest
          </button>
          <p className="mono text-[10px] text-zinc-600 mt-3 text-center">
            {isConfigured
              ? "Signed-in progress syncs across devices · guest progress stays on this device"
              : "Guest progress stays on this device"}
          </p>
        </div>
      </div>
    </div>
  );
}
