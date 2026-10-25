import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, Clock3, FileCode2, Plus, Save, Trash2, X } from "lucide-react";

export type BuilderTest = {
  id?: string;
  name: string;
  subject: string;
  status: string;
  date: string;
  students: string;
  progress: number;
  accent: string;
  totalMarks: number;
  negativeMarking?: number;
  duration: number;
  scheduledAt: string;
  deadline: string;
  instructions: string;
  questionCount: number;
  questions: BuilderQuestion[];
};
export type BuilderQuestion = {
  id: number;
  kind: string;
  title: string;
  prompt: string;
  marks: number;
  referenceAnswer: string;
  dataset: string;
  options?: string[];
};

const kinds = [
  { value: "Python", label: "Python", hint: "Python programming and code-writing questions" },
  { value: "MySQL", label: "MySQL", hint: "SQL queries, tables and database reasoning" },
  { value: "MCQ", label: "MCQ", hint: "Single-answer multiple-choice questions" },
  { value: "Theory", label: "Theory", hint: "Conceptual explanations and written answers" },
];

type Props = { onClose: () => void; onSave: (test: BuilderTest) => Promise<boolean | void> | boolean | void };
const makeQuestion = (id: number): BuilderQuestion => ({ id, kind: "Python", title: "", prompt: "", marks: 5, referenceAnswer: "", dataset: "", options: ["", "", "", ""] });

export default function TestBuilder({ onClose, onSave }: Props) {
  const [step, setStep] = useState<"details" | "questions">("details");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("Python");
  const [duration, setDuration] = useState(45);
  const [negativeMarking, setNegativeMarking] = useState(0);
  const [scheduledAt, setScheduledAt] = useState("");
  const [deadline, setDeadline] = useState("");
  const [instructions, setInstructions] = useState("Read each question carefully. Save your work before submitting.");
  const [questions, setQuestions] = useState<BuilderQuestion[]>([makeQuestion(1)]);
  const [publish, setPublish] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const totalMarks = useMemo(() => questions.reduce((sum, q) => sum + Math.max(0, Number(q.marks) || 0), 0), [questions]);
  const patchQuestion = (id: number, patch: Partial<BuilderQuestion>) => setQuestions(current => current.map(q => q.id === id ? { ...q, ...patch } : q));
  const addQuestion = () => setQuestions(current => [...current, makeQuestion(Math.max(0, ...current.map(q => q.id)) + 1)]);
  const save = async (shouldPublish: boolean) => {
    if (!name.trim()) { setError("Give this assessment a name first."); setStep("details"); return; }
    if (!questions.length || questions.some(q => !q.prompt.trim())) { setError("Add the question prompt for every question before saving."); setStep("questions"); return; }
    if (shouldPublish && !scheduledAt) { setError("Choose a start date and time before scheduling this test."); setStep("details"); return; }
    if (shouldPublish && scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) { setError("Choose a future opening date and time."); setStep("details"); return; }
    if (shouldPublish && deadline && scheduledAt && new Date(deadline).getTime() <= new Date(scheduledAt).getTime()) { setError("The closing time must be later than the opening time."); setStep("details"); return; }
    if (shouldPublish && deadline && new Date(deadline).getTime() <= Date.now()) { setError("Choose a future closing date and time."); setStep("details"); return; }
    const date = scheduledAt ? new Date(scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Draft · Not scheduled";
    setSaving(true);
    setError("");
    try {
      const saved = await onSave({
        name: name.trim(), subject,
        status: shouldPublish ? "Scheduled" : "Draft", date, students: "0 enrolled", progress: 0,
        accent: subject === "MySQL" ? "cyan" : "blue",
        totalMarks, negativeMarking, duration, scheduledAt, deadline, instructions, questionCount: questions.length, questions,
      });
      if (saved === false) return;
      onClose();
    } catch {
      setError("The assessment could not be saved. Your draft is still open; please try again.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="modal-backdrop builder-backdrop" onClick={() => { if (!saving) onClose(); }}>
    <section className="test-builder" role="dialog" aria-modal="true" aria-labelledby="builder-title" onClick={e => e.stopPropagation()}>
      <header className="builder-header">
        <div className="builder-brand-icon"><FileCode2 size={20}/></div>
        <div className="builder-heading"><span className="panel-kicker">CEREBRIX / ASSESSMENT STUDIO</span><h2 id="builder-title">Test Builder</h2><p>Build a structured programming assessment, question by question.</p></div>
        <button className="icon-btn" onClick={onClose} aria-label="Close builder" disabled={saving}><X size={19}/></button>
      </header>
      <div className="builder-stepbar">
        <button className={step === "details" ? "current" : "complete"} onClick={() => setStep("details")}><span>01</span> Test setup</button>
        <div className="step-connector"/>
        <button className={step === "questions" ? "current" : ""} onClick={() => setStep("questions")}><span>02</span> Questions & marks <b>{questions.length}</b></button>
      </div>
      {error && <div className="builder-error">{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={14}/></button></div>}
      <div className="builder-body">
        {step === "details" ? <div className="builder-form-grid">
          <div className="builder-section-intro"><span className="panel-kicker">ASSESSMENT CONFIGURATION</span><h3>Set the rules of the test.</h3><p>Give students a clear brief, then control when the assessment opens and how long they have.</p></div>
          <label className="builder-field full">Test name <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Python File Handling Practical" /></label>
          <label className="builder-field">Primary question format <span className="select-wrap"><select value={subject} onChange={e => setSubject(e.target.value)}>{kinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select><ChevronDown size={15}/></span><small>{kinds.find(k => k.value === subject)?.hint || "Combine multiple programming and file formats."}</small></label>
          <label className="builder-field">Negative marking <span className="input-suffix"><input type="number" min={0} max={1000} step={0.25} value={negativeMarking} onChange={e => setNegativeMarking(Math.max(0, Number(e.target.value) || 0))}/><span>marks per wrong answer</span></span><small>Set to 0 to disable deductions.</small></label>
          <label className="builder-field">Time limit <span className="input-suffix"><input type="number" min={1} max={600} value={duration} onChange={e => setDuration(Math.max(1, Number(e.target.value) || 1))}/><span>minutes</span></span><small>Timer starts when a student begins.</small></label>
          <label className="builder-field">Opens at <span className="input-with-icon"><CalendarDays size={15}/><input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}/></span><small>Leave empty to keep it as a draft.</small></label>
          <label className="builder-field">Closes at (optional) <span className="input-with-icon"><Clock3 size={15}/><input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}/></span><small>{deadline ? "Closing time selected." : "Set an availability deadline."}</small></label>
          <label className="builder-field full">Student instructions <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} placeholder="Rules, allowed resources, submission notes…"/></label>
          <div className="builder-integrity full"><div><Check size={16}/></div><span><strong>Assessment integrity defaults</strong><small>Student code is treated as submitted text. This UI does not execute student code in the browser; secure server-side sandbox grading must be configured separately.</small></span></div>
          <div className="builder-summary full"><div><span>QUESTION COUNT</span><strong>{questions.length}</strong></div><div><span>TOTAL MARKS</span><strong>{totalMarks}</strong></div><div><span>WRONG ANSWER</span><strong>{negativeMarking}</strong></div><div><span>DURATION</span><strong>{duration} <small>min</small></strong></div></div>
        </div> : <div className="question-editor">
          <div className="question-editor-heading"><div><span className="panel-kicker">QUESTION DESIGN</span><h3>Build the question set.</h3><p>Each question has its own format, prompt, reference answer and marks.</p></div><button className="builder-add-btn" onClick={addQuestion}><Plus size={15}/> Add question</button></div>
          {questions.map((q, index) => <article className="question-card" key={q.id}>
            <div className="question-card-top"><div className="question-number">{String(index + 1).padStart(2, "0")}</div><div className="question-card-title"><strong>Question {index + 1}</strong><span>{q.kind} · {q.marks} marks</span></div><label className="marks-control">MARKS <input aria-label={"Marks for question " + (index + 1)} type="number" min={0} max={1000} value={q.marks} onChange={e => patchQuestion(q.id, { marks: Math.max(0, Number(e.target.value) || 0) })}/></label><button className="builder-icon-danger" onClick={() => setQuestions(current => current.filter(item => item.id !== q.id))} disabled={questions.length === 1} aria-label={"Remove question " + (index + 1)}><Trash2 size={15}/></button></div>
            <div className="question-fields"><label className="builder-field">Question title <input value={q.title} onChange={e => patchQuestion(q.id, { title: e.target.value })} placeholder="e.g. Filter records by score"/></label><label className="builder-field">Question type <span className="select-wrap"><select value={q.kind} onChange={e => patchQuestion(q.id, { kind: e.target.value })}>{kinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select><ChevronDown size={15}/></span></label><label className="builder-field full">Prompt / task description <textarea rows={4} value={q.prompt} onChange={e => patchQuestion(q.id, { prompt: e.target.value })} placeholder={q.kind === "MySQL" ? "Write a query that… Include table names and expected output." : q.kind === "Theory" ? "Explain the concept or answer the question…" : "Write the exact task students must solve…"} /></label>{q.kind === "MCQ" && <div className="builder-field full mcq-option-editor"><span className="mcq-options-label">ANSWER OPTIONS</span>{(q.options ?? ["", "", "", ""]).map((option, optionIndex) => <label key={optionIndex} className="mcq-option-row"><span>{String.fromCharCode(65 + optionIndex)}</span><input value={option} onChange={e => patchQuestion(q.id, { options: (q.options ?? ["", "", "", ""]).map((item, index) => index === optionIndex ? e.target.value : item) })} placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}/></label>)}<small>Put the correct option letter in the teacher-only reference answer, e.g. A.</small></div>}<label className="builder-field full">Reference answer / marking guide <textarea rows={3} value={q.referenceAnswer} onChange={e => patchQuestion(q.id, { referenceAnswer: e.target.value })} placeholder="Teacher-only reference solution or rubric…"/></label><label className="builder-field full">Dataset / starter content (optional) <textarea rows={2} value={q.dataset} onChange={e => patchQuestion(q.id, { dataset: e.target.value })} placeholder="Optional starter code, sample data, table schema, or context…"/></label></div>
          </article>)}
          <button className="builder-add-wide" onClick={addQuestion}><Plus size={16}/> Add another question</button>
          <div className="builder-total"><span>Total assessment marks</span><strong>{totalMarks} <small>marks</small></strong></div>
        </div>}
      </div>
      <footer className="builder-footer"><div className="builder-footer-meta"><span><span className="status-dot"/>{publish ? "Ready to schedule" : "Changes stay in this session"}</span><strong>{totalMarks} marks <i/> {duration} min</strong></div><div className="builder-footer-actions"><button className="secondary-btn" onClick={onClose} disabled={saving}>Cancel</button>{step === "details" ? <button className="primary-btn" onClick={() => { setError(""); setStep("questions"); }}>Continue to questions <ChevronDown size={15}/></button> : <><button className="secondary-btn save-draft-btn" onClick={() => void save(false)} disabled={saving}><Save size={15}/> {saving ? "Saving…" : "Save draft"}</button><button className="primary-btn" onClick={() => { setPublish(true); void save(true); }} disabled={saving}><CalendarDays size={15}/> {saving ? "Saving…" : "Schedule test"}</button></>}</div></footer>
    </section>
  </div>;
}
