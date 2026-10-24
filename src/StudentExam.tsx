import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, FileCode2, Send, ShieldCheck } from "lucide-react";
import type { BuilderTest } from "./TestBuilder";

type Props = { tests: BuilderTest[] };
type Attempt = { testName: string; startedAt: number; answers: Record<string, string>; submittedAt?: number };
const attemptsKey = "cerebrix.student.attempts.v1";

function readAttempts(): Record<string, Attempt> {
  try { return JSON.parse(localStorage.getItem(attemptsKey) || "{}") as Record<string, Attempt>; }
  catch { return {}; }
}

export default function StudentExam({ tests }: Props) {
  const [attempts, setAttempts] = useState<Record<string, Attempt>>(readAttempts);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const available = useMemo(() => tests.filter(t => t.status === "Scheduled" && t.questions?.length), [tests]);
  const activeTest = available.find(t => t.name === activeName);
  const attempt = activeTest ? attempts[activeTest.name] : undefined;
  const currentQuestion = activeTest?.questions[questionIndex];
  const remainingSeconds = activeTest && attempt && !attempt.submittedAt
    ? Math.max(0, activeTest.duration * 60 - Math.floor((now - attempt.startedAt) / 1000)) : 0;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(attemptsKey, JSON.stringify(attempts)); } catch { /* Storage can be unavailable. */ }
  }, [attempts]);

  const begin = (test: BuilderTest) => {
    const previous = attempts[test.name];
    if (previous?.submittedAt) { setActiveName(test.name); return; }
    if (previous) { setActiveName(test.name); return; }
    const next: Attempt = { testName: test.name, startedAt: Date.now(), answers: {} };
    setAttempts(current => ({ ...current, [test.name]: next }));
    setQuestionIndex(0);
    setActiveName(test.name);
  };
  const updateAnswer = (value: string) => {
    if (!activeTest || !attempt || attempt.submittedAt || remainingSeconds <= 0 || !currentQuestion) return;
    setAttempts(current => ({ ...current, [activeTest.name]: { ...attempt, answers: { ...attempt.answers, [String(currentQuestion.id)]: value } } }));
  };
  const submit = () => {
    if (!activeTest || !attempt || attempt.submittedAt) return;
    setAttempts(current => ({ ...current, [activeTest.name]: { ...attempt, submittedAt: Date.now() } }));
    setConfirmSubmit(false);
  };
  const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (activeTest && attempt) {
    const submitted = Boolean(attempt.submittedAt);
    const expired = !submitted && remainingSeconds <= 0;
    return <section className="student-workspace">
      <button className="student-back" onClick={() => { setActiveName(null); setConfirmSubmit(false); }}><ArrowLeft size={15}/> All assessments</button>
      <div className="student-exam-header"><div><span className="panel-kicker">CEREBRIX / STUDENT EXAM</span><h2>{activeTest.name}</h2><p>{activeTest.subject} · {activeTest.totalMarks} marks · {activeTest.questions.length} questions</p></div><div className={remainingSeconds < 300 && !submitted ? "exam-timer urgent" : "exam-timer"}><Clock3 size={17}/><div><small>{submitted ? "STATUS" : "TIME REMAINING"}</small><strong>{submitted ? "Submitted" : formatTime(remainingSeconds)}</strong></div></div></div>
      {submitted ? <div className="exam-complete"><CheckCircle2 size={34}/><h3>Submission recorded</h3><p>Your answers have been saved in this browser for this demo. They have not been sent to a teacher or server.</p><button className="primary-btn" onClick={() => setActiveName(null)}>Back to assessments <ArrowRight size={15}/></button></div> : <>
        <div className="exam-integrity-note"><ShieldCheck size={16}/><span><strong>Work carefully, save as you go.</strong> Answers autosave to this browser. This preview does not provide server-enforced timing or online submission.</span></div>
        <div className="exam-layout"><aside className="exam-question-nav"><span className="panel-kicker">QUESTIONS</span><div>{activeTest.questions.map((q, i) => <button key={q.id} className={questionIndex === i ? "current" : ""} onClick={() => setQuestionIndex(i)}><span>{String(i + 1).padStart(2, "0")}</span><i className={attempt.answers[String(q.id)]?.trim() ? "answered" : ""}/></button>)}</div><p>{activeTest.questions.filter(q => attempt.answers[String(q.id)]?.trim()).length} of {activeTest.questions.length} answered</p></aside>
          <article className="exam-question-panel"><div className="exam-question-meta"><span>QUESTION {String(questionIndex + 1).padStart(2, "0")} / {String(activeTest.questions.length).padStart(2, "0")}</span><b>{currentQuestion?.marks} marks</b></div><h3>{currentQuestion?.title.trim() || `Question ${questionIndex + 1}`}</h3><p className="exam-prompt">{currentQuestion?.prompt}</p>{currentQuestion?.dataset.trim() && <div className="exam-dataset"><span>STARTER DATA / REFERENCE</span><pre>{currentQuestion.dataset}</pre></div>}<label className="exam-answer-label">YOUR ANSWER <span>{currentQuestion?.kind}</span><textarea value={currentQuestion ? attempt.answers[String(currentQuestion.id)] || "" : ""} onChange={e => updateAnswer(e.target.value)} placeholder={currentQuestion?.kind === "Theory" ? "Write your answer here…" : "Write your code, SQL query, or explanation here…"} rows={11} spellCheck={false}/></label><div className="exam-question-actions"><button className="secondary-btn" disabled={questionIndex === 0} onClick={() => setQuestionIndex(i => Math.max(0, i - 1))}><ArrowLeft size={14}/> Previous</button>{questionIndex < activeTest.questions.length - 1 ? <button className="primary-btn" onClick={() => setQuestionIndex(i => Math.min(activeTest.questions.length - 1, i + 1))}>Next question <ArrowRight size={14}/></button> : <button className="primary-btn" onClick={() => setConfirmSubmit(true)}><Send size={14}/> Review & submit</button>}</div></article>
        </div>
        {confirmSubmit && <div className="exam-confirm"><div><strong>Submit this attempt?</strong><p>{activeTest.questions.filter(q => attempt.answers[String(q.id)]?.trim()).length} of {activeTest.questions.length} questions have answers. You can’t edit after submitting.</p></div><button className="secondary-btn" onClick={() => setConfirmSubmit(false)}>Keep working</button><button className="primary-btn" onClick={submit}>Submit attempt <Send size={14}/></button></div>}
        {expired && <div className="exam-expired"><Clock3 size={15}/> Time limit reached. Editing is paused in this preview; use Review & submit to record the attempt locally.</div>}
      </>}
    </section>;
  }

  return <section className="student-workspace"><div className="student-exam-header"><div><span className="panel-kicker">CEREBRIX / STUDENT PORTAL</span><h2>Your assessments<span className="heading-period">.</span></h2><p>Pick up an available assessment and work through it at your own pace.</p></div><div className="student-count"><FileCode2 size={18}/><strong>{available.length}</strong><span>available</span></div></div>
    <div className="student-preview-banner"><ShieldCheck size={18}/><div><strong>Student preview mode</strong><p>This is a browser-only demonstration. Tests and answers are stored locally on this device, not shared with a teacher.</p></div></div>
    {available.length ? <div className="student-assessment-grid">{available.map(test => { const saved = attempts[test.name]; const done = Boolean(saved?.submittedAt); const answered = saved ? Object.values(saved.answers).filter(v => v.trim()).length : 0; return <article className="student-assessment-card" key={test.name}><div className="student-card-icon"><FileCode2 size={19}/></div><span className={done ? "student-state done" : saved ? "student-state progress" : "student-state"}>{done ? "Submitted" : saved ? "In progress" : "Available"}</span><h3>{test.name}</h3><p>{test.subject}</p><div className="student-card-meta"><span><Clock3 size={14}/>{test.duration} min</span><span><CheckCircle2 size={14}/>{test.questionCount} questions</span><span>{test.totalMarks} marks</span></div>{saved && !done && <div className="student-saved-progress">{answered} questions answered</div>}<button className="primary-btn" onClick={() => begin(test)}>{done ? "View submission" : saved ? "Resume assessment" : "Start assessment"} <ArrowRight size={15}/></button></article>; })}</div> : <div className="student-empty"><div className="student-empty-icon"><FileCode2 size={25}/></div><h3>No assessments available yet</h3><p>When a teacher schedules an assessment with questions, it will appear here.</p></div>}
  </section>;
}
