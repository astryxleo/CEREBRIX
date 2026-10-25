import { CalendarDays, Clock3, FileCode2, Trash2, X } from "lucide-react";
import type { BuilderTest } from "./TestBuilder";

type Props = {
  test: BuilderTest;
  onClose: () => void;
  onDelete: (test: BuilderTest) => void;
};

export default function TestDetails({ test, onClose, onDelete }: Props) {
  return <div className="modal-backdrop details-backdrop" onClick={onClose}>
    <section className="test-details-modal" role="dialog" aria-modal="true" aria-labelledby="test-details-title" onClick={event => event.stopPropagation()}>
      <header className="details-header">
        <div className="builder-brand-icon"><FileCode2 size={20}/></div>
        <div className="builder-heading"><span className="panel-kicker">CEREBRIX / TEST MANAGEMENT</span><h2 id="test-details-title">{test.name}</h2><p>{test.subject}</p></div>
        <button className="icon-btn" onClick={onClose} aria-label="Close test details"><X size={19}/></button>
      </header>
      <div className="details-metrics">
        <div><span>STATUS</span><strong className={`details-status ${test.status.toLowerCase()}`}>{test.status}</strong></div>
        <div><span>TOTAL MARKS</span><strong>{test.totalMarks ?? "—"}</strong></div>
        <div><span>DURATION</span><strong>{test.duration ? `${test.duration} min` : "—"}</strong></div>
        <div><span>QUESTIONS</span><strong>{test.questionCount ?? 0}</strong></div>
      </div>
      <div className="details-schedule"><CalendarDays size={16}/><span>{test.date}</span><Clock3 size={16}/><span>{test.deadline ? `Closes ${new Date(test.deadline).toLocaleString([], {dateStyle:"medium",timeStyle:"short"})}` : "No closing deadline"}</span></div>
      {test.instructions && <div className="details-instructions"><span className="panel-kicker">STUDENT INSTRUCTIONS</span><p>{test.instructions}</p></div>}
      <div className="details-question-list"><div className="panel-kicker">QUESTION SET</div>
        {test.questions?.length ? test.questions.map((question, index) => <article className="details-question" key={question.id}>
          <div className="details-question-number">{String(index + 1).padStart(2, "0")}</div>
          <div className="details-question-copy"><strong>{question.title.trim() || `Question ${index + 1}`}</strong><span>{question.kind} · {question.marks} marks</span><p>{question.prompt}</p>{question.dataset && <small>Starter dataset included</small>}</div>
        </article>) : <p className="details-demo-note">This is a sample assessment in the dashboard preview. Its questions are not stored in this browser.</p>}
      </div>
      <footer className="details-footer"><span>{test.id ? "Saved in the shared workspace" : "Sample assessment preview"}</span><div><button className="secondary-btn" onClick={onClose}>Close</button><button className="danger-btn" onClick={() => onDelete(test)}><Trash2 size={15}/> Delete test</button></div></footer>
    </section>
  </div>;
}
