import { useEffect, useMemo, useState } from "react";
import { Copy, Download, GraduationCap, KeyRound, Mail, Plus, Search, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { supabase } from "./lib/supabase";

type Student = { id: string; name: string; email: string; className: string; addedAt: number; studentId?: string };
type Credentials = { name: string; studentId: string; password: string; email: string };
const storageKey = "cerebrix.teacher.students.v1";
function readStudents(): Student[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Student => !!item && typeof item === "object" && typeof (item as Student).id === "string" && typeof (item as Student).name === "string" && typeof (item as Student).email === "string" && typeof (item as Student).className === "string" && typeof (item as Student).addedAt === "number");
  } catch { return []; }
}
function makeStudentId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "CBX-" + Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
}
function makePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
}
export default function StudentDirectory({ teacherId }: { teacherId: string }) {
  const [students, setStudents] = useState<Student[]>(readStudents);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("Class 12");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(supabase));
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    const load = async () => {
      const { data, error: loadError } = await supabase!.from("class_roster")
        .select("id,student_id,display_name,email,class_name,added_at")
        .eq("teacher_id", teacherId).order("added_at", { ascending: false });
      if (!alive) return;
      if (loadError) setError("Could not load the shared roster. Confirm Teacher access and database permissions.");
      else setStudents((data ?? []).map((row: any) => ({ id: row.id, studentId: row.email?.startsWith("cbx-") ? row.email.split("@")[0].toUpperCase() : undefined, name: row.display_name, email: row.email, className: row.class_name, addedAt: new Date(row.added_at).getTime() })));
      setLoading(false);
    };
    void load();
    return () => { alive = false; };
  }, [teacherId]);
  useEffect(() => { if (!supabase) { try { localStorage.setItem(storageKey, JSON.stringify(students)); } catch { /* Browser storage can be unavailable. */ } } }, [students]);
  const filtered = useMemo(() => students.filter(student => (student.name + " " + student.email + " " + student.className + " " + (student.studentId ?? "")).toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => a.name.localeCompare(b.name)), [students, query]);
  const exportCsv = () => {
    const safe = (value: string) => { const first = value.trimStart().charAt(0); const cell = ["=", "+", "-", "@"].includes(first) ? "'" + value : value; return '"' + cell.replace(/"/g, '""') + '"'; };
    const rows = [["Name", "Student ID", "Login", "Class / section", "Added at"], ...students.map(student => [student.name, student.studentId ?? "", student.email, student.className, new Date(student.addedAt).toISOString()])];
    const csv = rows.map(row => row.map(safe).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = "cerebrix-students.csv"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const addStudent = async () => {
    const cleanName = name.trim();
    const cleanClass = className.trim() || "Unassigned";
    if (!cleanName) { setError("Enter the student's name."); return; }
    if (!supabase) { setError("Connect Supabase before creating real student accounts. Local preview entries are not login accounts."); return; }
    setCreating(true); setError(""); setCredentials(null);
    const studentId = makeStudentId();
    const password = makePassword();
    try {
      const { data, error: createError } = await supabase.functions.invoke("create-student-account", { body: { displayName: cleanName, className: cleanClass, studentId, password } });
      if (createError || data?.error) throw new Error(data?.error || createError?.message || "Student account could not be created.");
      const loginEmail = String(data.email || (studentId.toLowerCase() + "@students.cerebrix.app"));
      const student: Student = { id: String(data.rosterId), studentId, name: cleanName, email: loginEmail, className: cleanClass, addedAt: Date.now() };
      setStudents(current => [student, ...current]);
      setCredentials({ name: cleanName, studentId, password, email: loginEmail });
      setName(""); setClassName("Class 12"); setError(""); setShowForm(false); setCopied(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Student account could not be created. Check the Edge Function deployment and secrets.");
    } finally { setCreating(false); }
  };
  const removeStudent = async (student: Student) => {
    if (!supabase) { setStudents(current => current.filter(item => item.id !== student.id)); return; }
    const { error: deleteError } = await supabase.from("class_roster").delete().eq("id", student.id).eq("teacher_id", teacherId);
    if (deleteError) { setError("Student could not be removed from the shared roster."); return; }
    setStudents(current => current.filter(item => item.id !== student.id));
  };
  const copyCredentials = async () => {
    if (!credentials) return;
    const text = "CEREBRIX Student Login\nStudent: " + credentials.name + "\nStudent ID: " + credentials.studentId + "\nPassword: " + credentials.password + "\nLogin: " + window.location.origin;
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setError("Clipboard access was blocked. Select and copy the credentials manually."); }
  };
  return <section className="student-directory">
    <div className="student-exam-header"><div><span className="panel-kicker">CEREBRIX / CLASS ROSTER</span><h2>Student directory<span className="heading-period">.</span></h2><p>Create student login IDs and passwords, then track your classroom roster.</p></div><div className="directory-header-actions"><button className="secondary-btn" onClick={exportCsv} disabled={!students.length}><Download size={15}/> Export CSV</button><button className="primary-btn" onClick={() => { setShowForm(value => !value); setError(""); }}><Plus size={15}/>{showForm ? "Close form" : "Create student login"}</button></div></div>
    <div className="student-preview-banner"><ShieldCheck size={18}/><div><strong>{supabase ? "Teacher-managed student accounts" : "Supabase connection required"}</strong><p>{supabase ? "Accounts are created securely on the server. The temporary password is shown only after creation; copy it and share it privately with the student." : "Connect Supabase and deploy the create-student-account Edge Function before issuing real logins."}</p></div></div>
    <div className="directory-stats"><article><Users size={17}/><span>Total students</span><strong>{students.length}</strong></article><article><GraduationCap size={17}/><span>Classes represented</span><strong>{new Set(students.map(student => student.className.trim()).filter(Boolean)).size}</strong></article><article><KeyRound size={17}/><span>Accounts issued</span><strong>{students.filter(student => student.studentId || student.email).length}</strong></article></div>
    {credentials && <div className="panel student-credentials"><div className="notification-card-head"><div><div className="panel-kicker">ACCOUNT CREATED</div><h2>{credentials.name}<span className="heading-period">.</span></h2></div><button className="icon-btn" onClick={() => setCredentials(null)} aria-label="Close credentials"><X size={16}/></button></div><p className="credentials-warning">Copy these credentials now and share them privately. The temporary password is not saved for later viewing.</p><div className="credentials-grid"><div><span>STUDENT ID</span><strong>{credentials.studentId}</strong></div><div><span>TEMPORARY PASSWORD</span><strong>{credentials.password}</strong></div><div className="credentials-login"><span>LOGIN EMAIL</span><strong>{credentials.email}</strong></div></div><button className="primary-btn" onClick={() => void copyCredentials()}><Copy size={15}/>{copied ? "Credentials copied" : "Copy login details"}</button></div>}
    {showForm && <div className="panel directory-form"><div className="panel-header"><div><div className="panel-kicker">NEW STUDENT ACCOUNT</div><h2>Create login</h2></div><button className="icon-btn" onClick={() => setShowForm(false)} aria-label="Close form"><X size={17}/></button></div>{error && <div className="builder-error">{error}</div>}<div className="directory-fields"><label className="builder-field">Full name<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Student name" maxLength={100}/></label><label className="builder-field">Class / section<input value={className} onChange={event => setClassName(event.target.value)} placeholder="e.g. Class 12 · A" maxLength={80}/></label></div><div className="directory-form-actions"><button className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-btn" disabled={creating} onClick={() => void addStudent()}><Plus size={15}/>{creating ? "Creating secure account…" : "Create ID + password"}</button></div></div>}
    {error && !showForm && !credentials && <div className="builder-error">{error}</div>}
    <div className="directory-list-panel"><div className="directory-list-heading"><div><div className="panel-kicker">ROSTER</div><h2>Students <span>{filtered.length}</span></h2></div><label className="tests-search directory-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search students or IDs…"/></label></div>
    {loading ? <div className="student-empty"><div className="student-empty-icon"><Users size={25}/></div><h3>Loading roster</h3><p>Syncing your class directory…</p></div> : filtered.length ? <div className="directory-list">{filtered.map(student => <article className="directory-student" key={student.id}><div className="directory-avatar">{student.name.trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase()).join("")}</div><div className="directory-student-main"><strong>{student.name}</strong><span>{student.studentId || student.email || "Login not issued"}</span></div><span className="directory-class">{student.className}</span><button className="builder-icon-danger" onClick={() => void removeStudent(student)} aria-label={"Remove " + student.name}><Trash2 size={15}/></button></article>)}</div> : <div className="student-empty"><div className="student-empty-icon"><Users size={25}/></div><h3>{students.length ? "No students found" : "Your roster starts here"}</h3><p>{students.length ? "Try a different name, class, or student ID." : "Create your first student login to populate your class directory."}</p>{!students.length && <button className="primary-btn" onClick={() => setShowForm(true)}><Plus size={15}/> Create first student login</button>}</div>}
    </div>
  </section>;
}
