import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, SlidersHorizontal, Copy, Check, RefreshCw, CircleHelp, Layers3 } from "lucide-react";
import { supabase } from "./lib/supabase";

type BankQuestion = {
  id: string;
  position: number;
  kind: string;
  title: string | null;
  prompt: string;
  marks: number;
  options: unknown;
  dataset: string | null;
  starter_content: string | null;
  assessment_title: string;
  subject: string;
};

export default function QuestionBank({ teacherId }: { teacherId: string }) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [kind, setKind] = useState("all");
  const [copiedId, setCopiedId] = useState("");

  const loadQuestions = async () => {
    if (!supabase) { setError("Question Bank is unavailable because the workspace database is not configured."); setLoading(false); return; }
    setLoading(true); setError("");
    const { data, error: loadError } = await supabase
      .from("assessments")
      .select("id,title,subject,assessment_questions(id,position,kind,title,prompt,marks,options,dataset,starter_content)")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    if (loadError) {
      setError("Questions could not be loaded. Check your teacher access and try again.");
      setQuestions([]);
    } else {
      const rows: BankQuestion[] = [];
      for (const assessment of data ?? []) {
        for (const q of (assessment.assessment_questions ?? []) as any[]) {
          rows.push({
            id: q.id, position: Number(q.position ?? 0), kind: q.kind ?? "coding",
            title: q.title ?? "", prompt: q.prompt ?? "", marks: Number(q.marks ?? 0),
            options: q.options ?? [], dataset: q.dataset ?? "", starter_content: q.starter_content ?? "",
            assessment_title: assessment.title ?? "Untitled assessment", subject: assessment.subject ?? "General"
          });
        }
      }
      setQuestions(rows);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadQuestions();
    if (!supabase) return;
    const channel = supabase.channel(`cerebrix-question-bank-${teacherId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assessments", filter: `teacher_id=eq.${teacherId}` }, () => { void loadQuestions(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "assessment_questions" }, () => { void loadQuestions(); })
      .subscribe();
    return () => { void supabase!.removeChannel(channel); };
  }, [teacherId]);

  const subjects = useMemo(() => ["all", ...Array.from(new Set(questions.map(q => q.subject).filter(Boolean))).sort()], [questions]);
  const kinds = useMemo(() => ["all", ...Array.from(new Set(questions.map(q => q.kind).filter(Boolean))).sort()], [questions]);
  const visible = useMemo(() => questions.filter(q => {
    const haystack = [q.title, q.prompt, q.assessment_title, q.subject, q.kind].join(" ").toLowerCase();
    return (subject === "all" || q.subject === subject) && (kind === "all" || q.kind === kind) && haystack.includes(query.trim().toLowerCase());
  }), [questions, subject, kind, query]);

  const copyQuestion = async (question: BankQuestion) => {
    const optionLines = Array.isArray(question.options) ? question.options.map((option, index) => {
      const label = String.fromCharCode(65 + index);
      const value = typeof option === "object" && option !== null ? String((option as any).text ?? (option as any).label ?? JSON.stringify(option)) : String(option);
      return value.trim() ? `${label}. ${value}` : "";
    }).filter(Boolean) : [];
    const text = [
      question.title || `Question ${question.position}`,
      `Type: ${question.kind} | Marks: ${question.marks} | Subject: ${question.subject}`,
      question.prompt,
      optionLines.length ? `Options:\n${optionLines.join("\n")}` : "",
      question.starter_content ? `Starter content:\n${question.starter_content}` : "",
      question.dataset ? `Dataset:\n${question.dataset}` : ""
    ].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(question.id);
      window.setTimeout(() => setCopiedId(current => current === question.id ? "" : current), 1800);
    } catch {
      setError("Clipboard access was blocked by the browser. Select and copy the question text instead.");
    }
  };

  return <section className="question-bank-page">
    <div className="question-bank-hero">
      <div className="question-bank-hero-icon"><BookOpen size={23}/></div>
      <div><span className="panel-kicker">TEACHER TOOLKIT / REUSABLE CONTENT</span><h2>Your question library<span>.</span></h2><p>Search questions from your saved assessments, filter by subject or type, and copy prompts for reuse.</p></div>
      <div className="question-bank-total"><strong>{questions.length}</strong><span>QUESTIONS</span></div>
    </div>
    <div className="question-bank-toolbar">
      <label className="question-bank-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search prompts, tests, or subjects…" aria-label="Search questions"/></label>
      <label className="question-bank-filter"><SlidersHorizontal size={15}/><select value={subject} onChange={e => setSubject(e.target.value)} aria-label="Filter by subject">{subjects.map(value => <option key={value} value={value}>{value === "all" ? "All subjects" : value}</option>)}</select></label>
      <label className="question-bank-filter"><Layers3 size={15}/><select value={kind} onChange={e => setKind(e.target.value)} aria-label="Filter by question type">{kinds.map(value => <option key={value} value={value}>{value === "all" ? "All question types" : value.replaceAll("_", " ")}</option>)}</select></label>
      <button className="question-bank-refresh" onClick={() => void loadQuestions()} disabled={loading}><RefreshCw size={14} className={loading ? "question-bank-spin" : ""}/> Refresh</button>
    </div>
    {error && <div className="question-bank-error" role="alert">{error}</div>}
    <div className="question-bank-results-head"><span>{loading ? "Loading library…" : `Showing ${visible.length} of ${questions.length} questions`}</span><span>Synced from your saved assessments</span></div>
    {loading ? <div className="question-bank-empty"><RefreshCw size={21} className="question-bank-spin"/><strong>Loading your library</strong><p>Gathering questions from your assessments.</p></div> : visible.length === 0 ? <div className="question-bank-empty"><CircleHelp size={25}/><strong>{questions.length ? "No questions match these filters" : "Your library is ready for its first question"}</strong><p>{questions.length ? "Try a different search or clear one of the filters." : "Create an assessment and add questions. Saved questions will automatically appear here."}</p>{(query || subject !== "all" || kind !== "all") && <button onClick={() => { setQuery(""); setSubject("all"); setKind("all"); }}>Clear filters</button>}</div> : <div className="question-bank-grid">{visible.map((q, index) => <article className="question-bank-card" key={q.id}><div className="question-bank-card-top"><span className="question-bank-index">Q{String(index + 1).padStart(2, "0")}</span><span className="question-bank-kind">{q.kind.replaceAll("_", " ")}</span><span className="question-bank-marks">{q.marks} {q.marks === 1 ? "mark" : "marks"}</span></div><h3>{q.title || `Question ${q.position}`}</h3><p className="question-bank-prompt">{q.prompt}</p>{Array.isArray(q.options) && q.options.length > 0 && <div className="question-bank-options">{q.options.slice(0, 5).map((option, i) => <span key={i}>{String(typeof option === "object" && option !== null ? (option as any).text ?? (option as any).label ?? JSON.stringify(option) : option)}</span>)}</div>}{(q.starter_content || q.dataset) && <div className="question-bank-dataset"><span>{q.starter_content ? "STARTER CONTENT" : "DATASET"}</span><pre>{(q.starter_content || q.dataset || "").slice(0, 280)}{(q.starter_content || q.dataset || "").length > 280 ? "…" : ""}</pre>{q.starter_content && q.dataset && <pre>{q.dataset.slice(0, 180)}{q.dataset.length > 180 ? "…" : ""}</pre>}</div>}<div className="question-bank-card-foot"><div><strong>{q.assessment_title}</strong><span>{q.subject}</span></div><button onClick={() => void copyQuestion(q)} aria-label={copiedId === q.id ? "Question copied" : "Copy question"}>{copiedId === q.id ? <Check size={15}/> : <Copy size={15}/>} {copiedId === q.id ? "Copied" : "Copy prompt"}</button></div></article>)}</div>}
  </section>;
}
