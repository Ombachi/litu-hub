import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "DELETE") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirmation guard — body must include {"confirm":"DELETE"}
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    if (body?.confirm !== "DELETE") {
      return new Response(JSON.stringify({ error: "Confirmation required: send { confirm: 'DELETE' }" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Step 1: scrub data via RPC under user's session.
    const { data: rpcData, error: rpcError } = await userClient.rpc("gdpr_delete_user_account");
    if (rpcError) throw rpcError;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Step 2: delete user-owned storage objects across all user-scoped buckets.
    // Convention: every user-uploaded file is keyed under `{user_id}/...`.
    // We DO NOT touch institution/lesson/resource folders that are not under the user's prefix.
    const userScopedBuckets = ["avatars", "message-attachments", "submissions"];
    const storageReport: Record<string, { removed: number; error?: string }> = {};
    for (const bucket of userScopedBuckets) {
      try {
        const { data: listed, error: listErr } = await adminClient.storage
          .from(bucket)
          .list(userId, { limit: 1000 });
        if (listErr) {
          storageReport[bucket] = { removed: 0, error: listErr.message };
          continue;
        }
        const paths = (listed ?? []).map((o) => `${userId}/${o.name}`);
        if (paths.length === 0) {
          storageReport[bucket] = { removed: 0 };
          continue;
        }
        const { error: rmErr } = await adminClient.storage.from(bucket).remove(paths);
        storageReport[bucket] = {
          removed: rmErr ? 0 : paths.length,
          ...(rmErr ? { error: rmErr.message } : {}),
        };
      } catch (e) {
        storageReport[bucket] = {
          removed: 0,
          error: e instanceof Error ? e.message : "unknown",
        };
      }
    }

    // Also remove quiz-answers/{user_id}/* from the submissions bucket (nested prefix).
    try {
      const { data: qaListed } = await adminClient.storage
        .from("submissions")
        .list(`quiz-answers/${userId}`, { limit: 1000 });
      const qaPaths = (qaListed ?? []).map((o) => `quiz-answers/${userId}/${o.name}`);
      if (qaPaths.length > 0) {
        await adminClient.storage.from("submissions").remove(qaPaths);
        storageReport["submissions"] = {
          removed: (storageReport["submissions"]?.removed ?? 0) + qaPaths.length,
        };
      }
    } catch (e) {
      console.error("quiz-answers cleanup failed:", e);
    }

    // Step 3: delete the auth user via service role (auth.users only reachable via admin API).
    const { error: authDelErr } = await adminClient.auth.admin.deleteUser(userId);
    if (authDelErr) {
      console.error("auth.admin.deleteUser failed:", authDelErr);
      return new Response(JSON.stringify({
        error: "Profile data deleted but auth account removal failed. Contact support.",
        partial: true,
      }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, storage: storageReport, ...rpcData }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("gdpr-delete error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
