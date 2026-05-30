import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ---- Auth + role check (coach roles only) ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const allowed = new Set(["platform_admin", "school_admin", "tutor", "ta"]);
    if (!roles?.some((r: any) => allowed.has(r.role))) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- AI quota / rate limit ----
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: quotaErr } = await adminClient.rpc("record_ai_usage", {
      _user_id: userId,
      _function_name: "ai-content-generate",
      _daily_limit: 60,
      _per_minute_limit: 6,
    });
    if (quotaErr) {
      const msg = quotaErr.message || "";
      const isLimit = msg.includes("AI_RATE_LIMIT") || msg.includes("AI_QUOTA_EXCEEDED");
      return new Response(JSON.stringify({ error: msg }), {
        status: isLimit ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, topic, courseTitle, courseCode, courseId, difficulty, count, assessmentCategory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ---- Cache lookup (questions only) — avoids paying the AI gateway twice for the same prompt ----
    let cacheKey: string | null = null;
    if (type === "questions") {
      const keyMaterial = JSON.stringify({
        c: courseId ?? courseCode ?? "",
        t: (topic ?? "").trim().toLowerCase(),
        d: difficulty ?? "medium",
        a: assessmentCategory ?? "General",
        n: count ?? 3,
      });
      const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(keyMaterial));
      cacheKey = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: cached } = await adminClient
        .from("ai_question_cache")
        .select("payload, hit_count")
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (cached?.payload) {
        adminClient.from("ai_question_cache")
          .update({ hit_count: (cached.hit_count ?? 0) + 1, last_used_at: new Date().toISOString() })
          .eq("cache_key", cacheKey)
          .then(() => {}, (e: unknown) => console.error("ai cache bump failed", e));
        return new Response(JSON.stringify({ ...cached.payload, _cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let systemPrompt = "";
    let tools: any[] = [];
    let toolChoice: any = {};

    const courseCtx = `Course: ${courseCode} — ${courseTitle}`;

    if (type === "questions") {
      systemPrompt = `You are an expert academic question creator for university-level courses. Generate ${count || 3} quiz questions on the given topic.
${courseCtx}
Difficulty: ${difficulty || "medium"}
Create varied question types (multiple_choice, true_false, short_answer). For multiple choice, provide 4 options. Ensure questions test understanding, not just recall. Use a tone appropriate for Kenyan university students.`;

      tools = [{
        type: "function",
        function: {
          name: "generate_questions",
          description: "Return generated quiz questions",
          parameters: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question_text: { type: "string" },
                    question_type: { type: "string", enum: ["multiple_choice", "true_false", "short_answer"] },
                    options: { type: "array", items: { type: "string" } },
                    correct_answer: { type: "string", description: "For MCQ/TF the correct option text. For short_answer leave empty." },
                    explanation: { type: "string" },
                    points: { type: "number" },
                    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                  },
                  required: ["question_text", "question_type", "options", "correct_answer", "explanation", "points", "difficulty"],
                  additionalProperties: false,
                },
              },
            },
            required: ["questions"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "generate_questions" } };

    } else if (type === "assignment") {
      systemPrompt = `You are an expert academic curriculum designer. Generate an assignment for the given topic.
${courseCtx}
Create a clear, detailed assignment with a title, description with instructions, suggested type, and recommended max score. Be specific about requirements and evaluation criteria. Use a professional tone for Kenyan university students.`;

      tools = [{
        type: "function",
        function: {
          name: "generate_assignment",
          description: "Return a generated assignment",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string", description: "Detailed instructions with requirements" },
              type: { type: "string", enum: ["essay", "project", "code", "presentation"] },
              max_score: { type: "number" },
            },
            required: ["title", "description", "type", "max_score"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "generate_assignment" } };

    } else if (type === "discussion") {
      systemPrompt = `You are an expert academic facilitator. Generate ${count || 3} engaging discussion topics/prompts for the given subject area.
${courseCtx}
Create thought-provoking discussion titles that encourage critical thinking, debate, and peer learning. Each should be a concise but compelling title suitable as a forum thread heading. Use a tone appropriate for Kenyan university students.`;

      tools = [{
        type: "function",
        function: {
          name: "generate_discussions",
          description: "Return generated discussion topics",
          parameters: {
            type: "object",
            properties: {
              discussions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Discussion thread title" },
                  },
                  required: ["title"],
                  additionalProperties: false,
                },
              },
            },
            required: ["discussions"],
            additionalProperties: false,
          },
        },
      }];
      toolChoice = { type: "function", function: { name: "generate_discussions" } };

    } else {
      return new Response(JSON.stringify({ error: "Invalid type. Use: questions, assignment, or discussion" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Topic: ${topic}` },
        ],
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "No structured response from AI" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-content-generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
