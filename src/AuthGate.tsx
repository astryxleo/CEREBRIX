import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Activity, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

type Profile = { id: string; display_name: string; role: "student" | "teacher"; avatar_url: string | null };
type Props = { children: (context: { user: User; profile: Profile; signOut: () => Promise<void> }) => ReactNode };

export default function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      if (!nextSession) setProfile(null);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) { setProfile(null); return; }
    let alive = true;
    const loadProfile = async () => {
      setChecking(true);
      const user = session.user;
      const { data, error: readError } = await supabase!.from("profiles")
        .select("id, display_name, role, avatar_url").eq("id", user.id).maybeSingle();
      if (!alive) return;
      if (readError) { setError("Could not load your profile. Please try again."); setChecking(false); return; }
      if (data) {
        setProfile(data as Profile);
      } else {
        const { data: created, error: createError } = await supabase!.from("profiles")
          .insert({ id: user.id, display_name: String(user.user_metadata?.display_name ?? ""), role: "student" })
          .select("id, display_name, role, avatar_url").single();
        if (!alive) return;
        if (createError) setError("Your account is signed in, but profile setup failed. Please refresh or contact the workspace operator.");
        else setProfile(created as Profile);
      }
      setChecking(false);
    };
    void loadProfile();
    return () => { alive = false; };
  }, [session?.user?.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) setMessage("Account created. Check your email to confirm it, then sign in.");
        else setMessage("Account created. Your initial workspace role is Student.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Please try again.");
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError("Sign out failed. Please retry.");
  };

  if (!isSupabaseConfigured || !supabase) return <main className="auth-shell"><section className="auth-card auth-config"><div className="auth-logo">C<span>B</span>X</div><span className="auth-kicker">BACKEND CONFIGURATION</span><h1>Connect your workspace<span>.</span></h1><p>CEREBRIX is ready for Supabase Auth. Add the two public client environment variables in your Vercel project to enable sign-in and shared accounts.</p><div className="auth-env"><code>VITE_SUPABASE_URL</code><code>https://hodszgdhayierbuyqcjx.supabase.co</code></div><div className="auth-env"><code>VITE_SUPABASE_PUBLISHABLE_KEY</code><code>Supabase Dashboard → Project Settings → API Keys</code></div><p className="auth-security"><ShieldCheck size={16}/> Use only the publishable key here. Never add a service-role or secret key to Vercel client variables.</p><a className="auth-link" href="https://supabase.com/dashboard/project/hodszgdhayierbuyqcjx/settings/api-keys" target="_blank" rel="noreferrer">Open Supabase API keys <ArrowRight size={15}/></a></section></main>;

  if (checking) return <main className="auth-shell"><div className="auth-loading"><Activity size={22}/><span>Securing your workspace…</span></div></main>;
  if (session && profile) return <>{children({ user: session.user, profile, signOut })}</>;
  if (session && !profile && !error) return <main className="auth-shell"><div className="auth-loading"><Activity size={22}/><span>Setting up your profile…</span></div></main>;

  return <main className="auth-shell"><section className="auth-card"><div className="auth-logo">CB<span>X</span></div><span className="auth-kicker">CEREBRIX / SECURE ACCESS</span><h1>{mode === "signin" ? "Welcome back" : "Create your account"}<span>.</span></h1><p>{mode === "signin" ? "Sign in to continue to your assessment workspace." : "Create a student account to get started."}</p>
    <form onSubmit={submit} className="auth-form">
      {mode === "signup" && <label><span>Display name</span><div className="auth-input"><UserRound size={16}/><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Your name" maxLength={100} required/></div></label>}
      <label><span>Email address</span><div className="auth-input"><Mail size={16}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required/></div></label>
      <label><span>Password</span><div className="auth-input"><LockKeyhole size={16}/><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="signin"?"current-password":"new-password"} minLength={8} placeholder="At least 8 characters" required/><button type="button" className="auth-eye" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Hide password":"Show password"}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
      {error&&<div className="auth-error" role="alert">{error}</div>}{message&&<div className="auth-message" role="status">{message}</div>}
      <button className="auth-submit" type="submit" disabled={busy}>{busy?"Please wait…":mode==="signin"?"Sign in securely":"Create student account"}<ArrowRight size={16}/></button>
    </form>
    <div className="auth-switch">{mode==="signin"?"New to CEREBRIX?":"Already have an account?"}<button onClick={()=>{setMode(v=>v==="signin"?"signup":"signin");setError("");setMessage("");}}>{mode==="signin"?"Create account":"Sign in"}</button></div>
    <div className="auth-foot"><ShieldCheck size={14}/> Teacher access is assigned by the workspace operator.</div>
  </section></main>;
}
