import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { submissionContent, assignmentTitle, maxScore, rubricCriteria } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const rubricText = rubricCriteria?.length
      ? `\nRubric criteria:\n${rubricCriteria.map((c: any) => `- ${c.name} (${c.points} pts): ${c.description || ''}`).join('\n')}`
      : '';

    const systemPrompt = `You are an experienced academic grading assistant. Given a student's assignment submission, provide:
1. A suggested score out of ${maxScore}
2. Constructive feedback (2-4 sentences) that is encouraging but specific about areas of improvement
3. Key strengths (1-2 bullet points)
4. Areas for improvement (1-2 bullet points)

Assignment: "${assignmentTitle}"
Max Score: ${maxScore}${rubricText}

Be fair, constructive, and specific. Use a professional but warm tone appropriate for Kenyan university students.`;

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
          { role: "user", content: `Student submission:\n\n${submissionContent || "(No text content - file submission only)"}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "grading_feedback",
              description: "Return structured grading feedback",
              parameters: {
                type: "object",
                properties: {
                  suggestedScore: { type: "number", description: `Suggested score out of ${maxScore}` },
                  feedback: { type: "string", description: "Constructive feedback paragraph" },
                  strengths: { type: "array", items: { type: "string" }, description: "Key strengths" },
                  improvements: { type: "array", items: { type: "string" }, description: "Areas for improvement" },
                },
                required: ["suggestedScore", "feedback", "strengths", "improvements"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "grading_feedback" } },
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

    // Fallback: return raw content
    const content = data.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ feedback: content, suggestedScore: null, strengths: [], improvements: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-grading error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
