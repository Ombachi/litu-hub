import { describe, expect, it, vi } from "vitest";
import { submissionNotificationId } from "../../supabase/functions/_shared/notificationIdentity";
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
import { dispatchSubmissionNotification } from "@/lib/api/lmsEvents";

describe("Submission notifications", () => {
  it("uses stable per-submission per-recipient IDs for concurrent retries", async () => {
    const id = await submissionNotificationId("submission-1", "tutor-1");
    expect(await submissionNotificationId("submission-1", "tutor-1")).toBe(id);
    expect(await submissionNotificationId("submission-1", "tutor-2")).not.toBe(id);
    expect(await submissionNotificationId("submission-2", "tutor-1")).not.toBe(id);
  });
  it("sends only the event and record identifier, never client-selected recipients", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    expect(await dispatchSubmissionNotification("record-1")).toBe(true);
    expect(invoke).toHaveBeenCalledWith("lms-event-notify", { body: { event: "assignment_submitted", record_id: "record-1" } });
  });
  it("keeps submissions successful when notification delivery is unavailable", async () => {
    invoke.mockRejectedValue(new Error("offline"));
    expect(await dispatchSubmissionNotification("record-1")).toBe(false);
  });
});