import { supabase } from "@/integrations/supabase/client";

export type FeeStatus = "none" | "paid" | "partial" | "grace" | "overdue" | "blocked";

export const feesApi = {
  feeStatus: async (studentId: string): Promise<FeeStatus> => {
    const { data, error } = await (supabase as any).rpc("get_fee_status", { _student_id: studentId });
    if (error) throw error;
    return (data as FeeStatus) ?? "none";
  },

  // Bursar
  listStructures: async (institutionId: string) => {
    const { data, error } = await (supabase as any)
      .from("fee_structures")
      .select("*, terms(name), courses(code,title)")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  createStructure: async (input: {
    institution_id: string; name: string; description?: string;
    amount_cents: number; term_id?: string | null; course_id?: string | null;
    due_date?: string | null;
  }) => {
    const { error } = await (supabase as any).from("fee_structures").insert(input);
    if (error) throw error;
  },
  deleteStructure: async (id: string) => {
    const { error } = await (supabase as any).from("fee_structures").delete().eq("id", id);
    if (error) throw error;
  },

  listInstitutionInvoices: async (institutionId: string) => {
    const { data, error } = await (supabase as any)
      .from("invoices")
      .select("*")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data;
  },
  issueInvoice: async (input: {
    institution_id: string; student_id: string; total_cents: number;
    description?: string; due_date?: string | null; fee_structure_id?: string | null;
    term_id?: string | null;
    installments?: { sequence: number; amount_cents: number; due_date: string }[];
  }) => {
    const reference = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { data: inv, error } = await (supabase as any).from("invoices").insert({
      institution_id: input.institution_id,
      student_id: input.student_id,
      total_cents: input.total_cents,
      description: input.description ?? "",
      due_date: input.due_date ?? null,
      fee_structure_id: input.fee_structure_id ?? null,
      term_id: input.term_id ?? null,
      reference,
      status: "issued",
    }).select().single();
    if (error) throw error;
    if (input.installments?.length) {
      const rows = input.installments.map(i => ({ ...i, invoice_id: inv.id }));
      const { error: ie } = await (supabase as any).from("invoice_installments").insert(rows);
      if (ie) throw ie;
    }
    return inv;
  },
  cancelInvoice: async (id: string) => {
    const { error } = await (supabase as any).from("invoices").update({ status: "cancelled" }).eq("id", id);
    if (error) throw error;
  },
  recordManualPayment: async (input: {
    invoice_id: string;
    amount_cents: number;
    provider: "bank_transfer" | "cash" | "mpesa" | "manual";
    provider_reference?: string;
    payer_name?: string;
    received_at?: string; // YYYY-MM-DD
    method_label?: string; // e.g. "Cheque", "Cash at office"
    notes?: string;
  }) => {
    const noteParts = [
      input.method_label ? `Method: ${input.method_label}` : null,
      input.payer_name ? `Received from: ${input.payer_name}` : null,
      input.received_at ? `Received on: ${input.received_at}` : null,
      input.notes ?? null,
    ].filter(Boolean);
    const { data: pay, error } = await (supabase as any).from("payments").insert({
      invoice_id: input.invoice_id,
      provider: input.provider,
      provider_reference: input.provider_reference ?? `MANUAL-${Date.now().toString(36).toUpperCase()}`,
      amount_cents: input.amount_cents,
      currency: "KES",
      status: "succeeded",
      notes: noteParts.length ? noteParts.join(" · ") : null,
      raw_payload: { source: "bursar_manual", payer_name: input.payer_name, method_label: input.method_label, received_at: input.received_at },
    }).select("id").single();
    if (error) throw error;
    try { await supabase.functions.invoke("fee-receipt-generate", { body: { payment_id: pay.id } }); }
    catch (e) { console.error("fee-receipt-generate failed", e); }
    return pay.id as string;
  },
  generateReceipt: async (payment_id: string) => {
    const { data, error } = await supabase.functions.invoke("fee-receipt-generate", { body: { payment_id } });
    if (error) throw error;
    return data as { ok: boolean; receipt_url?: string; receipt_number?: string };
  },
  retryReceiptDeliveries: async () => {
    const { data, error } = await supabase.functions.invoke("fee-receipt-retry", { body: {} });
    if (error) throw error;
    return data as { ok: boolean; retried: number; dlq?: number };
  },
  listDeliveryFailures: async (limit = 100) => {
    const { data, error } = await (supabase as any).from("email_delivery_log")
      .select("*").in("status", ["failed", "dlq"]).order("updated_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },
  setOverride: async (input: { student_id: string; blocked: boolean; grace_until?: string | null; reason?: string }) => {
    const { error } = await (supabase as any).from("student_fee_overrides").upsert({
      student_id: input.student_id,
      blocked: input.blocked,
      grace_until: input.grace_until ?? null,
      reason: input.reason ?? null,
    }, { onConflict: "student_id" });
    if (error) throw error;
  },

  // Student / parent
  listForStudent: async (studentId: string) => {
    const { data, error } = await (supabase as any)
      .from("invoices")
      .select("*, invoice_installments(*), payments(id,amount_cents,provider,status,created_at,provider_reference,receipt_url,receipt_number)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  initiatePayment: async (input: { invoice_id: string; provider: string; amount_cents: number; phone?: string; notes?: string }) => {
    const { data, error } = await supabase.functions.invoke("payments-initiate", { body: input });
    if (error) throw error;
    return data as { payment_id: string; provider_reference: string; stub: boolean; message: string };
  },

  // Signed URL for a stored receipt (1 hour)
  receiptUrl: async (path: string) => {
    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  // Bursar: list payments for an invoice
  listPaymentsForInvoice: async (invoiceId: string) => {
    const { data, error } = await (supabase as any).from("payments")
      .select("*").eq("invoice_id", invoiceId).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  // Bursar: confirm or fail a pending payment
  setPaymentStatus: async (paymentId: string, status: "succeeded" | "failed", notes?: string) => {
    const { error } = await (supabase as any).from("payments")
      .update({ status, notes: notes ?? null }).eq("id", paymentId);
    if (error) throw error;
  },

  // Bursar: recompute statuses across institution
  recomputeStatuses: async (institutionId: string) => {
    const { data, error } = await (supabase as any).rpc("recompute_fee_status_for_institution", { _institution_id: institutionId });
    if (error) throw error;
    return data as number;
  },
};
