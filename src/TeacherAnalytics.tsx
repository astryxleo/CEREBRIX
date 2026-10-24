import { useMemo } from "react";
import { Activity, Award, BarChart3, CheckCircle2, Clock3, FileCode2, TrendingUp, Users } from "lucide-react";
import type { BuilderTest } from "./TestBuilder";

type Attempt = { testName: string; startedAt: number; answers: Record<string, string>; submittedAt?: number };
type Grade = { score: number; feedback: string; gradedAt: number };
type Props = { tests: BuilderTest[] };
const read = <T,>(key: string, fallback: T): T => {
  try { return (JSON.parse(localStorage.getItem(key) || "null") as T) || fallback; }
  catch { return fallback; }
};
export default function TeacherAnalytics({ tests }: Props) {
  const attempts = useMemo(() => read<Record<string, Attempt>>("cerebrix.student.attempts.v1", {}), []);
  const grades = useMemo(() => read<Record<string, Grade>>("cerebrix.teacher.grades.v1", {}), []);
  const submitted = Object.entries(attempts).filter(([, attempt]) => Boolean(attempt.submittedAt));
  const graded = submitted.filter(([key]) => grades[key]);
  const average = graded.length ? Math.round(graded.reduce((sum, [key]) => sum + grades[key].score, 0) / graded.length) : null;
  const maxPossible = (name: string) => tests.find(test => test.name === attempts[name]?.testName)?.totalMarks ?? 100;
  const byTest = tests.map(test => {
    const entries = submitted.filter(([, attempt]) => attempt.testName === test.name);
    const marked = entries.filter(([key]) => grades[key]);
    const percent = marked.length ? Math.round(marked.reduce((sum, [key]) => sum + (maxPossible(key) ? grades[key].score / maxPossible(key) * 100 : 0), 0) / marked.length) : null;
    return { test, count: entries.length, graded: marked.length, percent };
  }).filter(row => row.count || row.test.status === "Scheduled" || row.test.status === "Draft");
  return <section className="analytics-workspace">
    <div className="student-exam-header"><div><span className="panel-kicker">CEREBRIX / PERFORMANCE INTELLIGENCE</span><h2>Class analytics<span className="heading-period">.</span></h2><p>A quick read on submitted work, grading progress, and assessment outcomes.</p></div><div className="student-count"><Activity size={18}/><strong>{graded.length}</strong><span>graded attempts</span></div></div>
    <div className="student-preview-banner"><Activity size={18}/><div><strong>Local analytics preview</strong><p>Metrics are calculated from this browser’s saved assessments, submissions, and grades. They are not school-wide or synced across devices.</p></div></div>
    <div className="analytics-metrics">
      <article className="analytics-metric"><span><FileCode2 size={17}/> Assessments</span><strong>{tests.length}</strong><small>Saved in this browser</small></article>
      <article className="analytics-metric"><span><Users size={17}/> Submitted</span><strong>{submitted.length}</strong><small>Completed attempts</small></article>
      <article className="analytics-metric"><span><Clock3 size={17}/> To review</span><strong>{submitted.length - graded.length}</strong><small>Awaiting a grade</small></article>
      <article className="analytics-metric"><span><Award size={17}/> Average score</span><strong>{average === null ? "—" : average}<small>{average === null ? "" : " marks"}</small></strong><small>{graded.length ? "Across graded attempts" : "Grade attempts to calculate"}</small></article>
    </div>
    <div className="panel analytics-panel"><div className="panel-header"><div><div className="panel-kicker">ASSESSMENT BREAKDOWN</div><h2>Performance by test</h2><p>Submission counts and average percentage are shown where local grading data exists.</p></div><BarChart3 size={19} className="muted-icon"/></div>
      {byTest.length ? <div className="analytics-test-list">{byTest.map(({test,count,graded:marked,percent}) => <article className="analytics-test-row" key={test.name}><div className="analytics-test-icon"><FileCode2 size={17}/></div><div className="analytics-test-main"><strong>{test.name}</strong><span>{test.subject} · {test.status}</span><div className="analytics-track"><i style={{width:(percent ?? 0)+"%"}}/></div></div><div className="analytics-test-stat"><strong>{count}</strong><span>submitted</span></div><div className="analytics-test-stat"><strong>{marked}</strong><span>graded</span></div><div className="analytics-test-score">{percent === null ? <span className="analytics-no-score">No score yet</span> : <><strong>{percent}%</strong><span><TrendingUp size={12}/> average</span></>}</div></article>)}</div> : <div className="student-empty"><div className="student-empty-icon"><BarChart3 size={25}/></div><h3>Nothing to analyse yet</h3><p>Create an assessment and collect submissions to start building your local report.</p></div>}
      <div className="analytics-footnote"><CheckCircle2 size={14}/> Scores use the teacher-entered grades. The demo does not automatically execute or grade code.</div>
    </div>
  </section>;
}
