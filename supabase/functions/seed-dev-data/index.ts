import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (Deno.env.get("ALLOW_SEED") !== "true") {
    return new Response(JSON.stringify({ error: "Disabled in production" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Use service role for seeding
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify caller is admin
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const userId = claimsData.claims.sub;

  // Check admin
  const { data: adminCheck } = await supabase.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "platform_admin"]);
  if (!adminCheck?.length) {
    return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    // 1. Create term
    const { data: term } = await supabase.from("terms").insert({
      name: "Semester 1, 2026",
      start_date: "2026-01-15",
      end_date: "2026-05-30",
    }).select().single();

    // 2. Create courses
    const courses = [
      { code: "CS101", title: "Introduction to Computer Science", color: "hsl(210, 60%, 45%)", term_id: term.id, created_by: userId },
      { code: "MATH201", title: "Linear Algebra", color: "hsl(340, 55%, 45%)", term_id: term.id, created_by: userId },
      { code: "ENG110", title: "Academic Writing", color: "hsl(152, 45%, 35%)", term_id: term.id, created_by: userId },
    ];
    const { data: createdCourses } = await supabase.from("courses").insert(courses).select();

    // 3. Assign caller as tutor
    const tutorAssignments = createdCourses!.map((c: any) => ({ course_id: c.id, tutor_id: userId }));
    await supabase.from("course_tutors").insert(tutorAssignments);

    // 4. Create modules & lessons for first course
    const cs = createdCourses![0];
    const mods = [
      { course_id: cs.id, title: "Getting Started", description: "Introduction and setup", order: 1 },
      { course_id: cs.id, title: "Data Types & Variables", description: "Fundamental data types", order: 2 },
      { course_id: cs.id, title: "Control Flow", description: "If/else, loops, and functions", order: 3 },
    ];
    const { data: createdMods } = await supabase.from("modules").insert(mods).select();

    const lessons = [
      { module_id: createdMods![0].id, title: "Welcome to CS101", type: "video", duration: "15 min", order: 1, content: "Introduction video" },
      { module_id: createdMods![0].id, title: "Setting Up Your Environment", type: "reading", duration: "20 min", order: 2, content: "Install Python and VS Code" },
      { module_id: createdMods![1].id, title: "Integers and Floats", type: "reading", duration: "25 min", order: 1, content: "Understanding number types" },
      { module_id: createdMods![1].id, title: "Strings and Booleans", type: "video", duration: "18 min", order: 2, content: "String operations" },
      { module_id: createdMods![2].id, title: "If/Else Statements", type: "reading", duration: "30 min", order: 1, content: "Conditional logic" },
    ];
    await supabase.from("lessons").insert(lessons);

    // 5. Create assignments
    const now = new Date();
    const assignments = [
      { course_id: cs.id, title: "Hello World Program", description: "Write your first Python program", type: "code", max_score: 100, due_date: new Date(now.getTime() + 7 * 86400000).toISOString() },
      { course_id: cs.id, title: "Variables Exercise", description: "Practice using variables", type: "code", max_score: 50, due_date: new Date(now.getTime() + 14 * 86400000).toISOString() },
      { course_id: createdCourses![1].id, title: "Matrix Operations", description: "Solve matrix problems", type: "essay", max_score: 80, due_date: new Date(now.getTime() + 10 * 86400000).toISOString() },
    ];
    await supabase.from("assignments").insert(assignments);

    // 6. Create quizzes
    const quizData = [
      { course_id: cs.id, title: "Python Basics Quiz", description: "Test your Python knowledge", time_limit: 30, max_attempts: 2, due_date: new Date(now.getTime() + 7 * 86400000).toISOString() },
      { course_id: createdCourses![1].id, title: "Vectors Quiz", description: "Vector operations", time_limit: 20, max_attempts: 1, due_date: new Date(now.getTime() + 12 * 86400000).toISOString() },
    ];
    const { data: createdQuizzes } = await supabase.from("quizzes").insert(quizData).select();

    // 7. Add quiz questions
    const questions = [
      { quiz_id: createdQuizzes![0].id, question_text: "What is the output of print(2 + 3)?", question_type: "multiple_choice", options: JSON.stringify(["4", "5", "23", "Error"]), correct_answer: "5", points: 10, order: 1 },
      { quiz_id: createdQuizzes![0].id, question_text: "Which keyword defines a function in Python?", question_type: "multiple_choice", options: JSON.stringify(["function", "def", "func", "define"]), correct_answer: "def", points: 10, order: 2 },
    ];
    await supabase.from("quiz_questions").insert(questions);

    // 8. Create a discussion
    await supabase.from("discussions").insert([
      { course_id: cs.id, title: "Introduce Yourself", author_id: userId, pinned: true },
      { course_id: cs.id, title: "Python Resources", author_id: userId },
    ]);

    // Log seed action
    await supabase.from("audit_log").insert({ user_id: userId, action: "seed_dev_data", details: { courses: createdCourses!.length, modules: createdMods!.length } });

    return new Response(
      JSON.stringify({ success: true, message: "Dev data seeded", courses: createdCourses!.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
