import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { feesApi } from "@/lib/api/fees";
import { useMyInstitution } from "@/hooks/useInstitution";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, CheckCircle2, Ban, RefreshCw, FileText, XCircle } from "lucide-react";
import { toast } from "sonner";

const fmtKES = (cents: number) => `KES ${(cents / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

const BursarTab = () => {
  const qc = useQueryClient();
  const { data: inst } = useMyInstitution();
  const institutionId = inst?.id;

  const { data: structures } = useQuery({
    queryKey: ["fee-structures", institutionId],
    enabled: !!institutionId,
    queryFn: () => feesApi.listStructures(institutionId!),
  });

  const { data: invoices, isLoading: loadingInv } = useQuery({
    queryKey: ["inst-invoices", institutionId],
    enabled: !!institutionId,
    queryFn: () => feesApi.listInstitutionInvoices(institutionId!),
  });

  const { data: terms } = useQuery({
    queryKey: ["bursar-terms"],
    queryFn: async () => (await (supabase as any).from("terms").select("id,name").order("start_date", { ascending: false })).data ?? [],
  });

  const { data: members } = useQuery({
    queryKey: ["bursar-members", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data: ui } = await (supabase as any).from("user_institutions").select("user_id").eq("institution_id", institutionId);
      const ids = (ui ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data: roles } = await (supabase as any).from("user_roles").select("user_id,role").in("user_id", ids);
      const studentIds = (roles ?? []).filter((r: any) => r.role === "student").map((r: any) => r.user_id);
      if (!studentIds.length) return [];
      const { data: profiles } = await (supabase as any).from("profiles").select("user_id,first_name,last_name,email").in("user_id", studentIds);
      return profiles ?? [];
    },
  });

  const [structForm, setStructForm] = useState({ name: "", amount: "", due: "", term: "" });
  const [invForm, setInvForm] = useState({ student: "", amount: "", description: "", due: "", installments: "1" });

  const createStructure = useMutation({
    mutationFn: () => feesApi.createStructure({
      institution_id: institutionId!,
      name: structForm.name,
      amount_cents: Math.round(parseFloat(structForm.amount || "0") * 100),
      due_date: structForm.due || null,
      term_id: structForm.term || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fee-structures"] }); setStructForm({ name: "", amount: "", due: "", term: "" }); toast.success("Fee structure added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const issueInvoice = useMutation({
    mutationFn: () => {
      const total = Math.round(parseFloat(invForm.amount || "0") * 100);
      const n = Math.max(1, parseInt(invForm.installments || "1", 10));
      const installments = n > 1
        ? Array.from({ length: n }).map((_, i) => {
            const base = new Date(invForm.due || Date.now());
            base.setMonth(base.getMonth() + i);
            return {
              sequence: i + 1,
              amount_cents: i === n - 1 ? total - Math.floor(total / n) * (n - 1) : Math.floor(total / n),
              due_date: base.toISOString().slice(0, 10),
            };
          })
        : undefined;
      return feesApi.issueInvoice({
        institution_id: institutionId!,
        student_id: invForm.student,
        total_cents: total,
        description: invForm.description,
        due_date: invForm.due || null,
        installments,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inst-invoices"] }); setInvForm({ student: "", amount: "", description: "", due: "", installments: "1" }); toast.success("Invoice issued"); },
    onError: (e: any) => toast.error(e.message),
  });

  const recordPayment = useMutation({
    mutationFn: (p: { invoice_id: string; amount_cents: number; ref: string }) =>
      feesApi.recordManualPayment({ invoice_id: p.invoice_id, amount_cents: p.amount_cents, provider: "bank_transfer", provider_reference: p.ref }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inst-invoices"] }); qc.invalidateQueries({ queryKey: ["inv-payments"] }); toast.success("Payment recorded"); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelInv = useMutation({
    mutationFn: (id: string) => feesApi.cancelInvoice(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inst-invoices"] }); toast.success("Invoice cancelled"); },
  });

  const recompute = useMutation({
    mutationFn: () => feesApi.recomputeStatuses(institutionId!),
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["inst-invoices"] }); toast.success(`Recalculated. ${n} invoice(s) updated.`); },
    onError: (e: any) => toast.error(e.message),
  });

  const studentMap = useMemo(() => new Map((members ?? []).map((m: any) => [m.user_id, m])), [members]);

  if (!institutionId) return <p className="text-muted-foreground">No institution.</p>;

  return (
    <Tabs defaultValue="structures" className="w-full">
      <TabsList>
        <TabsTrigger value="structures">Structures</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
      </TabsList>

      <TabsContent value="structures" className="space-y-8">
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-display text-lg font-semibold mb-4">Fee Structures</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
            <Input placeholder="Name (e.g. Term 1 Tuition)" value={structForm.name} onChange={e => setStructForm({ ...structForm, name: e.target.value })} aria-label="Fee structure name" />
            <Input placeholder="Amount (KES)" type="number" value={structForm.amount} onChange={e => setStructForm({ ...structForm, amount: e.target.value })} aria-label="Amount in KES" />
            <Input type="date" value={structForm.due} onChange={e => setStructForm({ ...structForm, due: e.target.value })} aria-label="Due date" />
            <Select value={structForm.term} onValueChange={v => setStructForm({ ...structForm, term: v })}>
              <SelectTrigger><SelectValue placeholder="Term (optional)" /></SelectTrigger>
              <SelectContent>{(terms ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <button onClick={() => createStructure.mutate()} disabled={!structForm.name || !structForm.amount || createStructure.isPending} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground inline-flex items-center justify-center gap-1 disabled:opacity-50">
              {createStructure.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </button>
          </div>
          <div className="space-y-2">
            {(structures ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{fmtKES(s.amount_cents)} · {s.terms?.name ?? "No term"} · Due {s.due_date ?? "—"}</div>
                </div>
                <button onClick={() => feesApi.deleteStructure(s.id).then(() => qc.invalidateQueries({ queryKey: ["fee-structures"] }))} aria-label={`Delete ${s.name}`} className="p-2 text-destructive hover:bg-destructive/10 rounded">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {!structures?.length && <p className="text-sm text-muted-foreground">No fee structures yet.</p>}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="font-display text-lg font-semibold mb-4">Issue Invoice</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
            <Select value={invForm.student} onValueChange={v => setInvForm({ ...invForm, student: v })}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>{(members ?? []).map((m: any) => <SelectItem key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Amount (KES)" type="number" value={invForm.amount} onChange={e => setInvForm({ ...invForm, amount: e.target.value })} aria-label="Invoice amount" />
            <Input placeholder="Description" value={invForm.description} onChange={e => setInvForm({ ...invForm, description: e.target.value })} aria-label="Description" />
            <Input type="date" value={invForm.due} onChange={e => setInvForm({ ...invForm, due: e.target.value })} aria-label="Due date" />
            <div className="flex gap-2">
              <Input type="number" min={1} max={12} placeholder="Installments" value={invForm.installments} onChange={e => setInvForm({ ...invForm, installments: e.target.value })} aria-label="Number of installments" />
              <button onClick={() => issueInvoice.mutate()} disabled={!invForm.student || !invForm.amount || issueInvoice.isPending} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground inline-flex items-center gap-1 disabled:opacity-50">
                {issueInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Issue
              </button>
            </div>
          </div>
        </section>
      </TabsContent>

      <TabsContent value="invoices">
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">Invoices</h3>
            <button onClick={() => recompute.mutate()} disabled={recompute.isPending} className="rounded-lg border px-3 py-2 text-sm inline-flex items-center gap-1 hover:bg-secondary/50 disabled:opacity-50">
              {recompute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Recalculate statuses
            </button>
          </div>
          {loadingInv ? <Loader2 className="h-6 w-6 animate-spin" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="text-xs uppercase text-muted-foreground border-b">
                  <tr><th className="text-left py-2">Reference</th><th className="text-left">Student</th><th className="text-right">Total</th><th className="text-right">Paid</th><th>Status</th><th>Due</th><th></th></tr>
                </thead>
                <tbody>
                  {(invoices ?? []).map((i: any) => {
                    const s = studentMap.get(i.student_id) as any;
                    return (
                      <tr key={i.id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">{i.reference}</td>
                        <td>{s ? `${s.first_name} ${s.last_name}` : i.student_id.slice(0, 8)}</td>
                        <td className="text-right">{fmtKES(i.total_cents)}</td>
                        <td className="text-right">{fmtKES(i.paid_cents)}</td>
                        <td><Badge variant={i.status === "paid" ? "default" : i.status === "overdue" ? "destructive" : "secondary"} className="capitalize">{i.status}</Badge></td>
                        <td className="text-xs">{i.due_date ?? "—"}</td>
                        <td className="text-right">
                          {i.status !== "paid" && i.status !== "cancelled" && (
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => {
                                const amt = prompt("Amount received (KES)", ((i.total_cents - i.paid_cents) / 100).toString());
                                const ref = prompt("Bank reference", "");
                                if (amt && ref) recordPayment.mutate({ invoice_id: i.id, amount_cents: Math.round(parseFloat(amt) * 100), ref });
                              }} aria-label="Record payment" className="p-1 text-success hover:bg-success/10 rounded"><CheckCircle2 className="h-4 w-4" /></button>
                              <button onClick={() => confirm("Cancel this invoice?") && cancelInv.mutate(i.id)} aria-label="Cancel invoice" className="p-1 text-destructive hover:bg-destructive/10 rounded"><Ban className="h-4 w-4" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!invoices?.length && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No invoices yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </TabsContent>

      <TabsContent value="reconciliation">
        <ReconciliationView invoices={invoices ?? []} studentMap={studentMap} />
      </TabsContent>
    </Tabs>
  );
};

const ReconciliationView = ({ invoices, studentMap }: { invoices: any[]; studentMap: Map<string, any> }) => {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="font-display text-lg font-semibold mb-4">Payment Reconciliation</h3>
      <p className="text-sm text-muted-foreground mb-4">Confirm or reject pending payments. Successful payments auto-generate a PDF receipt.</p>
      <div className="space-y-2">
        {invoices.map(i => {
          const s = studentMap.get(i.student_id);
          return (
            <div key={i.id} className="rounded-lg border">
              <button onClick={() => setOpen(open === i.id ? null : i.id)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/30">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{i.reference}</div>
                  <div className="text-sm font-medium">{s ? `${s.first_name} ${s.last_name}` : i.student_id.slice(0, 8)} · {fmtKES(i.total_cents)}</div>
                </div>
                <Badge variant={i.status === "paid" ? "default" : i.status === "overdue" ? "destructive" : "secondary"} className="capitalize">{i.status}</Badge>
              </button>
              {open === i.id && <InvoicePayments invoiceId={i.id} />}
            </div>
          );
        })}
        {!invoices.length && <p className="text-sm text-muted-foreground">No invoices to reconcile.</p>}
      </div>
    </div>
  );
};

const InvoicePayments = ({ invoiceId }: { invoiceId: string }) => {
  const qc = useQueryClient();
  const { data: payments, isLoading } = useQuery({
    queryKey: ["inv-payments", invoiceId],
    queryFn: () => feesApi.listPaymentsForInvoice(invoiceId),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "succeeded" | "failed" }) => feesApi.setPaymentStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inv-payments", invoiceId] });
      qc.invalidateQueries({ queryKey: ["inst-invoices"] });
      toast.success("Payment updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openReceipt = async (path: string) => {
    try { window.open(await feesApi.receiptUrl(path), "_blank"); }
    catch (e: any) { toast.error(e.message); }
  };

  if (isLoading) return <div className="p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!payments?.length) return <p className="px-4 py-3 text-sm text-muted-foreground border-t">No payments attempted.</p>;

  return (
    <div className="border-t divide-y">
      {(payments as any[]).map(p => (
        <div key={p.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            <div className="font-mono text-xs">{p.provider_reference}</div>
            <div className="text-xs text-muted-foreground capitalize">{p.provider} · {fmtKES(p.amount_cents)} · {new Date(p.created_at).toLocaleString()}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={p.status === "succeeded" ? "default" : p.status === "failed" ? "destructive" : "secondary"} className="capitalize">{p.status}</Badge>
            {p.receipt_url && (
              <button onClick={() => openReceipt(p.receipt_url)} aria-label="View receipt" className="p-1 hover:bg-secondary/50 rounded">
                <FileText className="h-4 w-4" />
              </button>
            )}
            {p.status === "pending" && (
              <>
                <button onClick={() => setStatus.mutate({ id: p.id, status: "succeeded" })} aria-label="Confirm payment" className="p-1 text-success hover:bg-success/10 rounded">
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <button onClick={() => setStatus.mutate({ id: p.id, status: "failed" })} aria-label="Mark failed" className="p-1 text-destructive hover:bg-destructive/10 rounded">
                  <XCircle className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BursarTab;
