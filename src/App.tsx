import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import TestBuilder, { type BuilderTest } from "./TestBuilder";
import TestDetails from "./TestDetails";
import StudentExam from "./StudentExam";
import TeacherGradingStudio from "./TeacherGradingStudio";
import OverviewTab from "./OverviewTab";
import TeacherAnalytics from "./TeacherAnalytics";
import TeacherTests from "./TeacherTests";
import StudentDirectory from "./StudentDirectory";
import StudentAnalytics from "./StudentAnalytics";
import Leaderboard from "./Leaderboard";
import CustomCursor from "./CustomCursor";
import { supabase } from "./lib/supabase";
import { Activity, ArrowRight, ArrowUpRight, Bell, BookOpen, BrainCircuit, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Code2, FileCode2, Filter, FlaskConical, GraduationCap, LayoutDashboard, Menu, MoreHorizontal, Plus, Search, ShieldCheck, LogOut, Sparkles, Terminal, Users, X, BarChart3, Trophy } from "lucide-react";

type Tab = "Overview" | "Tests" | "Submissions" | "Students" | "Analytics" | "My analytics" | "Question Bank" | "Code Sandbox" | "Leaderboard";
const nav: {label: Tab; icon: typeof LayoutDashboard}[] = [
  {label:"Overview",icon:LayoutDashboard},{label:"Tests",icon:FileCode2},{label:"Submissions",icon:Code2},{label:"Students",icon:Users},{label:"Analytics",icon:Activity},{label:"Leaderboard",icon:Trophy}
];
const tests: BuilderTest[] = [];
const tabPaths: Record<Tab, string> = { Overview: "/", Tests: "/tests", Submissions: "/submissions", Students: "/students", Analytics: "/analytics", "My analytics": "/my-analytics", "Question Bank": "/question-bank", "Code Sandbox": "/sandbox", "Leaderboard": "/leaderboard" };
const pathTabs: Record<string, Tab> = { "/": "Overview", "/tests": "Tests", "/builder": "Tests", "/submissions": "Submissions", "/students": "Students", "/analytics": "Analytics", "/my-analytics": "My analytics", "/question-bank": "Question Bank", "/sandbox": "Code Sandbox", "/leaderboard": "Leaderboard" };
function Brand(){return <div className="brand"><div className="brand-mark"><img src="/cerebrix.png" alt="" /></div><div><strong>CEREBRIX</strong><span>THINK. CODE. PROVE.</span></div></div>}
function App({ user, profile, signOut }: { user: { id: string; email?: string }; profile: { display_name: string; role: "student" | "teacher" }; signOut: () => Promise<void> }){
 const location=useLocation();
 const navigate=useNavigate();
 const [active,setActive]=useState<Tab>(()=>pathTabs[window.location.pathname]??"Overview");
 const goTo=(tab:Tab)=>{setActive(tab);navigate(tabPaths[tab]);};
 const role = profile.role === "teacher" ? "Teacher" : "Student";
 const [showCreate,setShowCreate]=useState(false);
 const goToBuilder=()=>{navigate("/builder");setShowCreate(true);};
 const [selectedTest,setSelectedTest]=useState<BuilderTest|null>(null);
 const [createdTests,setCreatedTests]=useState<BuilderTest[]>(()=>{try{const saved=localStorage.getItem("cerebrix.teacher.tests.v1");return saved?JSON.parse(saved) as BuilderTest[]:[]}catch{return []}});
 const [mobileNav,setMobileNav]=useState(false);
 const [profileMenuOpen,setProfileMenuOpen]=useState(false);
 const [query,setQuery]=useState("");
 const [notice,setNotice]=useState("");
 useEffect(()=>{if(role==="Student"&&location.pathname!=="/"&&location.pathname!=="/my-analytics"&&location.pathname!=="/leaderboard"&&location.pathname!=="/terminated"){navigate("/",{replace:true});return;}setActive(pathTabs[location.pathname]??"Overview");setShowCreate(role==="Teacher"&&location.pathname==="/builder");},[location.pathname,role,navigate]);
 const [dashboardStats,setDashboardStats]=useState({scheduled:0,participants:0,pending:0,average:null as number|null});
 const allTests=[...createdTests,...tests];
 const filtered=allTests.filter(t=>(t.name+" "+t.subject).toLowerCase().includes(query.toLowerCase()));
 const nextAssessment=createdTests.filter(test=>test.status==="Scheduled").sort((a,b)=>new Date(a.scheduledAt||"9999-12-31").getTime()-new Date(b.scheduledAt||"9999-12-31").getTime())[0];
 const nextDate=nextAssessment?.scheduledAt?new Date(nextAssessment.scheduledAt):null;
 useEffect(()=>{try{localStorage.setItem("cerebrix.teacher.tests.v1",JSON.stringify(createdTests));}catch{/* Browser storage may be unavailable. */}},[createdTests]);
 useEffect(()=>{
  if(!supabase||role!=="Teacher")return;
  let alive=true;
  const loadStats=async()=>{
   const [{data:assessments,error:assessmentError},{data:submissions,error:submissionError},{data:roster,error:rosterError}]=await Promise.all([
    supabase!.from("assessments").select("id,status"),
    supabase!.from("assessment_submissions").select("id,student_id,assessment_id,assessment_grades(score)").eq("status","submitted"),
    supabase!.from("class_roster").select("id").eq("teacher_id",user.id)
   ]);
   if(!alive)return;
   if(assessmentError||submissionError){setNotice("Some dashboard metrics could not be loaded from the shared workspace.");return;}
   const rows=submissions??[];
   const graded=rows.map((row:any)=>({row,grade:Array.isArray(row.assessment_grades)?row.assessment_grades[0]:row.assessment_grades})).filter((item:any)=>item.grade);
   const maxById=new Map(createdTests.filter(test=>test.id).map(test=>[test.id!,test.totalMarks||100]));
   const percentages=graded.map((item:any)=>Number(maxById.get(item.row.assessment_id)??100)>0?Number(item.grade.score)/Number(maxById.get(item.row.assessment_id)??100)*100:0);
   setDashboardStats({
    scheduled:(assessments??[]).filter((item:any)=>item.status==="scheduled"||item.status==="published").length,
    participants:rosterError ? new Set(rows.map((row:any)=>row.student_id)).size : (roster??[]).length,
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
   const {data,error}=await supabase!.from("assessments").select("id,title,subject,instructions,duration_minutes,negative_marking,opens_at,closes_at,status,assessment_questions(id,position,kind,title,prompt,marks,starter_content,dataset,options,assessment_question_keys(reference_answer))").order("created_at",{ascending:false});
   if(!alive)return;
   if(error){setNotice("Could not load shared assessments. Check database access and your role.");return;}
   const mapped=(data??[]).map((row:any):BuilderTest=>{
    const questions=[...(row.assessment_questions??[])].sort((a:any,b:any)=>a.position-b.position);
    return {
     id:row.id,name:row.title,subject:row.subject,status:row.status==="scheduled"||row.status==="published"?"Scheduled":"Draft",
     date:row.opens_at?new Date(row.opens_at).toLocaleString():"Not scheduled",students:"—",progress:0,accent:"blue",
     totalMarks:questions.reduce((sum:number,q:any)=>sum+Number(q.marks||0),0),
     duration:row.duration_minutes,negativeMarking:Number(row.negative_marking??0),scheduledAt:row.opens_at??"",deadline:row.closes_at??"",instructions:row.instructions??"",
     questionCount:questions.length,
     questions:questions.map((q:any,index:number)=>({id:index+1,kind:q.kind,title:q.title??"",prompt:q.prompt,marks:Number(q.marks||5),referenceAnswer:Array.isArray(q.assessment_question_keys)?(q.assessment_question_keys[0]?.reference_answer??""):(q.assessment_question_keys?.reference_answer??""),dataset:q.dataset??"",options:Array.isArray(q.options)?q.options:[]}))
    };
   });
   setCreatedTests(mapped);
  };
  void loadAssessments();
  return()=>{alive=false;};
 },[user.id,role]);
 if (role === "Student" && location.pathname === "/terminated") return <main className="fortress-terminated"><motion.div className="fortress-terminated-card" initial={{opacity:0,y:18,scale:.98}} animate={{opacity:1,y:0,scale:1}}><div className="fortress-terminated-icon"><ShieldCheck size={30}/></div><span className="panel-kicker">CEREBRIX / FORTRESS SECURITY</span><h1>EXAM TERMINATED<span>.</span></h1><p>The assessment was automatically submitted after three recorded integrity warnings. Browser signals can be imperfect; contact your teacher if you believe this was a mistake.</p><div className="fortress-terminated-status"><Check size={15}/> Submission status recorded</div><button className="primary-btn" onClick={()=>navigate("/",{replace:true})}>Return to student portal <ArrowRight size={15}/></button></motion.div></main>;
 return <div className="app-shell"><CustomCursor />
  <aside className={`sidebar ${mobileNav?"sidebar-open":""}`}>
   <div className="side-top"><Brand/><button className="icon-btn mobile-close" onClick={()=>setMobileNav(false)} aria-label="Close menu"><X size={18}/></button></div>
   <div className="workspace"><div className="workspace-avatar">CS</div><div className="workspace-copy"><strong>Computer Science</strong><span>School workspace</span></div><ChevronDown size={15}/></div>
   <div className="nav-label">WORKSPACE</div>
   <nav className="sidebar-nav-scroll">{role === "Teacher" ? nav.map(({label,icon:Icon})=><button key={label} onClick={()=>{goTo(label);setMobileNav(false)}} className={`nav-item ${active===label?"active":""}`}><Icon size={17}/><span>{label}</span></button>) : <><button className={`nav-item ${active==="Overview"?"active":""}`} onClick={()=>{goTo("Overview");setMobileNav(false)}}><GraduationCap size={17}/><span>My exams</span></button><button className={`nav-item ${active==="My analytics"?"active":""}`} onClick={()=>{goTo("My analytics");setMobileNav(false)}}><BarChart3 size={17}/><span>My analytics</span></button><button className={`nav-item ${active==="Leaderboard"?"active":""}`} onClick={()=>{goTo("Leaderboard");setMobileNav(false)}}><Trophy size={17}/><span>Leaderboard</span></button></>}</nav>
   {role === "Teacher" && <><div className="nav-label tools-label">TOOLS</div>
   <button className={`nav-item nav-coming-soon ${active==="Question Bank"?"active":""}`} onClick={()=>{goTo("Question Bank");setMobileNav(false)}}><BookOpen size={17}/><span>Question Bank</span><span className="soon">COMING SOON</span></button>
   <button className={`nav-item nav-coming-soon ${active==="Code Sandbox"?"active":""}`} onClick={()=>{goTo("Code Sandbox");setMobileNav(false)}}><FlaskConical size={17}/><span>Code Sandbox</span><span className="soon">COMING SOON</span></button></>}
   <div className="sidebar-bottom">
    <div className="security-card"><div className="security-icon"><ShieldCheck size={17}/></div><div><strong>Assessment integrity</strong><p>Built for focused, fair exams.</p></div><span className="status-dot"/></div>
    <div className="profile-menu-wrap"><button className={`profile ${profileMenuOpen?"profile-open":""}`} onClick={()=>setProfileMenuOpen(open=>!open)} aria-expanded={profileMenuOpen} aria-haspopup="menu" title="Open account menu"><div className="profile-avatar">{(profile.display_name || user.email || "C").slice(0,1).toUpperCase()}</div><div className="profile-copy"><strong>{profile.display_name || user.email || "CEREBRIX user"}</strong><span>{role} account · Account menu</span></div><MoreHorizontal size={18}/></button>{profileMenuOpen&&<div className="profile-menu" role="menu"><div className="profile-menu-heading"><span>SIGNED IN AS</span><strong>{profile.display_name || user.email || "CEREBRIX user"}</strong></div><button type="button" role="menuitem" onClick={()=>{setProfileMenuOpen(false);void signOut();}}><LogOut size={15}/> Sign out</button></div>}</div>
   </div>
  </aside>
  {mobileNav&&<button className="scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
  <main className="main">
   <header className="topbar"><div className="top-left"><button className="icon-btn menu-btn" onClick={()=>setMobileNav(true)} aria-label="Open menu"><Menu size={19}/></button><div className="breadcrumb">Workspace <span>/</span> <b>{active}</b></div></div><div className="top-actions"><div className="status-pill"><span className="status-dot"/> All systems normal</div><button className="icon-btn help-btn" onClick={()=>setNotice("Help centre is coming soon.")} aria-label="Help"><CircleHelp size={18}/></button><button className="icon-btn notification-btn" onClick={()=>setNotice(current=>current==="__notifications__"?"":"__notifications__")} aria-label="Notifications" aria-expanded={notice==="__notifications__"}><Bell size={18}/><i/></button><div className="top-user"><div className="top-avatar">{(profile.display_name || user.email || "C").slice(0,1).toUpperCase()}</div><div className="top-user-copy"><strong>{profile.display_name || (role === "Teacher" ? "Teacher" : "Student")}</strong><span>{role} workspace</span></div></div></div></header>
   <motion.div className="page" key={location.pathname} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{duration:.24,ease:"easeOut"}}>
    {active !== "Overview" && <div className="welcome-row"><div className="welcome-copy"><div className="eyebrow"><span className="eyebrow-line"/> {role === "Teacher" ? "ASSESSMENT COMMAND CENTER" : "YOUR LEARNING COMMAND CENTER"}</div><h1>{active}<span className="heading-period">.</span></h1><p className="page-sub">{active==="Tests"?"Create, schedule, and manage programming assessments.":active==="Submissions"?"Review student work and keep grading moving.":active==="Students"?"Create student logins, manage your class roster, and track participation.":active==="Leaderboard"?"See student rankings, graded scores, and learning progress.":active==="My analytics"?"Explore your scores, progress, and teacher feedback.":"Understand class performance at a glance."}</p></div><div className="welcome-actions">{role === "Teacher" && <button className="primary-btn" onClick={goToBuilder}><Plus size={17}/> Create test</button>}</div></div>}
    {notice==="__notifications__" ? <div className="notification-card"><div className="notification-card-head"><div><span className="panel-kicker">CEREBRIX / INBOX</span><h2>Notifications<span className="heading-period">.</span></h2></div><button className="icon-btn" onClick={()=>setNotice("")} aria-label="Close notifications"><X size={16}/></button></div><article className="notification-item"><span className="notification-item-icon"><Bell size={16}/></span><div><strong>{role==="Teacher"?"Workspace updates":"Assessment updates"}</strong><p>{role==="Teacher"?"Student accounts and class roster are managed from the Students tab. New submissions appear in Submissions.":"Your teacher-issued account is active. Published assessments will appear in My exams."}</p><small>WORKSPACE NOTICE</small></div></article><article className="notification-item"><span className="notification-item-icon cyan"><ShieldCheck size={16}/></span><div><strong>Security is enabled</strong><p>Use only the account credentials issued to you. Never share your password publicly.</p><small>ACCOUNT SECURITY</small></div></article></div> : notice&&<div className="notice"><Sparkles size={16}/><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}
{active === "Question Bank" || active === "Code Sandbox" ? <section className="coming-soon-page"><div className="coming-soon-glow"/><div className="coming-soon-icon">{active === "Question Bank" ? <BookOpen size={25}/> : <FlaskConical size={25}/>}</div><span className="panel-kicker">CEREBRIX / IN DEVELOPMENT</span><h2>{active === "Question Bank" ? "Question Bank" : "Code Sandbox"}<span className="heading-period">.</span></h2><span className="coming-soon-badge">COMING SOON</span><p>{active === "Question Bank" ? "Build reusable question collections, tag concepts, and assemble assessments faster. This workspace is being prepared." : "A dedicated coding workspace with safe execution, test cases, and a smoother practice loop is in development."}</p><button className="secondary-btn" onClick={()=>goTo("Tests")}><ArrowRight size={15}/> Return to Tests</button></section> : active === "Leaderboard" ? <Leaderboard tests={allTests} userId={user.id} role={role}/> : role === "Student" && active === "My analytics" ? <StudentAnalytics tests={createdTests} userId={user.id}/> : role === "Student" ? <StudentExam tests={createdTests} userId={user.id}/> : active === "Submissions" ? <TeacherGradingStudio tests={createdTests} userId={user.id}/> : active === "Analytics" ? <TeacherAnalytics tests={createdTests} userId={user.id}/> : active === "Tests" ? <TeacherTests tests={createdTests} onCreate={goToBuilder} onOpen={setSelectedTest}/> : active === "Students" ? <StudentDirectory teacherId={user.id}/> : <>
    <OverviewTab logoUrl="/cerebrix.png" totalStudents={dashboardStats.participants} activeTests={dashboardStats.scheduled} systemStatus="Operational" />
    
    <section className="content-grid">
     <div className="panel assessments-panel"><div className="panel-header"><div><div className="panel-kicker">ASSESSMENT OVERVIEW</div><h2>Your assessments</h2><p>Keep every test on track, from draft to final grade.</p></div><button className="text-btn" onClick={()=>goTo("Tests")}>View all <ArrowRight size={15}/></button></div>
      <div className="table-tools"><div className="searchbox"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search assessments..." /></div><button className="filter-btn" onClick={()=>setNotice("Showing all assessment statuses.")}><Filter size={15}/> Filter</button></div>
      <div className="assessment-list">{filtered.map((t,i)=><div className="assessment-row" key={t.name}><div className={`assessment-symbol ${t.accent}`}>{i===0?<Terminal size={18}/>:i===1?<Code2 size={18}/>:<FileCode2 size={18}/>}</div><div className="assessment-info"><strong>{t.name}</strong><span>{t.subject}</span><div className="mobile-progress"><span>{t.students}</span><div className="progress-track"><i style={{width:t.progress+"%"}}/></div></div></div><div className="assessment-date"><span>{t.date}</span><span className={`badge ${t.status.toLowerCase()}`}><i/>{t.status}</span></div><div className="assessment-progress"><div><span>{t.students}</span><b>{t.progress? t.progress+"%": "—"}</b></div><div className="progress-track"><i style={{width:t.progress+"%"}}/></div></div><button className="row-more" onClick={()=>{const ownTest=createdTests.find(item=>item.name===t.name);if(ownTest){setSelectedTest(ownTest);}else{setNotice(t.name+" is sample dashboard data. Create your own test to manage its questions here.");}}} aria-label={"Open details for "+t.name}><MoreHorizontal size={18}/></button></div>)}
       {filtered.length===0&&<div className="empty-state">No assessments match “{query}”.</div>}
      </div>
      <div className="panel-footer"><span><span className="footer-dot"/> Updated just now</span><button onClick={()=>goTo("Tests")}>Manage assessments <ArrowRight size={14}/></button></div>
     </div>
     <div className="right-column">
      <div className="panel schedule-panel"><div className="panel-header compact"><div><div className="panel-kicker">UP NEXT</div><h2>Assessment schedule</h2></div><CalendarDays size={18} className="muted-icon"/></div>{nextAssessment ? <><div className="schedule-date"><div className="date-block"><span>{nextDate?nextDate.toLocaleDateString("en-US",{month:"short"}).toUpperCase():"TBD"}</span><strong>{nextDate?nextDate.getDate():"—"}</strong></div><div className="schedule-info"><strong>{nextAssessment.name}</strong><span><Clock3 size={13}/>{nextDate?nextDate.toLocaleString():"Time not set"}</span><span><Users size={13}/> Participation tracked from submissions</span></div></div><div className="schedule-bottom"><span className="schedule-tag"><span className="status-dot"/> Scheduled</span><button onClick={()=>goTo("Tests")}>View assessment <ArrowRight size={13}/></button></div></> : <div className="student-empty"><div className="student-empty-icon"><CalendarDays size={22}/></div><h3>No upcoming assessments</h3><p>Scheduled tests will appear here when they are created.</p></div>}</div>
      <div className="panel activity-panel"><div className="panel-header compact"><div><div className="panel-kicker">LIVE FEED</div><h2>Classroom activity</h2></div><span className="live-indicator"><i/> LIVE</span></div><div className="activity-list">{dashboardStats.pending>0&&<div className="activity-item"><div className="activity-icon blue"><Clock3 size={15}/></div><div><strong>Submissions awaiting review</strong><p>{dashboardStats.pending} submitted attempts need grading</p><span>Current workspace</span></div></div>}{dashboardStats.participants>0&&<div className="activity-item"><div className="activity-icon cyan"><Users size={15}/></div><div><strong>Student participation</strong><p>{dashboardStats.participants} unique students have submitted work</p><span>Current workspace</span></div></div>}{dashboardStats.scheduled>0&&<div className="activity-item"><div className="activity-icon white"><CalendarDays size={15}/></div><div><strong>Assessments scheduled</strong><p>{dashboardStats.scheduled} scheduled or published assessments</p><span>Current workspace</span></div></div>}{dashboardStats.pending===0&&dashboardStats.participants===0&&dashboardStats.scheduled===0&&<div className="student-empty"><div className="student-empty-icon"><Activity size={22}/></div><h3>No activity yet</h3><p>Live workspace activity will appear as assessments are scheduled and submitted.</p></div>}</div><button className="activity-link" onClick={()=>goTo("Analytics")}>View classroom analytics <ArrowRight size={14}/></button></div>
     </div>
    </section>
    <section className="bottom-grid"><div className="panel insight-panel"><div className="insight-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="insight-core"><BrainCircuit size={28}/></div><div className="spark spark-one">✦</div><div className="spark spark-two">✧</div></div><div className="insight-copy"><div className="panel-kicker">CEREBRIX INSIGHT</div><h2>Make every submission count.</h2><p>Bring code, assessment integrity, and thoughtful grading into one focused workspace.</p></div><button className="insight-arrow" onClick={()=>goTo("Analytics")} aria-label="Open analytics"><ArrowUpRight size={19}/></button></div>
     <div className="panel quick-panel"><div><div className="panel-kicker">QUICK ACTIONS</div><h2>What would you like to do?</h2></div><div className="quick-actions"><button onClick={goToBuilder}><span className="quick-icon blue"><Plus size={18}/></span><span><strong>Build an assessment</strong><small>Set questions, marks and duration</small></span><ArrowRight size={15}/></button><button onClick={()=>goTo("Submissions")}><span className="quick-icon cyan"><Code2 size={18}/></span><span><strong>Review submissions</strong><small>Continue your grading queue</small></span><ArrowRight size={15}/></button></div></div></section>
    <footer className="footer"><span>© 2026 CEREBRIX <span className="footer-sep">·</span> THINK. CODE. PROVE.</span><span><span className="footer-dot"/> YOUR WORKSPACE, IN FOCUS</span></footer>
    </>}
   </motion.div>
  </main>
  {selectedTest&&<TestDetails test={selectedTest} onClose={()=>setSelectedTest(null)} onDelete={test=>{setCreatedTests(current=>current.filter(item=>!(item.name===test.name&&item.scheduledAt===test.scheduledAt)));setSelectedTest(null);setNotice(`“${test.name}” was deleted from this browser.`);}}/>}
  {role === "Teacher" && showCreate && <TestBuilder onClose={()=>{setShowCreate(false);goTo("Tests");}} onSave={async test=>{
   if(!supabase){setNotice("Supabase is not configured.");return;}
   const {data:assessment,error:assessmentError}=await supabase.from("assessments").insert({
    teacher_id:user.id,title:test.name,subject:test.subject,instructions:test.instructions,duration_minutes:test.duration,negative_marking:test.negativeMarking??0,
    opens_at:test.status==="Scheduled"&&test.scheduledAt?new Date(test.scheduledAt).toISOString():null,
    closes_at:test.deadline?new Date(test.deadline).toISOString():null,status:test.status==="Scheduled"?"scheduled":"draft"
   }).select("id").single();
   if(assessmentError||!assessment){setNotice("Assessment could not be saved to the shared database. Check that your account has the Teacher role.");return;}
   const questions=test.questions.filter(question=>question.prompt.trim()).map((question,index)=>({
    assessment_id:assessment.id,position:index+1,kind:question.kind,title:question.title,prompt:question.prompt,marks:question.marks,starter_content:"",dataset:question.dataset,options:question.options??[]
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
   setShowCreate(false);setNotice(`“${test.name}” saved to your shared workspace.`);goTo("Tests");
   const {data:latest}=await supabase.from("assessments").select("id,title,subject,instructions,duration_minutes,negative_marking,opens_at,closes_at,status,assessment_questions(id,position,kind,title,prompt,marks,starter_content,dataset,options,assessment_question_keys(reference_answer))").eq("id",assessment.id).single();
   if(latest){
    const qs=[...(latest.assessment_questions??[])].sort((a:any,b:any)=>a.position-b.position);
    setCreatedTests(current=>[{...test,id:latest.id,name:latest.title,subject:latest.subject,status:latest.status==="scheduled"||latest.status==="published"?"Scheduled":"Draft",scheduledAt:latest.opens_at??"",deadline:latest.closes_at??"",duration:latest.duration_minutes,instructions:latest.instructions??"",questionCount:qs.length,totalMarks:qs.reduce((sum:number,q:any)=>sum+Number(q.marks||0),0),questions:qs.map((q:any,index:number)=>({id:index+1,kind:q.kind,title:q.title??"",prompt:q.prompt,marks:Number(q.marks||5),referenceAnswer:Array.isArray(q.assessment_question_keys)?(q.assessment_question_keys[0]?.reference_answer??""):(q.assessment_question_keys?.reference_answer??""),dataset:q.dataset??"",options:Array.isArray(q.options)?q.options:[]}))},...current.filter(item=>item.name!==latest.title)]); 
   }
  }}/>}</div>
}
export default App;
