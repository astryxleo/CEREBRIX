import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond(405, { error: "Method not allowed." });
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !serviceKey || !anonKey) return respond(500, { error: "Server account-creation configuration is incomplete." });
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond(401, { error: "Sign in as a teacher first." });
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return respond(401, { error: "Your session is invalid. Sign in again." });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profileError || profile?.role !== "teacher") return respond(403, { error: "Only teacher accounts can issue student logins." });

  let body: { displayName?: string; className?: string; studentId?: string; password?: string };
  try { body = await request.json(); } catch { return respond(400, { error: "Invalid request body." }); }
  const displayName = String(body.displayName ?? "").trim();
  const className = String(body.className ?? "Unassigned").trim() || "Unassigned";
  const studentId = String(body.studentId ?? "").trim().toUpperCase();
  const password = String(body.password ?? "");
  if (displayName.length < 1 || displayName.length > 100) return respond(400, { error: "Student name must be between 1 and 100 characters." });
  if (className.length > 80) return respond(400, { error: "Class name must be at most 80 characters." });
  if (!/^CBX-[A-HJ-NP-Z2-9]{6}$/.test(studentId)) return respond(400, { error: "Student ID format is invalid." });
  if (password.length < 12 || password.length > 128) return respond(400, { error: "Generated password does not meet security requirements." });
  const email = studentId.toLowerCase() + "@students.cerebrix.app";
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { display_name: displayName, student_id: studentId },
  });
  if (createError || !created.user) return respond(400, { error: createError?.message ?? "Student login could not be created." });
  const studentUserId = created.user.id;
  const { error: profileUpsertError } = await admin.from("profiles").upsert({ id: studentUserId, display_name: displayName, role: "student" });
  if (profileUpsertError) {
    await admin.auth.admin.deleteUser(studentUserId);
    return respond(500, { error: "Student profile could not be created. No login was kept." });
  }
  const { data: roster, error: rosterError } = await admin.from("class_roster").insert({
    teacher_id: userData.user.id, student_id: studentUserId, display_name: displayName,
    email, class_name: className,
  }).select("id").single();
  if (rosterError || !roster) {
    await admin.auth.admin.deleteUser(studentUserId);
    return respond(500, { error: rosterError?.code === "23505" ? "This student ID already exists. Please create the account again." : "Student could not be added to the class roster. No login was kept." });
  }
  return respond(200, { studentId, email, rosterId: roster.id, studentUserId });
});
