import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Award, Crown, Medal, RefreshCw, Trophy, Users } from "lucide-react";
import { supabase } from "./lib/supabase";
import type { BuilderTest } from "./TestBuilder";

type Props = { tests: BuilderTest[]; userId: string; role: "Teacher" | "Student" };
type Grade = { score: number };
type Submission = { id: string; student_id: string; assessment_id: string; status: string; assessment_grades: Grade[] | Grade | null };
type Profile = { id: string; display_name: string | null; role: string };
type Entry = { id: string; name: string; average: number; graded: number; points: number; isMe: boolean };

export default function Leaderboard({ tests, userId, role }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError("");
      const [{ data: rows, error: rowsError }, { data: people, error: peopleError }] = await Promise.all([
        supabase!.from("assessment_submissions").select("id,student_id,assessment_id,status,assessment_grades(score)").eq("status", "submitted"),
        supabase!.from("profiles").select("id,display_name,role").eq("role", "student")
      ]);
      if (!alive) return;
      if (rowsError) setError("Leaderboard data could not be loaded. Please check database permissions and try again.");
      else setSubmissions((rows ?? []) as Submission[]);
      if (!peopleError) setProfiles((people ?? []) as Profile[]);
      setLoading(false);
    };
    void load();
    return () => { alive = false; };
  }, [refreshKey]);

  const ranked = useMemo(() => {
    const names = new Map(profiles.map(p => [p.id, p.display_name?.trim() || "CEREBRIX Student"]));
    const stats = new Map<string, { sum: number; graded: number; points: number }>();
    for (const row of submissions) {
      const raw = row.assessment_grades;
      const grade = Array.isArray(raw) ? raw[0] : raw;
      if (!grade || !Number.isFinite(Number(grade.score))) continue;
      const test = tests.find(t => t.id === row.assessment_id);
      const total = Math.max(1, Number(test?.totalMarks ?? 100));
      const percent = Math.max(0, Math.min(100, Number(grade.score) / total * 100));
      const current = stats.get(row.student_id) ?? { sum: 0, graded: 0, points: 0 };
      current.sum += percent;
      current.graded += 1;
      current.points += Math.round(percent);
      stats.set(row.student_id, current);
    }
    return [...stats.entries()].map(([id, s]): Entry => ({
      id, name: names.get(id) ?? (id === userId ? "You" : "CEREBRIX Student"),
      average: Math.round(s.sum / s.graded), graded: s.graded, points: s.points, isMe: id === userId
    })).sort((a, b) => b.average - a.average || b.graded - a.graded || a.name.localeCompare(b.name));
  }, [profiles, submissions, tests, userId]);

  const mine = ranked.find(e => e.isMe);
  const podium = ranked.slice(0, 3);
  return <section className="leaderboard-page">
    <div className="leaderboard-hero">
      <div className="leaderboard-orb orb-one"/><div className="leaderboard-orb orb-two"/>
      <div className="leaderboard-hero-copy"><span className="panel-kicker"><Trophy size={14}/> CEREBRIX / GLOBAL RANKINGS</span><h2>Leaderboard<span className="heading-period">.</span></h2><p>Celebrate progress. Compete fairly. Keep getting better.</p></div>
      <div className="leaderboard-hero-actions"><div className="leaderboard-live"><span/> LIVE RANKINGS</div><button className="secondary-btn" onClick={()=>setRefreshKey(v=>v+1)}><RefreshCw size={15}/> Refresh</button></div>
      <div className="leaderboard-stat"><div className="leaderboard-stat-icon"><Users size={18}/></div><div><strong>{profiles.length}</strong><span>STUDENTS</span></div><div className="leaderboard-stat-icon"><Activity size={18}/></div><div><strong>{ranked.length}</strong><span>RANKED</span></div></div>
    </div>
    {mine && <div className="leaderboard-you"><div className="leaderboard-you-icon"><Award size={20}/></div><div><strong>Your standing</strong><span>{mine.graded} graded assessment{mine.graded===1?"":"s"} · {mine.average}% average</span></div><div className="leaderboard-you-rank">#{ranked.findIndex(e=>e.id===mine.id)+1}</div></div>}
    {error && <div className="empty-state">{error}</div>}
    {loading ? <div className="leaderboard-loading"><span className="loading-orbit"/><p>Loading rankings…</p></div> : ranked.length===0 ? <div className="leaderboard-empty"><div className="leaderboard-empty-icon"><Trophy size={27}/></div><h3>The race starts here.</h3><p>Rankings appear after student assessments have been graded. Keep learning — your progress will show up here.</p></div> : <>
      <div className="leaderboard-podium">{[podium[1],podium[0],podium[2]].map((entry,i)=>entry&&<motion.div key={entry.id} className={`podium-card podium-${i===1?"first":i===0?"second":"third"} ${entry.isMe?"is-me":""}`} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*.08}}><div className="podium-crown">{i===1?<Crown size={22}/>:i===0?<Medal size={21}/>:<Award size={21}/>}</div><div className="podium-avatar">{entry.name.slice(0,1).toUpperCase()}</div><strong>{entry.isMe?"You":entry.name}</strong><span className="podium-score">{entry.average}%</span><span className="podium-label">{i===1?"CHAMPION":i===0?"RUNNER-UP":"THIRD PLACE"}</span><div className="podium-base"><b>{i===1?"01":i===0?"02":"03"}</b></div></motion.div>)}</div>
      <div className="panel leaderboard-table-panel"><div className="panel-header"><div><div className="panel-kicker">THE HALL OF PROGRESS</div><h2>All rankings</h2><p>Ranked by average graded assessment score.</p></div><span className="leaderboard-count">{ranked.length} learners</span></div><div className="leaderboard-table-wrap"><table className="leaderboard-table"><thead><tr><th>RANK</th><th>STUDENT</th><th>AVG. SCORE</th><th>GRADED</th><th>POINTS</th></tr></thead><tbody>{ranked.map((entry,i)=><tr key={entry.id} className={entry.isMe?"leaderboard-current-user":""}><td><span className={`rank-number ${i<3?"rank-top":""}`}>{String(i+1).padStart(2,"0")}</span></td><td><div className="leaderboard-student"><span className="leaderboard-small-avatar">{entry.name.slice(0,1).toUpperCase()}</span><strong>{entry.isMe?"You":entry.name}</strong>{entry.isMe&&<span className="leaderboard-you-tag">YOU</span>}</div></td><td><div className="score-cell"><strong>{entry.average}%</strong><span><i style={{width:entry.average+"%"}}/></span></div></td><td>{entry.graded}</td><td><strong>{entry.points.toLocaleString()}</strong><span className="points-label"> pts</span></td></tr>)}</tbody></table></div></div>
    </>}
    <p className="leaderboard-footnote"><Activity size={13}/> {role==="Teacher"?"Class performance is based on graded submissions visible to your account.":"Scores update when teachers grade submitted assessments."} Only graded work contributes to rankings.</p>
  </section>;
}
