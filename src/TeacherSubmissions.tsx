import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Download, FileCode2, MessageSquareText, Save, Search } from "lucide-react";
import type { BuilderTest } from "./TestBuilder";

type Attempt = { testName: string; startedAt: number; answers: Record<string, string>; submittedAt?: number };
type Grade = { score: number; feedback: string; gradedAt: number };
type Props = { tests: BuilderTest[] };
const attemptsKey = "cerebrix.student.attempts.v1";
const gradesKey = "cerebrix.teacher.grades.v1";
function read<T,>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") as T || fallback; }
  catch { return fallback; }
}
export default function TeacherSubmissions({ tests }: Props) {
  const [attempts] = useState<Record<string, Attempt>>(() => read(attemptsKey, {}));
  const [grades, setGrades] = useState<Record<string, Grade>>(() => read(gradesKey, {}));
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState("0");
  const [feedback, setFeedback] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "graded" | "ungraded">("all");
  const allRows = useMemo(() => Object.entries(attempts).filter(([, a]) => Boolean(a.submittedAt)).map(([name, a]) => ({ name, attempt: a, test: tests.find(t => t.name === a.testName), grade: grades[name] })).sort((a,b) => (b.attempt.submittedAt || 0) - (a.attempt.submittedAt || 0)), [attempts, tests, grades]);
  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return allRows.filter(row => {
      const matchesSearch = !term || row.attempt.testName.toLocaleLowerCase().includes(term) || row.name.toLocaleLowerCase().includes(term) || row.grade?.feedback.toLocaleLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || (statusFilter === "graded" ? Boolean(row.grade) : !row.grade);
      return matchesSearch && matchesStatus;
    });
  }, [allRows, search, statusFilter]);
  const active = rows.find(r => r.name === selected) ?? rows[0];
  const exportSubmissions = () => {
    const quote = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
    const data = [
      ["Assessment", "Submission key", "Submitted at", "Answer count", "Score", "Maximum marks", "Feedback", "Answers"],
      ...rows.map(row => [
        row.attempt.testName,
        row.name,
        row.attempt.submittedAt ? new Date(row.attempt.submittedAt).toISOString() : "",
        Object.values(row.attempt.answers).filter(value => value.trim()).length,
        row.grade?.score ?? "",
        row.test?.totalMarks ?? 100,
        row.grade?.feedback ?? "",
        JSON.stringify(row.attempt.answers)
      ])
    ];
    const csv = data.map(row => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url; link.download = "cerebrix-submissions.csv"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const startGrade = (name: string, current?: Grade) => { setSelected(name); setScore(String(current?.score ?? 0)); setFeedback(current?.feedback ?? ""); setNotice(""); };
  const saveGrade = () => {
    if (!active) return;
    const max = active.test?.totalMarks ?? 100;
    const value = Number(score);
    if (!Number.isFinite(value) || value < 0 || value > max) { setNotice(`Enter a score from 0 to ${max}.`); return; }
    const next = { ...grades, [active.name]: { score: value, feedback: feedback.trim(), gradedAt: Date.now() } };
    setGrades(next);
    try { localStorage.setItem(gradesKey, JSON.stringify(next)); setNotice("Grade saved in this browser."); }
    catch { setNotice("Browser storage is unavailable; this grade could not be saved."); }
  };
  return <section className="teacher-submissions">
    <div className="student-exam-header"><div><span className="panel-kicker">CEREBRIX / REVIEW DESK</span><h2>Submission inbox<span className="heading-period">.</span></h2><p>Inspect submitted answers, leave feedback, and record marks.</p></div><div className="directory-header-actions"><div className="student-count"><ClipboardList size={18}/><strong>{allRows.length}</strong><span>submissions</span></div><button className="secondary-btn" onClick={exportSubmissions} disabled={!rows.length}><Download size={15}/> Export CSV</button></div></div>
    <div className="student-preview-banner"><MessageSquareText size={18}/><div><strong>Local review mode</strong><p>This inbox can only see attempts stored in this same browser. Grades and feedback are not sent to students or a server.</p></div></div>
    {notice && <div className="notice"><CheckCircle2 size={15}/><span>{notice}</span></div>}
    {allRows.length > 0 && <div className="tests-toolbar submissions-toolbar"><label className="tests-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assessment, submission key, feedback…" aria-label="Search submissions"/></label><div className="tests-filters" aria-label="Filter submissions">{([["all","All",allRows.length],["ungraded","Ungraded",allRows.filter(row => !row.grade).length],["graded","Graded",allRows.filter(row => Boolean(row.grade)).length]] as const).map(([value,label,count]) => <button key={value} type="button" className={statusFilter === value ? "active" : ""} onClick={() => setStatusFilter(value)}>{label}<span>{count}</span></button>)}</div></div>}
    {rows.length === 0 ? <div className="student-empty"><div className="student-empty-icon"><FileCode2 size={25}/></div><h3>{allRows.length ? "No matching submissions" : "No submitted attempts yet"}</h3><p>{allRows.length ? "Try another search or switch the grading filter." : "Switch to Student preview, start a scheduled assessment and submit it on this device to see it appear here."}</p></div> : <div className="submission-layout">
      <div className="submission-list">{rows.map(row => <button className={active?.name === row.name ? "submission-row selected" : "submission-row"} key={row.name} onClick={() => startGrade(row.name, row.grade)}><span className="submission-row-icon"><FileCode2 size={16}/></span><span className="submission-row-copy"><strong>{row.attempt.testName}</strong><small>Submitted {new Date(row.attempt.submittedAt || 0).toLocaleString()}</small><small>{Object.values(row.attempt.answers).filter(v => v.trim()).length} answers recorded</small></span><span className={row.grade ? "student-state done" : "student-state"}>{row.grade ? `${row.grade.score} marks` : "Ungraded"}</span></button>)}</div>
      {active ? <article className="submission-detail"><div className="submission-detail-head"><div><span className="panel-kicker">SUBMISSION REVIEW</span><h3>{active.attempt.testName}</h3></div><span className="submission-max">{active.test?.totalMarks ?? 100} max marks</span></div>
        {(active.test?.questions || []).map((q, i) => <section className="submission-answer" key={q.id}><div className="submission-answer-head"><strong>Q{ i + 1 }. {q.title.trim() || `Question ${i + 1}`}</strong><span>{q.marks} marks</span></div><p>{q.prompt}</p><pre>{active.attempt.answers[String(q.id)]?.trim() || "No answer provided."}</pre></section>)}
        <div className="grade-form"><label>Score (out of {active.test?.totalMarks ?? 100})<input type="number" min="0" max={active.test?.totalMarks ?? 100} value={score} onChange={e => setScore(e.target.value)}/></label><label>Teacher feedback<textarea rows={3} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Share feedback or next steps…"/></label><button className="primary-btn" onClick={saveGrade}><Save size={15}/> Save grade locally</button>{active.grade && <small className="grade-saved">Last graded {new Date(active.grade.gradedAt).toLocaleString()} · {active.grade.score} marks</small>}</div>
      </article> : <div className="student-empty"><div className="student-empty-icon"><ClipboardList size={25}/></div><h3>Select a submission</h3><p>Choose an attempt from the inbox to review answers and enter a grade.</p></div>}
    </div>}
  </section>;
}
