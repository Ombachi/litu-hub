import { useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, Wallet, TrendingDown, TrendingUp, AlertCircle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { feesApi } from "@/lib/api/fees";
import { toast } from "sonner";

const fmtKES = (cents: number) =>
  `KES ${(cents / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

interface Props {
  invoices: any[];
  student: { first_name?: string; last_name?: string; email?: string } | null;
  institution: { name?: string; logo_url?: string | null; address?: string | null; contact_email?: string | null; contact_phone?: string | null } | null;
}

export function FeeStatement({ invoices, student, institution }: Props) {
  const totals = useMemo(() => {
    let subtotal = 0, discount = 0, scholarship = 0, bursary = 0, tax = 0, billed = 0, paid = 0, overdue = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (const inv of invoices) {
      if (inv.status === "cancelled") continue;
      subtotal += inv.subtotal_cents ?? inv.total_cents ?? 0;
      discount += inv.discount_cents ?? 0;
      scholarship += inv.scholarship_cents ?? 0;
      bursary += inv.bursary_cents ?? 0;
      tax += inv.tax_cents ?? 0;
      billed += inv.total_cents;
      paid += inv.paid_cents;
      const remaining = inv.total_cents - inv.paid_cents;
      if (remaining > 0 && inv.due_date && inv.due_date < today) overdue += remaining;
    }
    return { subtotal, discount, scholarship, bursary, tax, billed, paid, outstanding: billed - paid, overdue };
  }, [invoices]);

  const allPayments = useMemo(() => {
    const list: any[] = [];
    for (const inv of invoices) {
      for (const p of inv.payments ?? []) {
        if (p.status === "succeeded") list.push({ ...p, invoice_ref: inv.reference });
      }
    }
    return list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  }, [invoices]);


  const studentName = `${student?.first_name ?? ""} ${student?.last_name ?? ""}`.trim() || "Student";

  const downloadStatement = () => {
    try {
      const doc = new jsPDF();
      const schoolName = institution?.name ?? "Litu Hub";
      doc.setFontSize(16);
      doc.setTextColor(32, 78, 56);
      doc.text(schoolName, 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(100);
      if (institution?.address) doc.text(institution.address, 14, 24);
      const contact = [institution?.contact_email, institution?.contact_phone].filter(Boolean).join(" · ");
      if (contact) doc.text(contact, 14, 29);

      doc.setFontSize(18);
      doc.setTextColor(20);
      doc.text("Fee Statement", 14, 42);

      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Student: ${studentName}`, 14, 50);
      if (student?.email) doc.text(`Email: ${student.email}`, 14, 55);
      doc.text(`Generated: ${new Date().toLocaleString("en-KE")}`, 14, 60);

      autoTable(doc, {
        startY: 68,
        head: [["Summary", "Amount"]],
        body: [
          ["Subtotal", fmtKES(totals.subtotal)],
          ...(totals.discount ? [["Discount", `- ${fmtKES(totals.discount)}`]] : []),
          ...(totals.scholarship ? [["Scholarship", `- ${fmtKES(totals.scholarship)}`]] : []),
          ...(totals.bursary ? [["Bursary", `- ${fmtKES(totals.bursary)}`]] : []),
          ...(totals.tax ? [["Tax / VAT", `+ ${fmtKES(totals.tax)}`]] : []),
          ["Total Billed", fmtKES(totals.billed)],
          ["Total Paid", fmtKES(totals.paid)],
          ["Outstanding Balance", fmtKES(totals.outstanding)],
          ["Overdue", fmtKES(totals.overdue)],
        ],
        theme: "grid",
        headStyles: { fillColor: [32, 78, 56], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 4 },
      });


      const yAfter = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(12);
      doc.setTextColor(20);
      doc.text("Invoices", 14, yAfter);

      autoTable(doc, {
        startY: yAfter + 4,
        head: [["Reference", "Description", "Due", "Billed", "Paid", "Balance", "Status"]],
        body: invoices.map((inv) => [
          inv.reference,
          inv.description || "—",
          inv.due_date ?? "—",
          fmtKES(inv.total_cents),
          fmtKES(inv.paid_cents),
          fmtKES(inv.total_cents - inv.paid_cents),
          inv.status,
        ]),
        theme: "striped",
        headStyles: { fillColor: [32, 78, 56], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 3 },
      });

      const yPay = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(12);
      doc.text("Payments Received", 14, yPay);
      autoTable(doc, {
        startY: yPay + 4,
        head: [["Date", "Invoice", "Method", "Reference", "Receipt #", "Amount"]],
        body: allPayments.map((p) => [
          new Date(p.created_at).toLocaleDateString("en-KE"),
          p.invoice_ref ?? "—",
          p.provider,
          p.provider_reference ?? "—",
          p.receipt_number ?? "—",
          fmtKES(p.amount_cents),
        ]),
        theme: "striped",
        headStyles: { fillColor: [32, 78, 56], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 3 },
      });

      doc.save(`fee-statement-${studentName.replace(/\s+/g, "_")}.pdf`);
    } catch (e: any) {
      toast.error(e.message ?? "Could not generate statement");
    }
  };

  const openReceipt = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from("receipts").download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error(e.message ?? "Could not open receipt");
    }
  };

  const downloadReceipt = async (path: string, name: string) => {
    try {
      const { data, error } = await supabase.storage.from("receipts").download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${name}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast.error(e.message ?? "Could not download receipt");
    }
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5 bg-gradient-to-br from-primary/5 to-accent/5">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Fee Statement</div>
          <div className="text-lg font-semibold">{studentName}</div>
          {institution?.name && <div className="text-sm text-muted-foreground">{institution.name}</div>}
        </div>
        <button
          onClick={downloadStatement}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Download className="h-4 w-4" /> Download statement (PDF)
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
        <SummaryCell icon={<Wallet className="h-4 w-4" />} label="Total Billed" value={fmtKES(totals.billed)} />
        <SummaryCell icon={<TrendingUp className="h-4 w-4 text-success" />} label="Paid" value={fmtKES(totals.paid)} tone="success" />
        <SummaryCell icon={<TrendingDown className="h-4 w-4" />} label="Outstanding" value={fmtKES(totals.outstanding)} tone={totals.outstanding > 0 ? "warning" : "muted"} />
        <SummaryCell icon={<AlertCircle className="h-4 w-4" />} label="Overdue" value={fmtKES(totals.overdue)} tone={totals.overdue > 0 ? "destructive" : "muted"} />
      </div>

      {(totals.discount || totals.scholarship || totals.bursary || totals.tax) ? (
        <div className="border-t p-5 bg-secondary/10">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Adjustments breakdown</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <BreakdownRow label="Subtotal" value={fmtKES(totals.subtotal)} />
            {!!totals.discount && <BreakdownRow label="Discount" value={`- ${fmtKES(totals.discount)}`} tone="success" />}
            {!!totals.scholarship && <BreakdownRow label="Scholarship" value={`- ${fmtKES(totals.scholarship)}`} tone="success" />}
            {!!totals.bursary && <BreakdownRow label="Bursary" value={`- ${fmtKES(totals.bursary)}`} tone="success" />}
            {!!totals.tax && <BreakdownRow label="Tax / VAT" value={`+ ${fmtKES(totals.tax)}`} />}
            <BreakdownRow label="Net Billed" value={fmtKES(totals.billed)} strong />
          </div>
        </div>
      ) : null}



      {allPayments.length > 0 && (
        <div className="p-5">
          <div className="text-xs uppercase text-muted-foreground mb-3">Payments & Receipts</div>
          <div className="space-y-2">
            {allPayments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {p.receipt_number ?? p.provider_reference ?? "Payment"} · {fmtKES(p.amount_cents)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("en-KE")} · {p.provider} · Invoice {p.invoice_ref}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{p.status}</Badge>
                  {p.receipt_url ? (
                    <>
                      <button onClick={() => openReceipt(p.receipt_url)} className="text-xs text-primary hover:underline">View</button>
                      <button onClick={() => downloadReceipt(p.receipt_url, p.receipt_number ?? p.id)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-secondary/50">
                        <Download className="h-3 w-3" /> Download
                      </button>
                    </>
                  ) : (
                    <GenerateInlineReceipt paymentId={p.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCell({ icon, label, value, tone = "muted" }: { icon: React.ReactNode; label: string; value: string; tone?: "muted" | "success" | "warning" | "destructive" }) {
  const toneClass = {
    muted: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className="bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
      <div className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function BreakdownRow({ label, value, tone, strong }: { label: string; value: string; tone?: "success"; strong?: boolean }) {
  const cls = tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className={`flex items-center justify-between rounded-md bg-background px-3 py-2 ${strong ? "border font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}


function GenerateInlineReceipt({ paymentId }: { paymentId: string }) {
  const generate = async () => {
    try {
      await feesApi.generateReceipt(paymentId);
      toast.success("Receipt requested — refresh in a moment");
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <button onClick={generate} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-secondary/50">
      <FileText className="h-3 w-3" /> Generate
    </button>
  );
}
