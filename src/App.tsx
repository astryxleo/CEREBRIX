import { useEffect, useState } from "react";
import TestBuilder, { type BuilderTest } from "./TestBuilder";
import TestDetails from "./TestDetails";
import StudentExam from "./StudentExam";
import TeacherSubmissions from "./TeacherSubmissions";
import TeacherAnalytics from "./TeacherAnalytics";
import TeacherTests from "./TeacherTests";
import StudentDirectory from "./StudentDirectory";
import { supabase } from "./lib/supabase";
import { Activity, ArrowRight, ArrowUpRight, Bell, BookOpen, BrainCircuit, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Code2, FileCode2, Filter, FlaskConical, Gauge, GraduationCap, LayoutDashboard, Menu, MoreHorizontal, Plus, Search, ShieldCheck, Sparkles, Terminal, Users, X } from "lucide-react";

type Tab = "Overview" | "Tests" | "Submissions" | "Students" | "Analytics";
const nav: {label: Tab; icon: typeof LayoutDashboard}[] = [
  {label:"Overview",icon:LayoutDashboard},{label:"Tests",icon:FileCode2},{label:"Submissions",icon:Code2},{label:"Students",icon:Users},{label:"Analytics",icon:Activity}
];
const tests: BuilderTest[] = [];
function Brand(){return <div className="brand"><div className="brand-mark"><img src="/cerebrix.png" alt="" /></div><div><strong>CEREBRIX</strong><span>THINK. CODE. PROVE.</span></div></div>}
function App({ user, profile, signOut }: { user: { id: string; email?: string }; profile: { display_name: string; role: "student" | "teacher" }; signOut: () => Promise<void> }){
 const [active,setActive]=useState<Tab>("Overview");
 const role = profile.role === "teacher" ? "Teacher" : "Student";
 const [showCreate,setShowCreate]=useState(false);
 const [selectedTest,setSelectedTest]=useState<BuilderTest|null>(null);
 const [createdTests,setCreatedTests]=useState<BuilderTest[]>(()=>{try{const saved=localStorage.getItem("cerebrix.teacher.tests.v1");return saved?JSON.parse(saved) as BuilderTest[]:[]}catch{return []}});
 const [mobileNav,setMobileNav]=useState(false);
 const [query,setQuery]=useState("");
 const [notice,setNotice]=useState("");
 const [dashboardStats,setDashboardStats]=useState({scheduled:0,participants:0,pending:0,average:null as number|null});
 const allTests=[...createdTests,...tests];
 const filtered=allTests.filter(t=>(t.name+" "+t.subject).toLowerCase().includes(query.toLowerCase()));
 useEffect(()=>{try{localStorage.setItem("cerebrix.teacher.tests.v1",JSON.stringify(createdTests));}catch{/* Browser storage may be unavailable. */}},[createdTests]);
 useEffect(()=>{
  if(!supabase||role!=="Teacher")return;
  let alive=true;
  const loadStats=async()=>{
   const [{data:assessments,error:assessmentError},{data:submissions,error:submissionError}]=await Promise.all([
    supabase!.from("assessments").select("id,status"),
    supabase!.from("assessment_submissions").select("id,student_id,assessment_id,assessment_grades(score)").eq("status","submitted")
   ]);
   if(!alive)return;
   if(assessmentError||submissionError){setNotice("Some dashboard metrics could not be loaded from the shared workspace.");return;}
   const rows=submissions??[];
   const graded=rows.map((row:any)=>({row,grade:Array.isArray(row.assessment_grades)?row.assessment_grades[0]:row.assessment_grades})).filter((item:any)=>item.grade);
   const maxById=new Map(createdTests.filter(test=>test.id).map(test=>[test.id!,test.totalMarks||100]));
   const percentages=graded.map((item:any)=>Number(maxById.get(item.row.assessment_id)??100)>0?Number(item.grade.score)/Number(maxById.get(item.row.assessment_id)??100)*100:0);
   setDashboardStats({
    scheduled:(assessments??[]).filter((item:any)=>item.status==="scheduled"||item.status==="published").length,
    participants:new Set(rows.map((row:any)=>row.student_id)).size,
    pending:rows.length-graded.length,
    average:percentages.length?Math.round(percentages.reduce((sum:number,value:number)=>sum+value,0)/percentages.length):null
   });
  };
  void loadStats();
  return()=>{alive=false;};
 },[user.id,role,createdTests]);
 useEffect(()=>{
  if(!supabase)return;
  let alive=true;
  const loadAssessments=async()=>{
   const {data,error}=await supabase!.from("assessments").select("id,title,subject,instructions,duration_minutes,opens_at,closes_at,status,assessment_questions(id,position,kind,title,prompt,marks,starter_content,dataset,assessment_question_keys(reference_answer))").order("created_at",{ascending:false});
   if(!alive)return;
   if(error){setNotice("Could not load shared assessments. Check database access and your role.");return;}
   const mapped=(data??[]).map((row:any):BuilderTest=>{
    const questions=[...(row.assessment_questions??[])].sort((a:any,b:any)=>a.position-b.position);
    return {
     id:row.id,name:row.title,subject:row.subject,status:row.status==="scheduled"||row.status==="published"?"Scheduled":"Draft",
     date:row.opens_at?new Date(row.opens_at).toLocaleString():"Not scheduled",students:"—",progress:0,accent:"blue",
     totalMarks:questions.reduce((sum:number,q:any)=>sum+Number(q.marks||0),0),
     duration:row.duration_minutes,scheduledAt:row.opens_at??"",deadline:row.closes_at??"",instructions:row.instructions??"",
     questionCount:questions.length,
     questions:questions.map((q:any,index:number)=>({id:index+1,kind:q.kind,title:q.title??"",prompt:q.prompt,marks:Number(q.marks||5),referenceAnswer:Array.isArray(q.assessment_question_keys)?(q.assessment_question_keys[0]?.reference_answer??""):(q.assessment_question_keys?.reference_answer??""),dataset:q.dataset??""}))
    };
   });
   setCreatedTests(mapped);
  };
  void loadAssessments();
  return()=>{alive=false;};
 },[user.id,role]);
 return <div className="app-shell">
  <aside className={`sidebar ${mobileNav?"sidebar-open":""}`}>
   <div className="side-top"><Brand/><button className="icon-btn mobile-close" onClick={()=>setMobileNav(false)} aria-label="Close menu"><X size={18}/></button></div>
   <div className="workspace"><div className="workspace-avatar">CS</div><div className="workspace-copy"><strong>Computer Science</strong><span>School workspace</span></div><ChevronDown size={15}/></div>
   <div className="nav-label">WORKSPACE</div>
   <nav>{role === "Teacher" ? nav.map(({label,icon:Icon})=><button key={label} onClick={()=>{setActive(label);setMobileNav(false)}} className={`nav-item ${active===label?"active":""}`}><Icon size={17}/><span>{label}</span></button>) : <button className="nav-item active" onClick={()=>{setActive("Overview");setMobileNav(false)}}><GraduationCap size={17}/><span>My exams</span></button>}</nav>
   {role === "Teacher" && <><div className="nav-label tools-label">TOOLS</div>
   <button className="nav-item" onClick={()=>setNotice("Question bank is coming soon.")}><BookOpen size={17}/><span>Question bank</span><span className="soon">SOON</span></button>
   <button className="nav-item" onClick={()=>setNotice("Sandbox settings will be available when secure grading is configured.")}><FlaskConical size={17}/><span>Code sandbox</span></button></>}
   <div className="sidebar-bottom">
    <div className="security-card"><div className="security-icon"><ShieldCheck size={17}/></div><div><strong>Assessment integrity</strong><p>Built for focused, fair exams.</p></div><span className="status-dot"/></div>
    <button className="profile" onClick={()=>void signOut()} title="Sign out"><div className="profile-avatar">{(profile.display_name || user.email || "C").slice(0,1).toUpperCase()}</div><div className="profile-copy"><strong>{profile.display_name || user.email || "CEREBRIX user"}</strong><span>{role} account · Sign out</span></div><MoreHorizontal size={18}/></button>
   </div>
  </aside>
  {mobileNav&&<button className="scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
  <main className="main">
   <header className="topbar"><div className="top-left"><button className="icon-btn menu-btn" onClick={()=>setMobileNav(true)} aria-label="Open menu"><Menu size={19}/></button><div className="breadcrumb">Workspace <span>/</span> <b>{active}</b></div></div><div className="top-actions"><div className="status-pill"><span className="status-dot"/> All systems normal</div><button className="icon-btn help-btn" onClick={()=>setNotice("Help centre is coming soon.")} aria-label="Help"><CircleHelp size={18}/></button><button className="icon-btn notification-btn" onClick={()=>setNotice("You're all caught up.")} aria-label="Notifications"><Bell size={18}/><i/></button><div className="top-avatar">L</div></div></header>
   <div className="page">
    <div className="welcome-row"><div className="welcome-copy"><div className="eyebrow"><span className="eyebrow-line"/> YOUR ASSESSMENT COMMAND CENTER</div><h1>{active==="Overview"?"Good evening, Leo.":active}<span className="heading-period">.</span></h1><p className="page-sub">{active==="Overview"?"A clear view of your classroom, assessments, and student progress.":active==="Tests"?"Create, schedule, and manage programming assessments.":active==="Submissions"?"Review student work and keep grading moving.":active==="Students"?"Track participation and individual student progress.":"Understand class performance at a glance."}</p></div><div className="welcome-actions">{role === "Teacher" && <button className="primary-btn" onClick={()=>setShowCreate(true)}><Plus size={17}/> Create test</button>}</div></div>
    {notice&&<div className="notice"><Sparkles size={16}/><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}
{role === "Student" ? <StudentExam tests={createdTests} userId={user.id}/> : active === "Submissions" ? <TeacherSubmissions tests={createdTests} userId={user.id}/> : active === "Analytics" ? <TeacherAnalytics tests={createdTests} userId={user.id}/> : active === "Tests" ? <TeacherTests tests={createdTests} onCreate={() => setShowCreate(true)} onOpen={setSelectedTest}/> : active === "Students" ? <StudentDirectory/> : <>
    <section className="hero-emblem-panel"><div className="hero-emblem-glow"></div><div className="hero-emblem-orbit orbit-a"></div><div className="hero-emblem-orbit orbit-b"></div><div className="hero-emblem-orbit orbit-c"></div><div className="emblem-particle particle-a"></div><div className="emblem-particle particle-b"></div><div className="emblem-particle particle-c"></div><div className="hero-emblem"><img src="/cerebrix.png" alt="CEREBRIX emblem"/><div className="emblem-sheen"></div></div><div className="emblem-caption"><span className="emblem-caption-line"></span><div><strong>CEREBRIX</strong><small>INTELLIGENCE IN MOTION</small></div><span className="emblem-caption-line"></span></div><div className="emblem-coordinates coordinate-left">CBX / 001</div><div className="emblem-coordinates coordinate-right">SYSTEM ONLINE <i></i></div></section>
    <section className="metric-grid">
     <div className="metric-card"><div className="metric-top"><span className="metric-label">Active assessments</span><span className="metric-icon blue"><FileCode2 size={17}/></span></div><div className="metric-value">{String(dashboardStats.scheduled).padStart(2,"0")}</div><div className="metric-foot">From shared assessments <span className="foot-dot"/></div><div className="metric-line"><span style={{width:"66%"}}/></div></div>
     <div className="metric-card"><div className="metric-top"><span className="metric-label">Students participating</span><span className="metric-icon cyan"><Users size={17}/></span></div><div className="metric-value">{dashboardStats.participants} <span className="metric-unit">students</span></div><div className="metric-foot">Unique students with submissions</div><div className="metric-line cyan-line"><span style={{width:"78%"}}/></div></div>
     <div className="metric-card"><div className="metric-top"><span className="metric-label">Pending reviews</span><span className="metric-icon white"><Clock3 size={17}/></span></div><div className="metric-value">{String(dashboardStats.pending).padStart(2,"0")} <span className="metric-unit">to grade</span></div><div className="metric-foot">Keep your grading queue clear</div><div className="metric-line white-line"><span style={{width:"29%"}}/></div></div>
     <div className="metric-card"><div className="metric-top"><span className="metric-label">Class average</span><span className="metric-icon cyan"><Gauge size={17}/></span></div><div className="metric-value">{dashboardStats.average===null?"—":dashboardStats.average}<span className="metric-percent">{dashboardStats.average===null?"":"%"}</span></div><div className="metric-foot">Across shared graded attempts</div><div className="metric-line cyan-line"><span style={{width:"84%"}}/></div></div>
    </section>
    <section className="content-grid">
     <div className="panel assessments-panel"><div className="panel-header"><div><div className="panel-kicker">ASSESSMENT OVERVIEW</div><h2>Your assessments</h2><p>Keep every test on track, from draft to final grade.</p></div><button className="text-btn" onClick={()=>setActive("Tests")}>View all <ArrowRight size={15}/></button></div>
      <div className="table-tools"><div className="searchbox"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search assessments..." /></div><button className="filter-btn" onClick={()=>setNotice("Showing all assessment statuses.")}><Filter size={15}/> Filter</button></div>
      <div className="assessment-list">{filtered.map((t,i)=><div className="assessment-row" key={t.name}><div className={`assessment-symbol ${t.accent}`}>{i===0?<Terminal size={18}/>:i===1?<Code2 size={18}/>:<FileCode2 size={18}/>}</div><div className="assessment-info"><strong>{t.name}</strong><span>{t.subject}</span><div className="mobile-progress"><span>{t.students}</span><div className="progress-track"><i style={{width:t.progress+"%"}}/></div></div></div><div className="assessment-date"><span>{t.date}</span><span className={`badge ${t.status.toLowerCase()}`}><i/>{t.status}</span></div><div className="assessment-progress"><div><span>{t.students}</span><b>{t.progress? t.progress+"%": "—"}</b></div><div className="progress-track"><i style={{width:t.progress+"%"}}/></div></div><button className="row-more" onClick={()=>{const ownTest=createdTests.find(item=>item.name===t.name);if(ownTest){setSelectedTest(ownTest);}else{setNotice(t.name+" is sample dashboard data. Create your own test to manage its questions here.");}}} aria-label={"Open details for "+t.name}><MoreHorizontal size={18}/></button></div>)}
       {filtered.length===0&&<div className="empty-state">No assessments match “{query}”.</div>}
      </div>
      <div className="panel-footer"><span><span className="footer-dot"/> Updated just now</span><button onClick={()=>setActive("Tests")}>Manage assessments <ArrowRight size={14}/></button></div>
     </div>
     <div className="right-column">
      <div className="panel schedule-panel"><div className="panel-header compact"><div><div className="panel-kicker">UP NEXT</div><h2>Assessment schedule</h2></div><CalendarDays size={18} className="muted-icon"/></div><div className="schedule-date"><div className="date-block"><span>OCT</span><strong>25</strong></div><div className="schedule-info"><strong>SQL Query Challenge</strong><span><Clock3 size={13}/> Tomorrow · 9:00 AM</span><span><Users size={13}/> 32 students enrolled</span></div></div><div className="schedule-bottom"><span className="schedule-tag"><span className="status-dot"/> Scheduled</span><button onClick={()=>setNotice("Schedule details opened for SQL Query Challenge.")}>Details <ArrowRight size={13}/></button></div></div>
      <div className="panel activity-panel"><div className="panel-header compact"><div><div className="panel-kicker">LIVE FEED</div><h2>Classroom activity</h2></div><span className="live-indicator"><i/> LIVE</span></div><div className="activity-list"><div className="activity-item"><div className="activity-icon blue"><Check size={15}/></div><div><strong>Submission received</strong><p>Python Fundamentals · Student 014</p><span>2 min ago</span></div></div><div className="activity-item"><div className="activity-icon cyan"><Code2 size={15}/></div><div><strong>Assessment in progress</strong><p>28 students currently participating</p><span>12 min ago</span></div></div><div className="activity-item"><div className="activity-icon white"><GraduationCap size={15}/></div><div><strong>Grades published</strong><p>Loops & Conditions · Class XI-A</p><span>Yesterday</span></div></div></div><button className="activity-link" onClick={()=>setActive("Analytics")}>View classroom analytics <ArrowRight size={14}/></button></div>
     </div>
    </section>
    <section className="bottom-grid"><div className="panel insight-panel"><div className="insight-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="insight-core"><BrainCircuit size={28}/></div><div className="spark spark-one">✦</div><div className="spark spark-two">✧</div></div><div className="insight-copy"><div className="panel-kicker">CEREBRIX INSIGHT</div><h2>Make every submission count.</h2><p>Bring code, assessment integrity, and thoughtful grading into one focused workspace.</p></div><button className="insight-arrow" onClick={()=>setActive("Analytics")} aria-label="Open analytics"><ArrowUpRight size={19}/></button></div>
     <div className="panel quick-panel"><div><div className="panel-kicker">QUICK ACTIONS</div><h2>What would you like to do?</h2></div><div className="quick-actions"><button onClick={()=>setShowCreate(true)}><span className="quick-icon blue"><Plus size={18}/></span><span><strong>Build an assessment</strong><small>Set questions, marks and duration</small></span><ArrowRight size={15}/></button><button onClick={()=>setActive("Submissions")}><span className="quick-icon cyan"><Code2 size={18}/></span><span><strong>Review submissions</strong><small>Continue your grading queue</small></span><ArrowRight size={15}/></button></div></div></section>
    <footer className="footer"><span>© 2026 CEREBRIX <span className="footer-sep">·</span> THINK. CODE. PROVE.</span><span><span className="footer-dot"/> YOUR WORKSPACE, IN FOCUS</span></footer>
    </>}
   </div>
  </main>
  {selectedTest&&<TestDetails test={selectedTest} onClose={()=>setSelectedTest(null)} onDelete={test=>{setCreatedTests(current=>current.filter(item=>!(item.name===test.name&&item.scheduledAt===test.scheduledAt)));setSelectedTest(null);setNotice(`“${test.name}” was deleted from this browser.`);}}/>}
  {showCreate&&<TestBuilder onClose={()=>setShowCreate(false)} onSave={async test=>{
   if(!supabase){setNotice("Supabase is not configured.");return;}
   const {data:assessment,error:assessmentError}=await supabase.from("assessments").insert({
    teacher_id:user.id,title:test.name,subject:test.subject,instructions:test.instructions,duration_minutes:test.duration,
    opens_at:test.status==="Scheduled"&&test.scheduledAt?new Date(test.scheduledAt).toISOString():null,
    closes_at:test.deadline?new Date(test.deadline).toISOString():null,status:test.status==="Scheduled"?"scheduled":"draft"
   }).select("id").single();
   if(assessmentError||!assessment){setNotice("Assessment could not be saved to the shared database. Check that your account has the Teacher role.");return;}
   const questions=test.questions.filter(question=>question.prompt.trim()).map((question,index)=>({
    assessment_id:assessment.id,position:index+1,kind:question.kind,title:question.title,prompt:question.prompt,marks:question.marks,starter_content:"",dataset:question.dataset
   }));
   if(questions.length){
    const {data:createdQuestions,error:questionError}=await supabase.from("assessment_questions").insert(questions).select("id,position");
    if(questionError||!createdQuestions){await supabase.from("assessments").delete().eq("id",assessment.id);setNotice("Questions could not be saved. No partial assessment was kept.");return;}
    const keys=createdQuestions.map(question=>({question_id:question.id,reference_answer:test.questions.filter(item=>item.prompt.trim())[question.position-1]?.referenceAnswer??""}));
    if(keys.some(key=>key.reference_answer)){
     const {error:keyError}=await supabase.from("assessment_question_keys").insert(keys.filter(key=>key.reference_answer));
     if(keyError){await supabase.from("assessments").delete().eq("id",assessment.id);setNotice("Answer keys could not be saved. No partial assessment was kept.");return;}
    }
   }
   setShowCreate(false);setNotice(`“${test.name}” saved to your shared workspace.`);setActive("Tests");
   const {data:latest}=await supabase.from("assessments").select("id,title,subject,instructions,duration_minutes,opens_at,closes_at,status,assessment_questions(id,position,kind,title,prompt,marks,starter_content,dataset,assessment_question_keys(reference_answer))").eq("id",assessment.id).single();
   if(latest){
    const qs=[...(latest.assessment_questions??[])].sort((a:any,b:any)=>a.position-b.position);
    setCreatedTests(current=>[{...test,id:latest.id,name:latest.title,subject:latest.subject,status:latest.status==="scheduled"||latest.status==="published"?"Scheduled":"Draft",scheduledAt:latest.opens_at??"",deadline:latest.closes_at??"",duration:latest.duration_minutes,instructions:latest.instructions??"",questionCount:qs.length,totalMarks:qs.reduce((sum:number,q:any)=>sum+Number(q.marks||0),0),questions:qs.map((q:any,index:number)=>({id:index+1,kind:q.kind,title:q.title??"",prompt:q.prompt,marks:Number(q.marks||5),referenceAnswer:Array.isArray(q.assessment_question_keys)?(q.assessment_question_keys[0]?.reference_answer??""):(q.assessment_question_keys?.reference_answer??""),dataset:q.dataset??""}))},...current.filter(item=>item.name!==latest.title)]); 
   }
  }}/>}</div>
}
export default App;
