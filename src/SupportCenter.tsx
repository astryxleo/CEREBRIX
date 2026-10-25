import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Activity, AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Clock3, ImagePlus, LifeBuoy, LogOut, MessageSquareText, Paperclip, RefreshCw, Search, Send, ShieldCheck, Sparkles, Ticket, UploadCloud, X } from "lucide-react";
import { supabase } from "./lib/supabase";

type SupportRole = "student" | "teacher";
type TicketStatus = "open" | "in_progress" | "waiting_for_user" | "resolved" | "closed";
type SupportTicket = {
  id: string;
  requester_id: string;
  requester_email: string;
  requester_name: string;
  requester_role: SupportRole;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  subject: string;
  message: string;
  attachment_paths: string[];
  status: TicketStatus;
  admin_reply: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};
type SignedAttachment = { path: string; url: string; name: string };

const categories = ["Account & login", "Assessment / submission", "Grades & feedback", "Technical issue", "Classroom / roster", "Other"];
const statusLabels: Record<TicketStatus, string> = { open: "Open", in_progress: "In progress", waiting_for_user: "Waiting for user", resolved: "Resolved", closed: "Closed" };
const priorityLabels = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const errorText = (value: unknown) => value instanceof Error ? value.message : "Something went wrong. Please try again.";

export function SupportTicketForm({ user, profile, onClose }: {
  user: { id: string; email?: string };
  profile: { display_name: string; role: SupportRole };
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  const loadOwnTickets = useCallback(async () => {
    if (!supabase) return;
    setLoadingTickets(true);
    const { data, error: loadError } = await supabase.from("support_tickets").select("*").eq("requester_id", user.id).order("created_at", { ascending: false }).limit(10);
    if (!loadError) setTickets((data ?? []) as SupportTicket[]);
    setLoadingTickets(false);
  }, [user.id]);

  useEffect(() => { void loadOwnTickets(); }, [loadOwnTickets]);
  const onChooseFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    const combined = [...files, ...selected];
    if (combined.length > 5) { setError("You can attach up to 5 screenshots."); event.target.value = ""; return; }
    if (combined.some(file => !["image/png", "image/jpeg", "image/webp"].includes(file.type))) { setError("Please attach PNG, JPG, or WebP screenshots only."); event.target.value = ""; return; }
    if (combined.some(file => file.size > 5 * 1024 * 1024)) { setError("Each screenshot must be 5 MB or smaller."); event.target.value = ""; return; }
    setError("");
    setFiles(combined);
    event.target.value = "";
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) { setError("Support is temporarily unavailable. Please try again later."); return; }
    if (subject.trim().length < 4 || message.trim().length < 10) { setError("Add a clear subject and at least 10 characters describing the issue."); return; }
    setBusy(true); setError(""); setSuccess("");
    const uploaded: string[] = [];
    try {
      for (const file of files) {
        const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80) || "screenshot.png";
        const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("support-screenshots").upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        uploaded.push(path);
      }
      const { error: insertError } = await supabase.from("support_tickets").insert({
        requester_id: user.id,
        requester_email: user.email ?? "",
        requester_name: profile.display_name || user.email || "CEREBRIX user",
        requester_role: profile.role,
        category, priority, subject: subject.trim(), message: message.trim(), attachment_paths: uploaded
      });
      if (insertError) throw insertError;
      setSuccess("Your support request has been sent securely. The administrator can now review it.");
      setSubject(""); setMessage(""); setCategory(categories[0]); setPriority("normal"); setFiles([]);
      await loadOwnTickets();
    } catch (cause) {
      if (uploaded.length) await supabase.storage.from("support-screenshots").remove(uploaded);
      setError(errorText(cause));
    } finally { setBusy(false); }
  };

  return <div className="support-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="support-form-modal" role="dialog" aria-modal="true" aria-labelledby="support-form-title">
      <header className="support-form-head"><div className="support-icon"><LifeBuoy size={23}/></div><div className="support-head-copy"><span className="panel-kicker">CEREBRIX / DIRECT SUPPORT</span><h2 id="support-form-title">Tell the administrator<span>.</span></h2><p>Describe what happened. Screenshots are optional, but they can help pinpoint the issue faster.</p></div><button className="icon-btn" onClick={onClose} aria-label="Close support form"><X size={18}/></button></header>
      <div className="support-form-scroll">
        <form className="support-ticket-form" onSubmit={submit}>
          <div className="support-form-grid">
            <label>Issue category<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
            <label>Priority<select value={priority} onChange={e => setPriority(e.target.value as typeof priority)}><option value="low">Low — general question</option><option value="normal">Normal — need help</option><option value="high">High — blocking my work</option><option value="urgent">Urgent — cannot continue</option></select></label>
          </div>
          <label>Subject<input value={subject} onChange={e => setSubject(e.target.value)} maxLength={140} minLength={4} placeholder="e.g. My assessment submission is missing" required/></label>
          <label>What happened?<textarea value={message} onChange={e => setMessage(e.target.value)} minLength={10} maxLength={6000} rows={5} placeholder="Tell us what you were doing, what you expected, and what happened instead. Include the assessment name or page if relevant." required/><span className="support-char-count">{message.length}/6000</span></label>
          <div className="support-upload-area"><div className="support-upload-copy"><ImagePlus size={19}/><div><strong>Screenshots <span>OPTIONAL</span></strong><p>Up to 5 images · PNG, JPG or WebP · 5 MB each</p></div></div><label className="support-upload-button"><UploadCloud size={16}/> Add screenshots<input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onChooseFiles} disabled={files.length >= 5}/></label>
            {files.length > 0 && <div className="support-file-list">{files.map((file, index) => <div key={file.name + file.lastModified + index} className="support-file-chip"><Paperclip size={14}/><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small><button type="button" onClick={() => setFiles(current => current.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}><X size={14}/></button></div>)}</div>}
          </div>
          {error && <div className="support-message error" role="alert"><AlertCircle size={16}/>{error}</div>}
          {success && <div className="support-message success" role="status"><CheckCircle2 size={16}/>{success}</div>}
          <div className="support-submit-row"><span><ShieldCheck size={15}/> Private to you and the designated administrator</span><button type="submit" className="primary-btn" disabled={busy}>{busy ? <><RefreshCw className="support-spin" size={15}/> Sending…</> : <>Send request <Send size={15}/></>}</button></div>
        </form>
        <section className="support-my-tickets"><div className="support-section-title"><div><span className="panel-kicker">YOUR REQUESTS</span><h3>Recent support history</h3></div><button className="support-refresh" onClick={() => void loadOwnTickets()}><RefreshCw size={14}/> Refresh</button></div>
          {loadingTickets ? <div className="support-empty"><Activity size={18}/> Loading your requests…</div> : tickets.length === 0 ? <div className="support-empty"><Ticket size={20}/><strong>No requests yet</strong><span>Once you contact support, your request status and any reply will appear here.</span></div> : tickets.map(ticket => <article className="support-own-ticket" key={ticket.id}><div className="support-own-ticket-top"><span className={`support-status status-${ticket.status}`}>{statusLabels[ticket.status]}</span><time>{dateLabel(ticket.created_at)}</time></div><strong>{ticket.subject}</strong><p>{ticket.message}</p>{ticket.admin_reply && <div className="support-admin-reply"><span><ShieldCheck size={14}/> Administrator reply</span><p>{ticket.admin_reply}</p></div>}</article>)}
        </section>
      </div>
    </section>
  </div>;
}

export function AdminSupportDashboard({ user, profile, signOut }: {
  user: { id: string; email?: string };
  profile: { display_name: string; role: "admin" };
  signOut: () => Promise<void>;
}) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [nextStatus, setNextStatus] = useState<TicketStatus>("in_progress");
  const [nextPriority, setNextPriority] = useState<SupportTicket["priority"]>("normal");
  const [attachments, setAttachments] = useState<SignedAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");

  const loadTickets = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data, error: loadError } = await supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(500);
    if (loadError) setError(loadError.message);
    else { setTickets((data ?? []) as SupportTicket[]); setError(""); }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadTickets();
    if (!supabase) return;
    const channel = supabase.channel("cerebrix-support-admin-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => { void loadTickets(); })
      .subscribe();
    return () => { void supabase!.removeChannel(channel); };
  }, [loadTickets]);

  const counts = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    active: tickets.filter(t => t.status === "in_progress" || t.status === "waiting_for_user").length,
    resolved: tickets.filter(t => t.status === "resolved" || t.status === "closed").length,
    urgent: tickets.filter(t => t.priority === "urgent" && !["resolved", "closed"].includes(t.status)).length
  }), [tickets]);
  const visible = useMemo(() => tickets.filter(ticket => (filter === "all" || ticket.status === filter) && (ticket.subject + " " + ticket.message + " " + ticket.requester_name + " " + ticket.requester_email + " " + ticket.category).toLowerCase().includes(search.toLowerCase())), [tickets, filter, search]);
  const selected = tickets.find(ticket => ticket.id === selectedId) ?? null;

  useEffect(() => {
    setReply(selected?.admin_reply ?? "");
    setNextStatus(selected?.status === "open" ? "in_progress" : selected?.status ?? "in_progress");
    setNextPriority(selected?.priority ?? "normal");
    setSavedNotice("");
    setError("");
  }, [selectedId]);

  useEffect(() => {
    let alive = true;
    const makeUrls = async () => {
      if (!selected || !supabase || !selected.attachment_paths?.length) { setAttachments([]); return; }
      const rows = await Promise.all(selected.attachment_paths.map(async path => {
        const { data, error: signedError } = await supabase!.storage.from("support-screenshots").createSignedUrl(path, 3600);
        return !signedError && data ? { path, url: data.signedUrl, name: path.split("/").pop() ?? "Screenshot" } : null;
      }));
      if (alive) setAttachments(rows.filter((item): item is SignedAttachment => Boolean(item)));
    };
    void makeUrls();
    return () => { alive = false; };
  }, [selectedId, selected?.attachment_paths?.join("|")]);

  const saveTicket = async () => {
    if (!supabase || !selected) return;
    setSaving(true); setError(""); setSavedNotice("");
    const isResolved = nextStatus === "resolved" || nextStatus === "closed";
    const { error: saveError } = await supabase.from("support_tickets").update({
      admin_reply: reply.trim(), status: nextStatus, priority: nextPriority,
      updated_at: new Date().toISOString(), resolved_at: isResolved ? new Date().toISOString() : null
    }).eq("id", selected.id);
    if (saveError) setError(saveError.message);
    else { setSavedNotice("Ticket updated. The requester will see your reply in their support history."); await loadTickets(); }
    setSaving(false);
  };

  return <main className="support-admin-shell">
    <aside className="support-admin-sidebar"><div className="support-admin-brand"><div className="support-icon"><LifeBuoy size={23}/></div><div><strong>CEREBRIX</strong><span>ADMIN CONSOLE</span></div></div><div className="support-admin-label">ADMINISTRATOR</div><div className="support-admin-identity"><div className="support-admin-avatar">{(profile.display_name || "L").slice(0,1).toUpperCase()}</div><div><strong>{profile.display_name || "Administrator"}</strong><span>{user.email}</span></div><ShieldCheck size={16}/></div><div className="support-admin-secure"><ShieldCheck size={17}/><span>Restricted support inbox<br/><strong>Administrator-only access</strong></span></div><div className="support-admin-sidebar-bottom"><span><i/> Secure session active</span><button onClick={() => void signOut()}><LogOut size={16}/> Sign out</button></div></aside>
    <section className="support-admin-main"><header className="support-admin-topbar"><div><span className="panel-kicker">CEREBRIX / OPERATIONS</span><h1>Support command centre<span>.</span></h1><p>One private inbox for student and teacher issues, screenshots, and follow-up.</p></div><button className="support-refresh" onClick={() => void loadTickets()}><RefreshCw size={15}/> Refresh inbox</button></header>
      {error && <div className="support-message error"><AlertCircle size={16}/>{error}</div>}
      <div className="support-admin-metrics">
        <article><span><Ticket size={17}/> Total requests</span><strong>{counts.total}</strong><small>All submitted tickets</small></article>
        <article><span><Clock3 size={17}/> Open queue</span><strong>{counts.open}</strong><small>Awaiting first review</small></article>
        <article><span><Activity size={17}/> In progress</span><strong>{counts.active}</strong><small>Being worked on</small></article>
        <article><span><CheckCircle2 size={17}/> Resolved</span><strong>{counts.resolved}</strong><small>Resolved or closed</small></article>
        <article className={counts.urgent ? "urgent-metric" : ""}><span><AlertCircle size={17}/> Urgent</span><strong>{counts.urgent}</strong><small>High attention needed</small></article>
      </div>
      <div className="support-admin-workspace"><section className="support-inbox-panel"><div className="support-inbox-head"><div><span className="panel-kicker">REQUEST MANAGEMENT</span><h2>Support inbox</h2></div><span className="support-total-pill">{visible.length} tickets</span></div><div className="support-inbox-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, subject…"/></div><div className="support-status-filters">{(["all","open","in_progress","waiting_for_user","resolved","closed"] as const).map(status => <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{status === "all" ? "All" : statusLabels[status]}</button>)}</div>
        <div className="support-inbox-list">{loading ? <div className="support-empty"><Activity size={20}/> Loading support requests…</div> : visible.length === 0 ? <div className="support-empty"><MessageSquareText size={22}/><strong>No matching requests</strong><span>New student and teacher requests will appear here automatically.</span></div> : visible.map(ticket => <button key={ticket.id} className={`support-inbox-ticket ${selectedId === ticket.id ? "selected" : ""}`} onClick={() => setSelectedId(ticket.id)}><div className="support-inbox-ticket-top"><span className={`support-status status-${ticket.status}`}>{statusLabels[ticket.status]}</span><span className={`support-priority priority-${ticket.priority}`}>{priorityLabels[ticket.priority]}</span></div><strong>{ticket.subject}</strong><p>{ticket.message}</p><div className="support-inbox-ticket-meta"><span className="support-role-pill">{ticket.requester_role}</span><span>{ticket.requester_name}</span><time>{dateLabel(ticket.created_at)}</time></div><div className="support-inbox-ticket-bottom"><span>{ticket.category}</span><span>{ticket.attachment_paths?.length ? <><Paperclip size={12}/> {ticket.attachment_paths.length} screenshot(s)</> : "No attachments"}</span></div></button>)}</div></section>
        <section className="support-ticket-detail">{selected ? <><div className="support-detail-head"><div><span className="panel-kicker">TICKET / {selected.id.slice(0,8).toUpperCase()}</span><h2>{selected.subject}</h2><p>Submitted {dateLabel(selected.created_at)} · Updated {dateLabel(selected.updated_at)}</p></div><span className={`support-status status-${selected.status}`}>{statusLabels[selected.status]}</span></div><div className="support-requester-card"><div className="support-requester-avatar">{(selected.requester_name || "?").slice(0,1).toUpperCase()}</div><div><strong>{selected.requester_name}</strong><span>{selected.requester_email}</span></div><span className="support-role-pill">{selected.requester_role}</span></div><div className="support-ticket-tags"><span>{selected.category}</span><span className={`support-priority priority-${selected.priority}`}>{priorityLabels[selected.priority]} priority</span></div><div className="support-ticket-message"><span>MESSAGE FROM REQUESTER</span><p>{selected.message}</p></div><div className="support-attachments"><div className="support-section-title"><div><span className="panel-kicker">EVIDENCE</span><h3>Screenshots <small>{attachments.length}</small></h3></div><Paperclip size={17}/></div>{attachments.length ? <div className="support-attachment-grid">{attachments.map(item => <a key={item.path} href={item.url} target="_blank" rel="noreferrer" title="Open private screenshot"><img src={item.url} alt={item.name}/><span>{item.name}</span></a>)}</div> : <div className="support-no-attachments"><ImagePlus size={18}/> No screenshots attached to this request.</div>}</div><div className="support-response-form"><label>Administrator response<textarea value={reply} onChange={e => setReply(e.target.value)} maxLength={6000} rows={5} placeholder="Write a helpful reply or resolution. This is visible to the requester in their support history."/></label><div className="support-response-grid"><label>Update status<select value={nextStatus} onChange={e => setNextStatus(e.target.value as TicketStatus)}>{Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Priority<select value={nextPriority} onChange={e => setNextPriority(e.target.value as SupportTicket["priority"])}>{Object.entries(priorityLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>{savedNotice && <div className="support-message success"><CheckCircle2 size={15}/>{savedNotice}</div>}<button className="primary-btn support-save-button" onClick={() => void saveTicket()} disabled={saving}>{saving ? "Saving…" : "Save response & status"} <ArrowRight size={15}/></button></div></> : <div className="support-detail-empty"><div className="support-icon"><MessageSquareText size={23}/></div><h2>Select a support request<span>.</span></h2><p>Choose a ticket from the inbox to inspect its message and screenshots, reply, and update the status.</p></div>}</section>
      </div>
      <footer className="support-admin-footer"><span><Sparkles size={14}/> CEREBRIX support operations</span><span>Private administrator workspace · Signed in as {user.email}</span></footer>
    </section>
  </main>;
}
