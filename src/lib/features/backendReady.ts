/**
 * Frontend-first feature scaffolding.
 *
 * These screens (rubrics, exam integrity, engagement, progress) are built ahead of
 * their database tables. `safeSelect` lets a screen render normally when the table
 * does not exist yet instead of throwing, and reports that state so the UI can show
 * a "not connected yet" notice.
 */
import { supabase } from "@/integrations/supabase/client";

export type SafeResult<T> = { data: T[]; pending: boolean };

const MISSING_CODES = ["42P01", "PGRST205", "PGRST202", "42883"];

export function isMissingTable(error: any) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    MISSING_CODES.includes(code) ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

/** Select from a table that may not exist yet. */
export async function safeSelect<T = any>(
  table: string,
  build?: (q: any) => any,
): Promise<SafeResult<T>> {
  try {
    let query: any = (supabase as any).from(table).select("*");
    if (build) query = build(query);
    const { data, error } = await query;
    if (error) {
      if (isMissingTable(error)) return { data: [], pending: true };
      throw error;
    }
    return { data: (data || []) as T[], pending: false };
  } catch (e: any) {
    if (isMissingTable(e)) return { data: [], pending: true };
    throw e;
  }
}

/** Insert into a table that may not exist yet. Returns false when storage is not ready. */
export async function safeInsert(table: string, rows: any | any[]): Promise<boolean> {
  try {
    const { error } = await (supabase as any).from(table).insert(rows);
    if (error) {
      if (isMissingTable(error)) return false;
      throw error;
    }
    return true;
  } catch (e: any) {
    if (isMissingTable(e)) return false;
    throw e;
  }
}
