import { supabase } from "@/integrations/supabase/client";

/** Grade/invoice delivery is owned by database triggers, not a second browser sender. */
export async function dispatchSubmissionNotification(recordId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("lms-event-notify", {
      body: { event: "assignment_submitted", record_id: recordId },
    });
    return !error && data?.ok === true;
  } catch {
    return false;
  }
}