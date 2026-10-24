import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Award, CheckCircle2, Clock3, FileCode2, TrendingUp } from "lucide-react";
import { supabase } from "./lib/supabase";
import type { BuilderTest } from "./TestBuilder";

type Props = { tests: BuilderTest[]; userId: string };
type Row = { id: string; assessment_id: string; started_at: string; submitted_at: string | null; status: string; assessment_grades: { score: number; feedback: string; graded_at: string }[] | { score: number; feedback: string; graded_at: string } | null };
export default function StudentAnalytics({ tests, userId }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    const load = async () => {
      const { data, error: queryError } = await supabase!.from("assessment_submissions")
        .select("id,assessment_id,started_at,submitted_at,status,assessment_grades(score,feedback,graded_at)")
        .eq("student_id", userId).order("started_at", { ascending: true });
      if (!alive) return;
      if (queryError) setError("Your performance data could not be loaded. Please refresh and try again.");
      else setRows((data ?? []) as Row[]);
      setLoading(false);
    };
    void load();
    return () => { alive = false; };
  }, [userId]);
  const completed = rows.filter(row => row.status === "submitted");
  const grades = completed.map(row => {
    const raw = row.assessment_grades;
    const grade = Array.isArray(raw) ? raw[0] : raw;
    const test = tests.find(item => item.id === row.assessment_id);
    const total = Math.max(1, Number(test?.totalMarks ?? 100));
    return grade ? { row, score: Number(grade.score), percent: Math.max(0, Math.min(100, Number(grade.score) / total * 100)), feedback: grade.feedback ?? "" } : null;
  }).filter((item): item is { row: Row; score: number; percent: number; feedback: string } => item !== null);
  const average = grades.length ? Math.round(grades.reduce((sum, grade) => sum + grade.percent, 0) / grades.length) : null;
  const chart = grades.map((grade, index) => ({ attempt: "Test " + (index + 1), score: Math.round(grade.percent), name: tests.find(test => test.id === grade.row.assessment_id)?.name ?? "Assessment" }));
  const latestFeedback = [...grades].reverse().find(grade => grade.feedback.trim());
  const metrics = useMemo(() => [
    { label: "Completed exams", value: completed.length, note: "Submitted assessments", icon: CheckCircle2 },
    { label: "Graded attempts", value: grades.length, note: "Results released", icon: Award },
    { label: "Average score", value: average === null ? "—" : average + "%", note: "Across graded exams", icon: TrendingUp },
    { label: "Awaiting grades", value: completed.length - grades.length, note: "Submitted, not graded yet", icon: Clock3 },
  ], [completed.length, grades.length, average]);
  return <section className="student-analytics">
    <div className="student-exam-header"><div><span className="panel-kicker">CEREBRIX / PERSONAL PERFORMANCE</span><h2>My analytics<span className="heading-period">.</span></h2><p>Your assessment history, score trends, and teacher feedback in one place.</p></div><div className="student-count"><Activity size={18}/><strong>{loading ? "…" : completed.length}</strong><span>completed</span></div></div>
    <div className="student-preview-banner"><Award size={18}/><div><strong>Personal performance dashboard</strong><p>Only your own submissions and grades are shown here. Scores appear after your teacher releases the grade.</p></div></div>
    {error && <div className="notice">{error}</div>}
    <div className="analytics-metrics">{metrics.map(({label,value,note,icon:Icon})=><motion.article className="analytics-metric" key={label} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}><span><Icon size={17}/>{label}</span><strong>{loading ? "…" : value}</strong><small>{note}</small></motion.article>)}</div>
    {chart.length > 0 ? <div className="panel analytics-chart-panel"><div className="panel-header"><div><div className="panel-kicker">YOUR PROGRESS</div><h2>Score trajectory</h2><p>Percentage score from each graded assessment.</p></div></div><div className="analytics-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{top:12,right:10,left:-18,bottom:0}}><defs><linearGradient id="studentScoreFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0066ff" stopOpacity={0.32}/><stop offset="100%" stopColor="#00cfff" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid stroke="rgba(220,230,242,.08)" vertical={false}/><XAxis dataKey="attempt" tick={{fill:"#8293a8",fontSize:10}} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{fill:"#8293a8",fontSize:10}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:"#080c12",border:"1px solid rgba(0,207,255,.25)",borderRadius:10,color:"#f5faff"}} formatter={(value:any)=>[value+"%","Score"]} labelFormatter={(label:any)=>chart[Number(String(label).replace("Test ",""))-1]?.name ?? label}/><Area type="monotone" dataKey="score" stroke="#00cfff" strokeWidth={2.5} fill="url(#studentScoreFill)" activeDot={{r:5,fill:"#00cfff",stroke:"#000"}}/></AreaChart></ResponsiveContainer></div></div> : <div className="student-empty"><div className="student-empty-icon"><TrendingUp size={25}/></div><h3>{loading ? "Loading your analytics" : "Your score trend starts here"}</h3><p>{loading ? "Syncing your personal assessment history…" : "Submit an assessment and your teacher will release a grade to unlock score trends here."}</p></div>}
    {latestFeedback && <div className="panel student-feedback-panel"><div className="panel-kicker">LATEST TEACHER FEEDBACK</div><h2>{tests.find(test => test.id === latestFeedback.row.assessment_id)?.name ?? "Assessment"}</h2><p>{latestFeedback.feedback}</p></div>}
    <div className="directory-list-panel"><div className="directory-list-heading"><div><div className="panel-kicker">ASSESSMENT HISTORY</div><h2>My results <span>{completed.length}</span></h2></div></div>{completed.length ? <div className="directory-list">{completed.map(row=>{const raw=row.assessment_grades;const grade=Array.isArray(raw)?raw[0]:raw;const test=tests.find(item=>item.id===row.assessment_id);const percent=grade?Math.round(Number(grade.score)/Math.max(1,Number(test?.totalMarks??100))*100):null;return <article className="directory-student" key={row.id}><div className="directory-avatar"><FileCode2 size={16}/></div><div className="directory-student-main"><strong>{test?.name??"Assessment"}</strong><span>Submitted {row.submitted_at?new Date(row.submitted_at).toLocaleDateString():"—"}</span></div><span className="directory-class">{percent===null?"Awaiting grade":percent+"%"}</span></article>})}</div>:!loading&&<div className="student-empty"><h3>No submitted exams yet</h3><p>Your completed assessments and grades will appear here.</p></div>}</div>
  </section>;
}
