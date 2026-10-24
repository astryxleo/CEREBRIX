import { useEffect, useMemo, useState } from "react";
import { Download, GraduationCap, Mail, Plus, Search, Trash2, Users, X } from "lucide-react";

type Student = { id: string; name: string; email: string; className: string; addedAt: number };
const storageKey = "cerebrix.teacher.students.v1";
function readStudents(): Student[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Student => {
      if (!item || typeof item !== "object") return false;
      const student = item as Partial<Student>;
      return typeof student.id === "string"
        && typeof student.name === "string"
        && typeof student.email === "string"
        && typeof student.className === "string"
        && typeof student.addedAt === "number"
        && Number.isFinite(student.addedAt);
    });
  } catch { return []; }
}
export default function StudentDirectory() {
  const [students, setStudents] = useState<Student[]>(readStudents);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [className, setClassName] = useState("Class 12");
  const [error, setError] = useState("");
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(students)); } catch { /* Browser storage can be unavailable. */ } }, [students]);
  const filtered = useMemo(() => students.filter(student => (student.name + " " + student.email + " " + student.className).toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => a.name.localeCompare(b.name)), [students, query]);
  const exportCsv = () => {
    const escapeCell = (value: string) => {
      // Prevent spreadsheet formula execution from user-controlled roster fields.
      const safe = /^[\\t\\r\\n ]*[=+\\-@]/.test(value) ? "'" + value : value;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
    const rows = [["Name", "Email", "Class / section", "Added at"], ...students.map(student => [student.name, student.email, student.className, new Date(student.addedAt).toISOString()])];
    const csv = rows.map(row => row.map(escapeCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url; link.download = "cerebrix-students.csv"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const addStudent = () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName) { setError("Enter the student's name."); return; }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { setError("Enter a valid email address or leave it empty."); return; }
    if (cleanEmail && students.some(student => student.email.toLowerCase() === cleanEmail)) { setError("A student with this email is already in the local directory."); return; }
    setStudents(current => [{ id: crypto.randomUUID(), name: cleanName, email: cleanEmail, className: className.trim() || "Unassigned", addedAt: Date.now() }, ...current]);
    setName(""); setEmail(""); setClassName("Class 12"); setError(""); setShowForm(false);
  };
  return <section className="student-directory">
    <div className="student-exam-header"><div><span className="panel-kicker">CEREBRIX / CLASS ROSTER</span><h2>Student directory<span className="heading-period">.</span></h2><p>Maintain a simple roster for your classroom workspace.</p></div><div className="directory-header-actions"><button className="secondary-btn" onClick={exportCsv} disabled={!students.length}><Download size={15}/> Export CSV</button><button className="primary-btn" onClick={() => { setShowForm(value => !value); setError(""); }}><Plus size={15}/>{showForm ? "Close form" : "Add student"}</button></div></div>
    <div className="student-preview-banner"><Users size={18}/><div><strong>Local roster preview</strong><p>Student profiles are saved only in this browser. They are not invitations, authenticated accounts, or connected to exam submissions yet.</p></div></div>
    <div className="directory-stats"><article><Users size={17}/><span>Total students</span><strong>{students.length}</strong></article><article><GraduationCap size={17}/><span>Classes represented</span><strong>{new Set(students.map(student => student.className.trim()).filter(Boolean)).size}</strong></article><article><Mail size={17}/><span>Emails added</span><strong>{students.filter(student => student.email).length}</strong></article></div>
    {showForm && <div className="panel directory-form"><div className="panel-header"><div><div className="panel-kicker">NEW STUDENT</div><h2>Add to roster</h2></div><button className="icon-btn" onClick={() => setShowForm(false)} aria-label="Close form"><X size={17}/></button></div>{error && <div className="builder-error">{error}</div>}<div className="directory-fields"><label className="builder-field">Full name<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Student name" /></label><label className="builder-field">Email (optional)<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="student@school.edu" /></label><label className="builder-field">Class / section<input value={className} onChange={event => setClassName(event.target.value)} placeholder="e.g. Class 12 · A" /></label></div><div className="directory-form-actions"><button className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-btn" onClick={addStudent}><Plus size={15}/> Save student</button></div></div>}
    <div className="directory-list-panel"><div className="directory-list-heading"><div><div className="panel-kicker">ROSTER</div><h2>Students <span>{filtered.length}</span></h2></div><label className="tests-search directory-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search students…"/></label></div>
    {filtered.length ? <div className="directory-list">{filtered.map(student => <article className="directory-student" key={student.id}><div className="directory-avatar">{student.name.trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase()).join("")}</div><div className="directory-student-main"><strong>{student.name}</strong><span>{student.email || "No email added"}</span></div><span className="directory-class">{student.className}</span><button className="builder-icon-danger" onClick={() => setStudents(current => current.filter(item => item.id !== student.id))} aria-label={"Remove " + student.name}><Trash2 size={15}/></button></article>)}</div> : <div className="student-empty"><div className="student-empty-icon"><Users size={25}/></div><h3>{students.length ? "No students found" : "Your roster starts here"}</h3><p>{students.length ? "Try a different name, email, or class search." : "Add students to create a simple local class directory."}</p>{!students.length && <button className="primary-btn" onClick={() => setShowForm(true)}><Plus size={15}/> Add first student</button>}</div>}
    </div>
  </section>;
}
