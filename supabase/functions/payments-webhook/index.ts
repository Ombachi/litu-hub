// Generic webhook receiver for payment providers. Idempotent. On success it
// updates the payment row (the `on_payment_succeeded` trigger reconciles the
// invoice) and then generates a PDF receipt into the `receipts` bucket.
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, verif-hash, x-paystack-signature",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fmtKES = (cents: number) => `KES ${(cents / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

async function generateReceiptPdf(opts: {
  receiptNumber: string; invoiceRef: string; amountCents: number; provider: string; providerRef: string;
  studentName: string; institutionName: string; paidAt: Date;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 420]); // A5-ish landscape-ish
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.12, 0.31, 0.22);
  const grey = rgb(0.35, 0.35, 0.35);

  const draw = (t: string, x: number, y: number, size = 11, f = font, color = rgb(0, 0, 0)) =>
    page.drawText(t, { x, y, size, font: f, color });

  draw(opts.institutionName, 40, 380, 18, bold, green);
  draw("Payment Receipt", 40, 358, 12, font, grey);
  draw(`#${opts.receiptNumber}`, 420, 380, 12, bold, green);
  draw(opts.paidAt.toLocaleString("en-KE"), 420, 362, 10, font, grey);

  page.drawLine({ start: { x: 40, y: 340 }, end: { x: 555, y: 340 }, thickness: 1, color: green });

  const rows: [string, string][] = [
    ["Student", opts.studentName],
    ["Invoice", opts.invoiceRef],
    ["Method", opts.provider.toUpperCase()],
    ["Reference", opts.providerRef],
  ];
  rows.forEach(([k, v], i) => {
    draw(k, 40, 310 - i * 22, 11, bold);
    draw(v, 160, 310 - i * 22, 11);
  });

  page.drawRectangle({ x: 40, y: 140, width: 515, height: 60, color: rgb(0.96, 0.94, 0.88) });
  draw("Amount Paid", 56, 170, 12, bold, grey);
  draw(fmtKES(opts.amountCents), 56, 150, 22, bold, green);

  draw("This is a system-generated receipt. Keep for your records.", 40, 60, 9, font, grey);
  return await pdf.save();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const url = new URL(req.url);
  const provider = (url.searchParams.get("provider") ?? "").toLowerCase();
  const bodyText = await req.text();
  let body: any = {};
  try { body = JSON.parse(bodyText); } catch {}

  // Signature checks (only when keys present — otherwise accept stub callbacks)
  if (provider === "flutterwave") {
    const expected = Deno.env.get("FLW_WEBHOOK_SECRET");
    if (expected && req.headers.get("verif-hash") !== expected) return json(401, { error: "invalid signature" });
  }

  let providerRef: string | null = null;
  let outcome: "succeeded" | "failed" = "failed";
  let amountCents: number | null = null;

  if (provider === "mpesa") {
    const stk = body?.Body?.stkCallback;
    providerRef = stk?.CheckoutRequestID || stk?.MerchantRequestID || body?.provider_reference;
    outcome = stk?.ResultCode === 0 ? "succeeded" : "failed";
    const amount = stk?.CallbackMetadata?.Item?.find((i: any) => i.Name === "Amount")?.Value;
    if (amount) amountCents = Math.round(Number(amount) * 100);
  } else if (provider === "flutterwave") {
    providerRef = body?.data?.tx_ref || body?.data?.flw_ref || body?.provider_reference;
    outcome = body?.data?.status === "successful" ? "succeeded" : "failed";
    if (body?.data?.amount) amountCents = Math.round(Number(body.data.amount) * 100);
  } else if (provider === "paystack") {
    providerRef = body?.data?.reference || body?.provider_reference;
    outcome = body?.event === "charge.success" ? "succeeded" : "failed";
    if (body?.data?.amount) amountCents = Number(body.data.amount);
  } else {
    providerRef = body?.provider_reference;
    outcome = body?.status === "succeeded" ? "succeeded" : "failed";
    amountCents = body?.amount_cents ?? null;
  }

  if (!providerRef) return json(400, { error: "missing provider_reference" });

  const { data: payment } = await admin.from("payments")
    .select("id,status,amount_cents,invoice_id,provider,provider_reference,receipt_url")
    .eq("provider_reference", providerRef).maybeSingle();
  if (!payment) return json(404, { error: "payment not found" });
  if (payment.status === "succeeded" && payment.receipt_url) return json(200, { ok: true, idempotent: true });

  const finalAmount = amountCents && amountCents !== payment.amount_cents ? amountCents : payment.amount_cents;

  await admin.from("payments").update({
    status: outcome,
    raw_payload: body,
    ...(amountCents && amountCents !== payment.amount_cents ? { amount_cents: amountCents } : {}),
  }).eq("id", payment.id);

  // Receipt only on success
  if (outcome !== "succeeded") return json(200, { ok: true, status: outcome });

  try {
    const { data: inv } = await admin.from("invoices")
      .select("reference,student_id,institution_id,institutions(name)")
      .eq("id", payment.invoice_id).maybeSingle();
    const { data: prof } = await admin.from("profiles")
      .select("first_name,last_name").eq("user_id", inv?.student_id).maybeSingle();

    const receiptNumber = `RCPT-${Date.now().toString(36).toUpperCase()}-${payment.id.slice(0, 6).toUpperCase()}`;
    const pdfBytes = await generateReceiptPdf({
      receiptNumber,
      invoiceRef: inv?.reference ?? "—",
      amountCents: finalAmount,
      provider: payment.provider,
      providerRef: payment.provider_reference ?? "",
      studentName: prof ? `${prof.first_name} ${prof.last_name}`.trim() : "Student",
      institutionName: (inv as any)?.institutions?.name ?? "Litu Hub",
      paidAt: new Date(),
    });

    const path = `${payment.invoice_id}/${payment.id}.pdf`;
    const { error: upErr } = await admin.storage.from("receipts").upload(path, pdfBytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (upErr) throw upErr;

    await admin.from("payments").update({ receipt_url: path, receipt_number: receiptNumber }).eq("id", payment.id);
  } catch (e) {
    console.error("[payments-webhook] receipt generation failed", e);
  }

  return json(200, { ok: true, status: outcome });
});
