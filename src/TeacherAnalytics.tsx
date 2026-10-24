import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Award, BarChart3, CheckCircle2, Clock3, FileCode2, TrendingUp, Users } from "lucide-react";
import type { BuilderTest } from "./TestBuilder";
import { supabase } from "./lib/supabase";

type Attempt = { testName: string; assessmentId?: string; startedAt: number; answers: Record<string, string>; submittedAt?: number };
type Grade = { score: number; feedback: string; gradedAt: number };
type Props = { tests: BuilderTest[]; userId: string };
function readAttempts(): Record<string, Attempt> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("cerebrix.student.attempts.v1") || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, item]) => {
      if (!item || typeof item !== "object") return false;
      const attempt = item as Partial<Attempt>;
      return typeof attempt.testName === "string"
        && typeof attempt.startedAt === "number"
        && Number.isFinite(attempt.startedAt)
        && !!attempt.answers
        && typeof attempt.answers === "object"
        && !Array.isArray(attempt.answers)
        && (attempt.submittedAt === undefined || (typeof attempt.submittedAt === "number" && Number.isFinite(attempt.submittedAt)));
    })) as Record<string, Attempt>;
  } catch { return {}; }
}
function readGrades(): Record<string, Grade> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("cerebrix.teacher.grades.v1") || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, item]) => {
      if (!item || typeof item !== "object") return false;
      const grade = item as Partial<Grade>;
      return typeof grade.score === "number"
        && Number.isFinite(grade.score)
        && typeof grade.feedback === "string"
        && typeof grade.gradedAt === "number"
        && Number.isFinite(grade.gradedAt);
    })) as Record<string, Grade>;
  } catch { return {}; }
}
export default function TeacherAnalytics({ tests, userId }: Props) {
  const [remoteAttempts, setRemoteAttempts] = useState<Record<string, Attempt>>({});
  const [remoteGrades, setRemoteGrades] = useState<Record<string, Grade>>({});
  const [remoteLoaded, setRemoteLoaded] = useState(!supabase);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!supabase) { setRemoteLoaded(true); return; }
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase!.from("assessment_submissions")
        .select("id,assessment_id,started_at,submitted_at,status,assessment_grades(score,feedback,graded_at)")
        .eq("status", "submitted");
      if (!alive) return;
      if (error) { setNotice("Shared analytics could not load. Check Teacher access and database policies."); setRemoteLoaded(true); return; }
      const nextAttempts: Record<string, Attempt> = {};
      const nextGrades: Record<string, Grade> = {};
      for (const row of data ?? []) {
        const testName = tests.find(test => test.id === row.assessment_id)?.name ?? "Assessment";
        nextAttempts[row.id] = {
          testName, assessmentId: row.assessment_id, startedAt: new Date(row.started_at).getTime(),
          answers: {}, submittedAt: row.submitted_at ? new Date(row.submitted_at).getTime() : undefined,
        };
        const raw = row.assessment_grades;
        const grade = Array.isArray(raw) ? raw[0] : raw;
        if (grade) nextGrades[row.id] = { score: Number(grade.score), feedback: grade.feedback ?? "", gradedAt: new Date(grade.graded_at).getTime() };
      }
      setRemoteAttempts(nextAttempts);
      setRemoteGrades(nextGrades);
      setRemoteLoaded(true);
    };
    void load();
    return () => { alive = false; };
  }, [userId, tests]);
  const attempts = useMemo(() => supabase ? remoteAttempts : readAttempts(), [remoteAttempts]);
  const grades = useMemo(() => supabase ? remoteGrades : readGrades(), [remoteGrades]);
  const submitted = Object.entries(attempts).filter(([, attempt]) => Boolean(attempt.submittedAt));
  const graded = submitted.filter(([key]) => grades[key]);
  const average = graded.length ? Math.round(graded.reduce((sum, [key]) => sum + (maxPossible(key) ? grades[key].score / maxPossible(key) * 100 : 0), 0) / graded.length) : null;
  const maxPossible = (name: string) => tests.find(test => test.name === attempts[name]?.testName)?.totalMarks ?? 100;
  const byTest = tests.map(test => {
    const entries = submitted.filter(([, attempt]) => attempt.testName === test.name);
    const marked = entries.filter(([key]) => grades[key]);
    const percent = marked.length ? Math.round(marked.reduce((sum, [key]) => sum + (maxPossible(key) ? grades[key].score / maxPossible(key) * 100 : 0), 0) / marked.length) : null;
    return { test, count: entries.length, graded: marked.length, percent };
  }).filter(row => row.count || row.test.status === "Scheduled" || row.test.status === "Draft");
  const chartRows = byTest.filter(row => row.percent !== null).map(row => ({
    name: row.test.name.length > 16 ? row.test.name.slice(0, 16) + "…" : row.test.name,
    average: row.percent ?? 0,
  }));
  return <section className="analytics-workspace">
    <div className="student-exam-header"><div><span className="panel-kicker">CEREBRIX / PERFORMANCE INTELLIGENCE</span><h2>Class analytics<span className="heading-period">.</span></h2><p>A quick read on submitted work, grading progress, and assessment outcomes.</p></div><div className="student-count"><Activity size={18}/><strong>{graded.length}</strong><span>graded attempts</span></div></div>
    {notice && <div className="notice"><Activity size={16}/><span>{notice}</span></div>}
    <div className="student-preview-banner"><Activity size={18}/><div><strong>{supabase ? "Shared analytics" : "Local analytics preview"}</strong><p>{supabase ? (remoteLoaded ? "Metrics use submissions and grades from your authenticated workspace." : "Loading shared submissions and grades…") : "Metrics are calculated from this browser’s saved assessments, submissions, and grades."}</p></div></div>
    <div className="analytics-metrics">
      <article className="analytics-metric"><span><FileCode2 size={17}/> Assessments</span><strong>{tests.length}</strong><small>Scheduled or saved assessments</small></article>
      <article className="analytics-metric"><span><Users size={17}/> Submitted</span><strong>{submitted.length}</strong><small>Completed attempts</small></article>
      <article className="analytics-metric"><span><Clock3 size={17}/> To review</span><strong>{submitted.length - graded.length}</strong><small>Awaiting a grade</small></article>
      <article className="analytics-metric"><span><Award size={17}/> Average score</span><strong>{average === null ? "—" : average}<small>{average === null ? "" : "%"}</small></strong><small>{graded.length ? "Across graded attempts" : "Grade attempts to calculate"}</small></article>
    </div>
    {chartRows.length > 0 && <motion.div className="panel analytics-chart-panel" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.35}}><div className="panel-header"><div><div className="panel-kicker">CLASS PERFORMANCE</div><h2>Score trajectory</h2><p>Average percentages from completed teacher grading.</p></div><div className="chart-legend"><span/> AVERAGE SCORE</div></div><div className="analytics-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartRows} margin={{top:10,right:10,left:-18,bottom:0}}><defs><linearGradient id="cerebrixScoreFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0066FF" stopOpacity={0.32}/><stop offset="95%" stopColor="#0066FF" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid stroke="rgba(220,230,242,.08)" vertical={false}/><XAxis dataKey="name" tick={{fill:"rgba(220,230,242,.55)",fontSize:10}} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{fill:"rgba(220,230,242,.45)",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={value => `${value}%`}/><Tooltip contentStyle={{background:"#080b12",border:"1px solid rgba(0,207,255,.2)",borderRadius:10,color:"#f5faff"}} formatter={(value) => [`${value}%`, "Average score"]}/><Area type="monotone" dataKey="average" stroke="#0066FF" strokeWidth={2.5} fill="url(#cerebrixScoreFill)" dot={{r:3,fill:"#00CFFF",stroke:"#000",strokeWidth:1}} activeDot={{r:5,fill:"#00CFFF",stroke:"#000",strokeWidth:2}} animationDuration={900}/></AreaChart></ResponsiveContainer></div></motion.div>}
    <div className="panel analytics-panel"><div className="panel-header"><div><div className="panel-kicker">ASSESSMENT BREAKDOWN</div><h2>Performance by test</h2><p>Submission counts and average percentages come from the shared grading workspace when connected.</p></div><BarChart3 size={19} className="muted-icon"/></div>
      {byTest.length ? <div className="analytics-test-list">{byTest.map(({test,count,graded:marked,percent}) => <article className="analytics-test-row" key={test.name}><div className="analytics-test-icon"><FileCode2 size={17}/></div><div className="analytics-test-main"><strong>{test.name}</strong><span>{test.subject} · {test.status}</span><div className="analytics-track"><i style={{width:(percent ?? 0)+"%"}}/></div></div><div className="analytics-test-stat"><strong>{count}</strong><span>submitted</span></div><div className="analytics-test-stat"><strong>{marked}</strong><span>graded</span></div><div className="analytics-test-score">{percent === null ? <span className="analytics-no-score">No score yet</span> : <><strong>{percent}%</strong><span><TrendingUp size={12}/> average</span></>}</div></article>)}</div> : <div className="student-empty"><div className="student-empty-icon"><BarChart3 size={25}/></div><h3>Nothing to analyse yet</h3><p>Create an assessment and collect submissions to start building your local report.</p></div>}
      <div className="analytics-footnote"><CheckCircle2 size={14}/> Scores use the teacher-entered grades. The demo does not automatically execute or grade code.</div>
    </div>
  </section>;
}
