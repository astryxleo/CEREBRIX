import { useMemo, useState } from "react";
import { CalendarDays, Clock3, FileCode2, MoreHorizontal, Plus, Search, SlidersHorizontal } from "lucide-react";
import type { BuilderTest } from "./TestBuilder";

type Props = { tests: BuilderTest[]; onCreate: () => void; onOpen: (test: BuilderTest) => void };
type Filter = "All" | "Scheduled" | "Draft";
export default function TeacherTests({ tests, onCreate, onOpen }: Props) {
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => tests.filter(test => (filter === "All" || test.status === filter) && (test.name + " " + test.subject).toLowerCase().includes(query.trim().toLowerCase())).sort((a,b) => new Date(b.scheduledAt || 0).getTime() - new Date(a.scheduledAt || 0).getTime()), [tests, filter, query]);
  const counts = { All: tests.length, Scheduled: tests.filter(t => t.status === "Scheduled").length, Draft: tests.filter(t => t.status === "Draft").length };
  return <section className="teacher-tests">
    <div className="student-exam-header"><div><span className="panel-kicker">CEREBRIX / ASSESSMENT LIBRARY</span><h2>Test management<span className="heading-period">.</span></h2><p>Review your assessments, find drafts, and open the details of a test.</p></div><button className="primary-btn" onClick={onCreate}><Plus size={15}/> Create assessment</button></div>
    <div className="tests-toolbar"><label className="tests-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by title or subject…"/></label><div className="tests-filters"><SlidersHorizontal size={15}/>{(["All", "Scheduled", "Draft"] as Filter[]).map(item => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}<span>{counts[item]}</span></button>)}</div></div>
    {filtered.length ? <div className="tests-library">{filtered.map(test => <article className="tests-library-card" key={test.name + test.scheduledAt}><div className="tests-library-icon"><FileCode2 size={19}/></div><div className="tests-library-main"><div className="tests-library-title"><h3>{test.name}</h3><span className={test.status === "Scheduled" ? "badge scheduled" : "badge draft"}><i/>{test.status}</span></div><p>{test.subject}</p><div className="tests-library-meta"><span><Clock3 size={13}/>{test.duration} min</span><span><FileCode2 size={13}/>{test.questionCount} questions</span><span>{test.totalMarks} marks</span><span><CalendarDays size={13}/>{test.date}</span></div></div><button className="row-more" onClick={() => onOpen(test)} aria-label={"Open " + test.name}><MoreHorizontal size={18}/></button><button className="secondary-btn tests-open" onClick={() => onOpen(test)}>View details</button></article>)}</div> : <div className="student-empty"><div className="student-empty-icon"><FileCode2 size={25}/></div><h3>{tests.length ? "No matching assessments" : "Your assessment library is empty"}</h3><p>{tests.length ? "Try another search term or switch the status filter." : "Create your first assessment to start building your programming test library."}</p>{!tests.length && <button className="primary-btn" onClick={onCreate}><Plus size={15}/> Create assessment</button>}</div>}
    <p className="tests-library-footnote">These assessments are currently stored in this browser only. Cross-device access requires the connected database.</p>
  </section>;
}
