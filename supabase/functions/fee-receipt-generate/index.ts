// Idempotently generate a fee-receipt PDF for a successful payment and
// trigger the email/SMS notification. Safe to call from the webhook,
// from the bursar UI after a manual reconciliation, or from the
// "Regenerate" button on the fees page.
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (s: number, b: unknown) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const fmtKES = (c: number) => `KES ${(c / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

async function generatePdf(o: {
  receiptNumber: string; invoiceRef: string; amountCents: number;
  provider: string; providerRef: string; studentName: string;
  institutionName: string; paidAt: Date;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 420]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.12, 0.31, 0.22);
  const grey = rgb(0.35, 0.35, 0.35);
  const draw = (t: string, x: number, y: number, size = 11, f = font, c = rgb(0,0,0)) =>
    page.drawText(t, { x, y, size, font: f, color: c });
  draw(o.institutionName, 40, 380, 18, bold, green);
  draw("Payment Receipt", 40, 358, 12, font, grey);
  draw(`#${o.receiptNumber}`, 420, 380, 12, bold, green);
  draw(o.paidAt.toLocaleString("en-KE"), 380, 362, 10, font, grey);
  page.drawLine({ start: { x: 40, y: 340 }, end: { x: 555, y: 340 }, thickness: 1, color: green });
  const rows: [string,string][] = [
    ["Student", o.studentName], ["Invoice", o.invoiceRef],
    ["Method", o.provider.toUpperCase()], ["Reference", o.providerRef],
  ];
  rows.forEach(([k, v], i) => { draw(k, 40, 310 - i*22, 11, bold); draw(v, 160, 310 - i*22, 11); });
  page.drawRectangle({ x: 40, y: 140, width: 515, height: 60, color: rgb(0.96,0.94,0.88) });
  draw("Amount Paid", 56, 170, 12, bold, grey);
  draw(fmtKES(o.amountCents), 56, 150, 22, bold, green);
  draw("System-generated receipt. Keep for your records.", 40, 60, 9, font, grey);
  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Auth: allow service-role (webhook) OR an authenticated admin/bursar/parent
  // who can already see the payment via RLS. We just verify a JWT exists.
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json(401, { error: "unauthorized" });

  let body: any = {};
  try { body = await req.json(); } catch { return json(400, { error: "invalid json" }); }
  const paymentId = body?.payment_id;
  if (!paymentId) return json(400, { error: "payment_id required" });

  const { data: payment } = await admin.from("payments")
    .select("id,status,amount_cents,provider,provider_reference,invoice_id,receipt_url,receipt_number")
    .eq("id", paymentId).maybeSingle();
  if (!payment) return json(404, { error: "payment not found" });
  if (payment.status !== "succeeded") return json(400, { error: "payment not succeeded" });

  // Already generated → idempotent success
  if (payment.receipt_url) {
    return json(200, { ok: true, idempotent: true, receipt_url: payment.receipt_url, receipt_number: payment.receipt_number });
  }

  // Claim — only the first caller proceeds. Others get a 202.
  const claimToken = crypto.randomUUID();
  const { data: claimed } = await admin.rpc("claim_payment_for_receipt", {
    _payment_id: paymentId, _claim_token: claimToken,
  });
  if (!claimed) return json(202, { ok: true, in_progress: true });

  try {
    const { data: inv } = await admin.from("invoices")
      .select("reference,student_id,institutions(name)").eq("id", payment.invoice_id).maybeSingle();
    const { data: prof } = await admin.from("profiles")
      .select("first_name,last_name").eq("user_id", inv?.student_id).maybeSingle();

    const receiptNumber = `RCPT-${Date.now().toString(36).toUpperCase()}-${payment.id.slice(0, 6).toUpperCase()}`;
    const pdfBytes = await generatePdf({
      receiptNumber,
      invoiceRef: inv?.reference ?? "—",
      amountCents: payment.amount_cents,
      provider: payment.provider,
      providerRef: payment.provider_reference ?? "",
      studentName: prof ? `${prof.first_name ?? ""} ${prof.last_name ?? ""}`.trim() || "Student" : "Student",
      institutionName: (inv as any)?.institutions?.name ?? "Litu Hub",
      paidAt: new Date(),
    });

    const path = `${payment.invoice_id}/${payment.id}.pdf`;
    const { error: upErr } = await admin.storage.from("receipts").upload(path, pdfBytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (upErr) throw upErr;

    await admin.from("payments").update({ receipt_url: path, receipt_number: receiptNumber }).eq("id", payment.id);

    // Fire notification (don't block on it).
    try {
      const notifyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fee-receipt-notify`;
      fetch(notifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ payment_id: payment.id }),
      }).catch((e) => console.error("[fee-receipt-generate] notify dispatch failed", e));
    } catch (e) { console.error("[fee-receipt-generate] notify invoke failed", e); }

    return json(200, { ok: true, receipt_url: path, receipt_number: receiptNumber });
  } catch (e) {
    console.error("[fee-receipt-generate] failed", e);
    return json(500, { error: String((e as Error).message ?? e) });
  }
});
