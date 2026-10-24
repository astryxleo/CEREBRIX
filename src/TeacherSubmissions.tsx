import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Editor from "@monaco-editor/react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { CheckCircle2, ClipboardList, Download, FileCode2, MessageSquareText, Save, Search } from "lucide-react";
import type { BuilderTest } from "./TestBuilder";
import { supabase } from "./lib/supabase";

type Attempt = { testName: string; assessmentId?: string; submissionId?: string; studentId?: string; startedAt: number; answers: Record<string, string>; submittedAt?: number };
type Grade = { score: number; feedback: string; gradedAt: number };
type Props = { tests: BuilderTest[]; userId: string };
const attemptsKey = "cerebrix.student.attempts.v1";
const gradesKey = "cerebrix.teacher.grades.v1";
function read<T,>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") as T || fallback; }
  catch { return fallback; }
}
export default function TeacherSubmissions({ tests, userId }: Props) {
  const [attempts, setAttempts] = useState<Record<string, Attempt>>(() => read(attemptsKey, {}));
  const [grades, setGrades] = useState<Record<string, Grade>>(() => read(gradesKey, {}));
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState("0");
  const [feedback, setFeedback] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "graded" | "ungraded">("all");
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase!.from("assessment_submissions")
        .select("id,assessment_id,student_id,answers,started_at,submitted_at,status,assessments(title),assessment_grades(score,feedback,graded_at)")
        .eq("status", "submitted").order("submitted_at", { ascending: false });
      if (!alive) return;
      if (error) { setNotice("Could not load shared submissions. Check that this account has Teacher access."); return; }
      const remoteAttempts: Record<string, Attempt> = {};
      const remoteGrades: Record<string, Grade> = {};
      for (const row of data ?? []) {
        const assessment = Array.isArray(row.assessments) ? row.assessments[0] : row.assessments;
        const title = assessment?.title ?? tests.find(test => test.id === row.assessment_id)?.name ?? "Assessment";
        remoteAttempts[row.id] = {
          testName: title, assessmentId: row.assessment_id, submissionId: row.id, studentId: row.student_id,
          startedAt: new Date(row.started_at).getTime(),
          answers: row.answers && typeof row.answers === "object" ? row.answers as Record<string, string> : {},
          submittedAt: row.submitted_at ? new Date(row.submitted_at).getTime() : undefined,
        };
        const gradeRaw = row.assessment_grades;
        const grade = Array.isArray(gradeRaw) ? gradeRaw[0] : gradeRaw;
        if (grade) remoteGrades[row.id] = { score: Number(grade.score), feedback: grade.feedback ?? "", gradedAt: new Date(grade.graded_at).getTime() };
      }
      setAttempts(current => ({ ...current, ...remoteAttempts }));
      setGrades(current => ({ ...current, ...remoteGrades }));
    };
    void load();
    return () => { alive = false; };
  }, [userId, tests]);

  const allRows = useMemo(() => Object.entries(attempts).filter(([, a]) => Boolean(a.submittedAt)).map(([name, a]) => ({ name, attempt: a, test: tests.find(t => t.id === a.assessmentId) ?? tests.find(t => t.name === a.testName), grade: grades[name] })).sort((a,b) => (b.attempt.submittedAt || 0) - (a.attempt.submittedAt || 0)), [attempts, tests, grades]);
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
    const quote = (value: unknown) => {
      const raw = String(value ?? "");
      const first = raw.trimStart().charAt(0);
      const safe = ["=", "+", "-", "@"].includes(first) ? "'" + raw : raw;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
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
  const saveGrade = async () => {
    if (!active) return;
    const max = active.test?.totalMarks ?? 100;
    const value = Number(score);
    if (!Number.isFinite(value) || value < 0 || value > max) { setNotice(`Enter a score from 0 to ${max}.`); return; }
    const grade = { score: value, feedback: feedback.trim(), gradedAt: Date.now() };
    if (active.attempt.submissionId && supabase) {
      const { error } = await supabase.from("assessment_grades").upsert({
        submission_id: active.attempt.submissionId, graded_by: userId, score: value,
        feedback: feedback.trim(), graded_at: new Date(grade.gradedAt).toISOString(),
      }, { onConflict: "submission_id" });
      if (error) { setNotice("Grade could not be saved to the shared database. Confirm Teacher access and retry."); return; }
      setNotice("Grade saved to the shared workspace.");
    } else {
      setNotice("Grade saved in this browser only.");
    }
    const next = { ...grades, [active.name]: grade };
    setGrades(next);
    try { localStorage.setItem(gradesKey, JSON.stringify(next)); } catch { /* Shared grade is already saved if applicable. */ }
  };
  return <section className="teacher-submissions">
    <div className="student-exam-header"><div><span className="panel-kicker">CEREBRIX / REVIEW DESK</span><h2>Submission inbox<span className="heading-period">.</span></h2><p>Inspect submitted answers, leave feedback, and record marks.</p></div><div className="directory-header-actions"><div className="student-count"><ClipboardList size={18}/><strong>{allRows.length}</strong><span>submissions</span></div><button className="secondary-btn" onClick={exportSubmissions} disabled={!rows.length}><Download size={15}/> Export CSV</button></div></div>
    <div className="student-preview-banner"><MessageSquareText size={18}/><div><strong>{supabase ? "Shared review studio" : "Local review preview"}</strong><p>{supabase ? "Submitted answers and teacher grades are synced through your authenticated Supabase workspace." : "This preview only sees attempts stored in this browser. Connect Supabase for shared grading."}</p></div></div>
    {notice && <div className="notice"><CheckCircle2 size={15}/><span>{notice}</span></div>}
    {allRows.length > 0 && <div className="grading-score-strip"><div><span className="panel-kicker">GRADING SNAPSHOT</span><strong>{allRows.filter(row => row.grade).length} / {allRows.length} graded</strong><small>Score distribution across submitted attempts</small></div><div className="grading-mini-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={allRows.slice(0,12).reverse().map((row,index)=>({label:String(index+1),score:row.grade?.score ?? 0}))}><XAxis dataKey="label" hide/><Tooltip cursor={{fill:"rgba(0,207,255,.08)"}} contentStyle={{background:"#080b12",border:"1px solid rgba(0,207,255,.22)",borderRadius:10,color:"#f5faff"}}/><Bar dataKey="score" fill="#0066FF" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div></div>}
    {allRows.length > 0 && <div className="tests-toolbar submissions-toolbar"><label className="tests-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assessment, submission key, feedback…" aria-label="Search submissions"/></label><div className="tests-filters" aria-label="Filter submissions">{([["all","All",allRows.length],["ungraded","Ungraded",allRows.filter(row => !row.grade).length],["graded","Graded",allRows.filter(row => Boolean(row.grade)).length]] as const).map(([value,label,count]) => <button key={value} type="button" className={statusFilter === value ? "active" : ""} onClick={() => setStatusFilter(value)}>{label}<span>{count}</span></motion.button>)}</div></div>}
    {rows.length === 0 ? <div className="student-empty"><div className="student-empty-icon"><FileCode2 size={25}/></div><h3>{allRows.length ? "No matching submissions" : "No submitted attempts yet"}</h3><p>{allRows.length ? "Try another search or switch the grading filter." : "Switch to Student preview, start a scheduled assessment and submit it on this device to see it appear here."}</p></div> : <div className="submission-layout">
      <div className="submission-list">{rows.map(row => <motion.button layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:.2}} className={active?.name === row.name ? "submission-row selected" : "submission-row"} key={row.name} onClick={() => startGrade(row.name, row.grade)}><span className="submission-row-icon"><FileCode2 size={16}/></span><span className="submission-row-copy"><strong>{row.attempt.testName}</strong><small>Submitted {new Date(row.attempt.submittedAt || 0).toLocaleString()}</small><small>{Object.values(row.attempt.answers).filter(v => v.trim()).length} answers recorded</small></span><span className={row.grade ? "student-state done" : "student-state"}>{row.grade ? `${row.grade.score} marks` : "Ungraded"}</span></button>)}</div>
      {active ? <article className="submission-detail"><div className="submission-detail-head"><div><span className="panel-kicker">SUBMISSION REVIEW</span><h3>{active.attempt.testName}</h3></div><span className="submission-max">{active.test?.totalMarks ?? 100} max marks</span></div>
        {(active.test?.questions || []).map((q, i) => <section className="submission-answer" key={q.id}><div className="submission-answer-head"><strong>Q{ i + 1 }. {q.title.trim() || `Question ${i + 1}`}</strong><span>{q.marks} marks</span></div><p>{q.prompt}</p><div className="teacher-code-view"><div className="exam-monaco-toolbar"><span><i/> submission.{q.kind === "Python" ? "py" : q.kind === "MySQL" ? "sql" : "txt"}</span><span>READ ONLY · NO EXECUTION</span></div><Editor height="190px" language={q.kind === "Python" ? "python" : q.kind === "MySQL" ? "sql" : "plaintext"} theme="vs-dark" value={active.attempt.answers[String(q.id)]?.trim() || "No answer provided."} options={{readOnly:true,domReadOnly:true,contextmenu:false,fontFamily:"JetBrains Mono, monospace",fontSize:13,minimap:{enabled:false},lineNumbers:"on",scrollBeyondLastLine:false,automaticLayout:true,wordWrap:"on",renderLineHighlight:"none",overviewRulerLanes:0,hideCursorInOverviewRuler:true,scrollbar:{vertical:"auto",horizontal:"auto"}}}/></div></section>)}
        <div className="grade-form"><label>Score (out of {active.test?.totalMarks ?? 100})<input type="number" min="0" max={active.test?.totalMarks ?? 100} value={score} onChange={e => setScore(e.target.value)}/></label><label>Teacher feedback<textarea rows={3} value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Share feedback or next steps…"/></label><div className="grade-actions"><button className="secondary-btn" onClick={() => setNotice("Code execution is not enabled. Configure an isolated server-side sandbox before running student submissions; no code was executed.")}><FileCode2 size={15}/> Run Code</button><button className="primary-btn" onClick={saveGrade}><Save size={15}/> Save grade {supabase && active.attempt.submissionId ? "to workspace" : "locally"}</button></div>{active.grade && <small className="grade-saved">Last graded {new Date(active.grade.gradedAt).toLocaleString()} · {active.grade.score} marks</small>}</div>
      </article> : <div className="student-empty"><div className="student-empty-icon"><ClipboardList size={25}/></div><h3>Select a submission</h3><p>Choose an attempt from the inbox to review answers and enter a grade.</p></div>}
    </div>}
  </section>;
}
