import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Editor from "@monaco-editor/react";
import { useAntiCheating } from "./useAntiCheating";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, FileCode2, Send, ShieldCheck } from "lucide-react";
import type { BuilderTest } from "./TestBuilder";
import { supabase } from "./lib/supabase";

type Props = { tests: BuilderTest[]; userId: string };
type Attempt = { testName: string; assessmentId?: string; submissionId?: string; startedAt: number; answers: Record<string, string>; reviewedQuestions?: string[]; submittedAt?: number };
const attemptsKey = "cerebrix.student.attempts.v1";

function readAttempts(): Record<string, Attempt> {
  try { return JSON.parse(localStorage.getItem(attemptsKey) || "{}") as Record<string, Attempt>; }
  catch { return {}; }
}

export default function StudentExam({ tests, userId }: Props) {
  const [attempts, setAttempts] = useState<Record<string, Attempt>>(readAttempts);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [notice, setNotice] = useState("");
  const available = useMemo(() => tests.filter(t => t.status === "Scheduled" && t.questions?.length), [tests]);
  const activeTest = available.find(t => t.name === activeName);
  const activeKey = activeTest ? (activeTest.id ?? activeTest.name) : null;
  const attempt = activeKey ? attempts[activeKey] : undefined;
  const currentQuestion = activeTest?.questions[questionIndex];
  const fortress = useAntiCheating({
    enabled: Boolean(activeTest && attempt && !attempt.submittedAt),
    blackoutOnBlur: true,
    restrictClipboard: true,
    onWarning: reason => {
      if (supabase && activeTest?.id && attempt?.submissionId) {
        void supabase.from("assessment_integrity_events").insert({
          assessment_id: activeTest.id,
          submission_id: attempt.submissionId,
          student_id: userId,
          event_type: reason,
          details: { source: "browser-client" },
        }).then(({ error }) => {
          if (error) setNotice("An integrity warning was shown, but its audit event could not sync to the server.");
        });
      }
      const messages: Record<string, string> = {
        "tab-hidden": "Focus warning recorded: the exam tab became hidden. Return to the assessment and continue.",
        "print-screen": "Best-effort screen-capture shortcut warning recorded. Browser controls cannot guarantee screenshot prevention.",
        "devtools-shortcut": "Developer-tools shortcut warning recorded.",
        "context-menu": "Right-click was disabled during the active assessment.",
        "clipboard": "Clipboard interaction was blocked.",
      };
      setNotice(messages[reason] ?? "Exam integrity warning recorded.");
    },
  });
  const remainingSeconds = activeTest && attempt && !attempt.submittedAt
    ? Math.max(0, activeTest.duration * 60 - Math.floor((now - attempt.startedAt) / 1000)) : 0;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(attemptsKey, JSON.stringify(attempts)); } catch { /* Storage can be unavailable. */ }
  }, [attempts]);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const loadSubmissions = async () => {
      const { data, error } = await supabase!.from("assessment_submissions")
        .select("id,assessment_id,answers,reviewed_questions,status,started_at,submitted_at")
        .eq("student_id", userId);
      if (!alive) return;
      if (error) { setNotice("Could not sync submissions. Please refresh and try again."); return; }
      setAttempts(current => {
        const next = { ...current };
        for (const row of data ?? []) {
          const test = tests.find(item => item.id === row.assessment_id);
          if (!test) continue;
          next[row.assessment_id] = {
            testName: test.name, assessmentId: row.assessment_id, submissionId: row.id,
            startedAt: new Date(row.started_at).getTime(),
            answers: row.answers && typeof row.answers === "object" ? row.answers as Record<string, string> : {},
            reviewedQuestions: Array.isArray(row.reviewed_questions) ? row.reviewed_questions.map(String) : [],
            submittedAt: row.status === "submitted" && row.submitted_at ? new Date(row.submitted_at).getTime() : undefined,
          };
        }
        return next;
      });
    };
    void loadSubmissions();
    return () => { alive = false; };
  }, [userId, tests]);
  useEffect(() => {
    if (!supabase || !activeTest || !attempt?.submissionId || attempt.submittedAt) return;
    const timer = window.setTimeout(async () => {
      const { error } = await supabase!.from("assessment_submissions")
        .update({ answers: attempt.answers, reviewed_questions: attempt.reviewedQuestions ?? [] })
        .eq("id", attempt.submissionId!);
      if (error) setNotice("Autosave could not sync. Your latest edits remain on this device.");
    }, 600);
    return () => window.clearTimeout(timer);
  }, [activeTest?.id, attempt?.submissionId, attempt?.answers, attempt?.reviewedQuestions, attempt?.submittedAt]);

  useEffect(() => {
    if (!activeTest || !attempt || attempt.submittedAt || remainingSeconds > 0) return;
    void submit();
  }, [activeTest, attempt, remainingSeconds]);

  const begin = async (test: BuilderTest) => {
    const key = test.id ?? test.name;
    const previous = attempts[key] ?? attempts[test.name];
    if (previous) { setActiveName(test.name); return; }
    if (test.id && supabase) {
      const { data, error } = await supabase.from("assessment_submissions")
        .insert({ assessment_id: test.id, student_id: userId, status: "in_progress" })
        .select("id,started_at").single();
      if (error || !data) { setNotice("Could not start this assessment. It may have closed or your access may have changed."); return; }
      const next: Attempt = { testName: test.name, assessmentId: test.id, submissionId: data.id, startedAt: new Date(data.started_at).getTime(), answers: {} };
      setAttempts(current => ({ ...current, [key]: next }));
    } else {
      const next: Attempt = { testName: test.name, startedAt: Date.now(), answers: {} };
      setAttempts(current => ({ ...current, [key]: next }));
    }
    setQuestionIndex(0);
    setActiveName(test.name);
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      try { await document.documentElement.requestFullscreen(); } catch { /* Fullscreen requires browser permission/user gesture. */ }
    }
  };
  const toggleReview = () => {
    if (!activeTest || !attempt || attempt.submittedAt || !currentQuestion) return;
    const key = activeTest.id ?? activeTest.name;
    const questionKey = String(currentQuestion.id);
    const current = attempt.reviewedQuestions ?? [];
    const reviewedQuestions = current.includes(questionKey)
      ? current.filter(item => item !== questionKey)
      : [...current, questionKey];
    setAttempts(items => ({ ...items, [key]: { ...attempt, reviewedQuestions } }));
  };
  const updateAnswer = (value: string) => {
    if (!activeTest || !attempt || attempt.submittedAt || remainingSeconds <= 0 || !currentQuestion) return;
    const key = activeTest.id ?? activeTest.name;
    setAttempts(current => ({ ...current, [key]: { ...attempt, answers: { ...attempt.answers, [String(currentQuestion.id)]: value } } }));
  };
  const submit = async () => {
    if (!activeTest || !attempt || attempt.submittedAt) return;
    const submittedAt = Date.now();
    if (attempt.submissionId && supabase) {
      const { error } = await supabase.from("assessment_submissions")
        .update({ answers: attempt.answers, reviewed_questions: attempt.reviewedQuestions ?? [], status: "submitted", submitted_at: new Date(submittedAt).toISOString() })
        .eq("id", attempt.submissionId);
      if (error) { setNotice("Submission could not reach the server. Keep this page open and retry."); return; }
    }
    const key = activeTest.id ?? activeTest.name;
    setAttempts(current => ({ ...current, [key]: { ...attempt, submittedAt } }));
    setConfirmSubmit(false);
    setNotice("");
  };
  const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (activeTest && attempt) {
    if (notice) { /* Keep sync feedback visible while the attempt is open. */ }
    const submitted = Boolean(attempt.submittedAt);
    const expired = !submitted && remainingSeconds <= 0;
    return <section className="student-workspace">
      <AnimatePresence>{fortress.isBlackout && <motion.div className="fortress-blackout" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} role="alert" aria-live="assertive"><div className="fortress-sigil"><ShieldCheck size={34}/></div><span className="panel-kicker">CEREBRIX / EXAM INTEGRITY</span><h2>FOCUS INTERRUPTED</h2><p>Your exam session lost focus or a capture shortcut was detected.</p><div className="fortress-warning-count">WARNINGS <strong>{fortress.warnings.toString().padStart(2,"0")}</strong></div><button className="primary-btn" onClick={() => { void fortress.resumeExam(); }}>Return to exam <ArrowRight size={15}/></button><small>Browser-based capture detection is best-effort and cannot block operating-system screenshots.</small></motion.div>}</AnimatePresence>
      <button className="student-back" onClick={() => { setActiveName(null); setConfirmSubmit(false); }}><ArrowLeft size={15}/> All assessments</button>
      <div className="student-exam-header"><div><span className="panel-kicker">CEREBRIX / STUDENT EXAM</span><h2>{activeTest.name}</h2><p>{activeTest.subject} · {activeTest.totalMarks} marks · {activeTest.questions.length} questions{(activeTest.negativeMarking ?? 0) > 0 ? ` · −${activeTest.negativeMarking} per wrong answer` : ""}</p></div><div className={remainingSeconds < 300 && !submitted ? "exam-timer urgent" : "exam-timer"}><Clock3 size={17}/><div><small>{submitted ? "STATUS" : "TIME REMAINING"}</small><strong>{submitted ? "Submitted" : formatTime(remainingSeconds)}</strong></div></div></div>
      {notice && <div className="notice"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss warning">×</button></div>}
      {submitted ? <div className="exam-complete"><CheckCircle2 size={34}/><h3>Submission recorded</h3><p>{attempt.submissionId ? "Your answers have been submitted to your teacher and saved to the shared workspace." : "Your answers are saved locally in this preview and have not been sent to a teacher."}</p><button className="primary-btn" onClick={() => setActiveName(null)}>Back to assessments <ArrowRight size={15}/></button></div> : <>
        <div className="exam-integrity-note"><ShieldCheck size={16}/><span><strong>Work carefully, save as you go.</strong> {attempt.submissionId ? "Answers sync to the shared workspace as you work. The server records your submission." : "Answers autosave to this browser. This preview does not provide server-enforced timing or online submission."}</span></div>
        <motion.div className="exam-layout" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{duration:.32,ease:"easeOut"}}><motion.aside className="exam-question-nav" initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{duration:.28,delay:.04}}><span className="panel-kicker">QUESTIONS</span><div>{activeTest.questions.map((q, i) => <button key={q.id} className={[questionIndex === i ? "current" : "", attempt.reviewedQuestions?.includes(String(q.id)) ? "review-marked" : ""].filter(Boolean).join(" ")} onClick={() => setQuestionIndex(i)}><span>{String(i + 1).padStart(2, "0")}</span><i className={[attempt.answers[String(q.id)]?.trim() ? "answered" : "", attempt.reviewedQuestions?.includes(String(q.id)) ? "review-marked" : ""].filter(Boolean).join(" ")}/></button>)}</div><p>{activeTest.questions.filter(q => attempt.answers[String(q.id)]?.trim()).length} of {activeTest.questions.length} answered</p></motion.aside>
          <motion.article className="exam-question-panel" initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} transition={{duration:.28,delay:.08}}><div className="exam-question-meta"><span>QUESTION {String(questionIndex + 1).padStart(2, "0")} / {String(activeTest.questions.length).padStart(2, "0")}</span><b>{currentQuestion?.marks} marks</b></div><h3>{currentQuestion?.title.trim() || `Question ${questionIndex + 1}`}</h3><p className="exam-prompt">{currentQuestion?.prompt}</p>{currentQuestion?.dataset.trim() && <div className="exam-dataset"><span>STARTER DATA / REFERENCE</span><pre>{currentQuestion.dataset}</pre></div>}<label className="exam-answer-label">YOUR ANSWER <span>{currentQuestion?.kind === "Theory" ? "TEXT RESPONSE" : "SCRIPT MODE · NO EXECUTION"}</span>{currentQuestion?.kind === "Theory" ? <textarea value={currentQuestion ? attempt.answers[String(currentQuestion.id)] || "" : ""} onChange={e => updateAnswer(e.target.value)} placeholder="Write your answer here…" rows={11} spellCheck={false}/> : currentQuestion?.kind === "MCQ" ? <div className="mcq-student-options">{(currentQuestion.options ?? []).filter(option => option.trim()).map((option, optionIndex) => { const letter = String.fromCharCode(65 + optionIndex); return <label key={letter} className={attempt.answers[String(currentQuestion.id)] === letter ? "mcq-student-option selected" : "mcq-student-option"}><input type="radio" name={`question-${currentQuestion.id}`} value={letter} checked={attempt.answers[String(currentQuestion.id)] === letter} onChange={() => updateAnswer(letter)} disabled={submitted || remainingSeconds <= 0}/><span className="mcq-option-letter">{letter}</span><span>{option}</span></label>; })}{!(currentQuestion.options ?? []).some(option => option.trim()) && <p className="mcq-empty-options">Your teacher has not added answer options for this question yet.</p>}</div> : <div className="exam-monaco-shell"><div className="exam-monaco-toolbar"><span><i/> solution.{currentQuestion?.kind === "MySQL" ? "sql" : currentQuestion?.kind === "Python" || currentQuestion?.kind === "Debugging" ? "py" : "txt"}</span><span>EDIT ONLY · EXECUTION DISABLED</span></div><Editor height="360px" language={currentQuestion?.kind === "Python" || currentQuestion?.kind === "Debugging" ? "python" : currentQuestion?.kind === "MySQL" ? "sql" : "plaintext"} theme="vs-dark" value={currentQuestion ? attempt.answers[String(currentQuestion.id)] || "" : ""} onChange={value => updateAnswer(value ?? "")} options={{fontFamily:"JetBrains Mono, monospace",fontSize:14,lineNumbers:"on",minimap:{enabled:false},scrollBeyondLastLine:false,smoothScrolling:true,cursorBlinking:"smooth",automaticLayout:true,wordWrap:"on",readOnly:submitted || remainingSeconds <= 0,contextmenu:false,quickSuggestions:false,suggestOnTriggerCharacters:false,parameterHints:{enabled:false},lightbulb:{enabled:"off"},renderLineHighlight:"all",padding:{top:16,bottom:16}}}/></div>}</label><div className="exam-question-actions"><button className={attempt.reviewedQuestions?.includes(String(currentQuestion?.id)) ? "review-flag-btn active" : "review-flag-btn"} onClick={toggleReview} disabled={submitted || remainingSeconds <= 0}><ShieldCheck size={14}/>{attempt.reviewedQuestions?.includes(String(currentQuestion?.id)) ? "Marked for review" : "Mark for review"}</button><button className="secondary-btn" disabled={questionIndex === 0} onClick={() => setQuestionIndex(i => Math.max(0, i - 1))}><ArrowLeft size={14}/> Previous</button>{questionIndex < activeTest.questions.length - 1 ? <button className="primary-btn" onClick={() => setQuestionIndex(i => Math.min(activeTest.questions.length - 1, i + 1))}>Next question <ArrowRight size={14}/></button> : <button className="primary-btn" onClick={() => setConfirmSubmit(true)}><Send size={14}/> Review & submit</button>}</div></motion.article>
        </motion.div>
        {confirmSubmit && <div className="exam-confirm"><div><strong>Submit this attempt?</strong><p>{activeTest.questions.filter(q => attempt.answers[String(q.id)]?.trim()).length} of {activeTest.questions.length} questions have answers. You can’t edit after submitting.</p></div><button className="secondary-btn" onClick={() => setConfirmSubmit(false)}>Keep working</button><button className="primary-btn" onClick={submit}>Submit attempt <Send size={14}/></button></div>}
        {expired && <div className="exam-expired"><Clock3 size={15}/> Time limit reached. Editing is paused in this preview; use Review & submit to record the attempt locally.</div>}
      </>}
    </section>;
  }

  return <section className="student-workspace"><div className="student-exam-header"><div><span className="panel-kicker">CEREBRIX / STUDENT PORTAL</span><h2>Your assessments<span className="heading-period">.</span></h2><p>Pick up an available assessment and work through it at your own pace.</p></div><div className="student-count"><FileCode2 size={18}/><strong>{available.length}</strong><span>available</span></div></div>
    {notice && <div className="notice"><ShieldCheck size={16}/><span>{notice}</span></div>}
    <div className="student-preview-banner"><ShieldCheck size={18}/><div><strong>Student workspace</strong><p>Available assessments are loaded from your authenticated workspace. Submissions sync to the database when connected.</p></div></div>
    {available.length ? <div className="student-assessment-grid">{available.map(test => { const saved = attempts[test.name]; const done = Boolean(saved?.submittedAt); const answered = saved ? Object.values(saved.answers).filter(v => v.trim()).length : 0; return <article className="student-assessment-card" key={test.name}><div className="student-card-icon"><FileCode2 size={19}/></div><span className={done ? "student-state done" : saved ? "student-state progress" : "student-state"}>{done ? "Submitted" : saved ? "In progress" : "Available"}</span><h3>{test.name}</h3><p>{test.subject}</p><div className="student-card-meta"><span><Clock3 size={14}/>{test.duration} min</span><span><CheckCircle2 size={14}/>{test.questionCount} questions</span><span>{test.totalMarks} marks</span></div>{saved && !done && <div className="student-saved-progress">{answered} questions answered</div>}<button className="primary-btn" onClick={() => begin(test)}>{done ? "View submission" : saved ? "Resume assessment" : "Start assessment"} <ArrowRight size={15}/></button></article>; })}</div> : <div className="student-empty"><div className="student-empty-icon"><FileCode2 size={25}/></div><h3>No assessments available yet</h3><p>When a teacher schedules an assessment with questions, it will appear here.</p></div>}
  </section>;
}
