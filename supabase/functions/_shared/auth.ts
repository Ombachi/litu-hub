// Shared caller verification for internal/privileged edge functions.
import { createClient } from "npm:@supabase/supabase-js@2";

export type Caller =
  | { kind: "service" }
  | { kind: "cron" }
  | { kind: "user"; userId: string; roles: string[]; token: string };

const bearer = (req: Request) => {
  const h = req.headers.get("Authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
};

/** Returns the verified caller, or null if the request carries no valid credential. */
export async function resolveCaller(req: Request): Promise<Caller | null> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, service);
  const token = bearer(req);

  if (token && token === service) return { kind: "service" };

  const cronToken = req.headers.get("x-cron-token");
  if (cronToken) {
    const { data } = await admin.rpc("verify_cron_token", { _token: cronToken });
    if (data === true) return { kind: "cron" };
  }

  if (!token) return null;
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", data.user.id);
  return { kind: "user", userId: data.user.id, roles: (roles ?? []).map((r: any) => r.role), token };
}

export const isFinanceAdmin = (c: Caller | null) =>
  !!c && (c.kind === "service" || c.kind === "cron" ||
    (c.kind === "user" && (c.roles.includes("platform_admin") || c.roles.includes("school_admin"))));
