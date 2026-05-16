import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { feesApi } from "@/lib/api/fees";
import { useStudentInvoices } from "@/hooks/useFees";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Wallet, Smartphone, CreditCard, Building2 } from "lucide-react";
import { toast } from "sonner";

const fmtKES = (cents: number) => `KES ${(cents / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

const FeesPage = () => {
  const { user } = useAuth();
  const { isParent, isStudent } = useRole();
  const qc = useQueryClient();

  // Parents: pick a child. Students: themselves.
  const { data: children } = useQuery({
    queryKey: ["fees-children", user?.id],
    enabled: !!user && isParent,
    queryFn: async () => {
      const { data: links } = await (supabase as any).from("parent_student_links").select("student_id,status").eq("parent_id", user!.id).eq("status", "approved");
      const ids = (links ?? []).map((l: any) => l.student_id);
      if (!ids.length) return [];
      const { data } = await (supabase as any).rpc("get_public_profiles", { _user_ids: ids });
      return data ?? [];
    },
  });

  const [studentId, setStudentId] = useState<string>("");
  const targetId = isStudent ? user?.id : (studentId || (children?.[0] as any)?.user_id);
  const { data: invoices, isLoading } = useStudentInvoices(targetId);

  const [paying, setPaying] = useState<string | null>(null);

  if (!user) return null;
  if (!isParent && !isStudent) return <p className="py-12 text-center text-muted-foreground">Fees are visible to students and linked parents.</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Fees & Payments</h1>
          <p className="mt-1 text-muted-foreground">Invoices, statements, and payment options.</p>
        </div>
        {isParent && children && children.length > 0 && (
          <Select value={studentId || (children[0] as any).user_id} onValueChange={setStudentId}>
            <SelectTrigger className="w-56" aria-label="Select child"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(children as any[]).map(c => <SelectItem key={c.user_id} value={c.user_id}>{c.first_name} {c.last_name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !invoices?.length ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Wallet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No invoices on this account.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(invoices as any[]).map(inv => {
            const remaining = inv.total_cents - inv.paid_cents;
            return (
              <div key={inv.id} className="rounded-xl border bg-card shadow-sm">
                <div className="p-5 flex flex-wrap items-start justify-between gap-3 border-b">
                  <div>
                    <div className="text-xs font-mono text-muted-foreground">{inv.reference}</div>
                    <div className="font-semibold">{inv.description || "Tuition Invoice"}</div>
                    <div className="text-xs text-muted-foreground">Due {inv.due_date ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant={inv.status === "paid" ? "default" : inv.status === "overdue" ? "destructive" : "secondary"} className="capitalize">{inv.status}</Badge>
                    <div className="text-lg font-semibold mt-1">{fmtKES(inv.total_cents)}</div>
                    <div className="text-xs text-muted-foreground">Paid {fmtKES(inv.paid_cents)} · Outstanding {fmtKES(remaining)}</div>
                  </div>
                </div>

                {inv.invoice_installments?.length > 0 && (
                  <div className="p-5 border-b">
                    <div className="text-xs uppercase text-muted-foreground mb-2">Installments</div>
                    <div className="space-y-1">
                      {inv.invoice_installments.sort((a: any, b: any) => a.sequence - b.sequence).map((ii: any) => (
                        <div key={ii.id} className="flex justify-between text-sm">
                          <span>#{ii.sequence} · Due {ii.due_date}</span>
                          <span className={ii.paid_cents >= ii.amount_cents ? "text-success" : "text-muted-foreground"}>
                            {fmtKES(ii.paid_cents)} / {fmtKES(ii.amount_cents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {inv.payments?.some((p: any) => p.status === "succeeded" && p.receipt_url) && (
                  <div className="p-5 border-b">
                    <div className="text-xs uppercase text-muted-foreground mb-2">Receipts</div>
                    <div className="space-y-1">
                      {(inv.payments as any[]).filter(p => p.status === "succeeded" && p.receipt_url).map(p => (
                        <ReceiptLink key={p.id} payment={p} />
                      ))}
                    </div>
                  </div>
                )}

                {remaining > 0 && (
                  <div className="p-5">
                    {paying === inv.id ? (
                      <PayForm invoice={inv} remaining={remaining} onDone={() => { setPaying(null); qc.invalidateQueries({ queryKey: ["invoices", targetId] }); }} onCancel={() => setPaying(null)} />
                    ) : (
                      <button onClick={() => setPaying(inv.id)} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        Pay {fmtKES(remaining)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PayForm = ({ invoice, remaining, onDone, onCancel }: { invoice: any; remaining: number; onDone: () => void; onCancel: () => void }) => {
  const [provider, setProvider] = useState("mpesa");
  const [amount, setAmount] = useState((remaining / 100).toString());
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const cents = Math.round(parseFloat(amount) * 100);
      if (!cents || cents <= 0 || cents > remaining) { toast.error("Invalid amount"); return; }
      const res = await feesApi.initiatePayment({ invoice_id: invoice.id, provider, amount_cents: cents, phone });
      toast.success(res.message);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { v: "mpesa", label: "M-Pesa", icon: Smartphone },
          { v: "flutterwave", label: "Card", icon: CreditCard },
          { v: "paystack", label: "Paystack", icon: CreditCard },
          { v: "bank_transfer", label: "Bank", icon: Building2 },
        ].map(p => (
          <button key={p.v} onClick={() => setProvider(p.v)} aria-pressed={provider === p.v}
            className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${provider === p.v ? "border-primary bg-primary/5" : "hover:bg-secondary/50"}`}>
            <p.icon className="h-4 w-4" /> {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount" placeholder="Amount (KES)" />
        {provider === "mpesa" && <Input value={phone} onChange={e => setPhone(e.target.value)} aria-label="M-Pesa phone number" placeholder="2547XXXXXXXX" />}
      </div>
      <div className="flex gap-2">
        <button onClick={submit} disabled={submitting} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 inline-flex items-center gap-2">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Payment
        </button>
        <button onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
      </div>
    </div>
  );
};

export default FeesPage;
