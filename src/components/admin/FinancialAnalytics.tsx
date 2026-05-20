import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyInstitution } from "@/hooks/useInstitution";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { Wallet, TrendingUp, AlertCircle, Users, Loader2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const fmtKES = (cents: number) => `KES ${(cents / 100).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
const COLORS = ["hsl(152, 45%, 40%)", "hsl(45, 80%, 50%)", "hsl(210, 60%, 50%)", "hsl(340, 55%, 50%)", "hsl(270, 50%, 55%)", "hsl(20, 70%, 50%)"];

const FinancialAnalytics = () => {
  const { data: inst } = useMyInstitution();
  const institutionId = inst?.id;

  const { data: invoices, isLoading: li } = useQuery({
    queryKey: ["fa-invoices", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("invoices")
        .select("id,student_id,total_cents,paid_cents,status,due_date,created_at,reference,description")
        .eq("institution_id", institutionId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: payments, isLoading: lp } = useQuery({
    queryKey: ["fa-payments", institutionId],
    enabled: !!invoices?.length,
    queryFn: async () => {
      const ids = invoices!.map((i) => i.id);
      const { data, error } = await (supabase as any).from("payments")
        .select("id,invoice_id,amount_cents,provider,status,created_at,provider_reference,receipt_number")
        .in("invoice_id", ids).eq("status", "succeeded").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: students } = useQuery({
    queryKey: ["fa-students", institutionId, invoices?.length],
    enabled: !!invoices?.length,
    queryFn: async () => {
      const ids = Array.from(new Set(invoices!.map((i) => i.student_id)));
      const { data } = await (supabase as any).from("profiles")
        .select("user_id,first_name,last_name,email").in("user_id", ids);
      return (data ?? []) as any[];
    },
  });

  const studentMap = useMemo(() => new Map((students ?? []).map((s: any) => [s.user_id, s])), [students]);

  const summary = useMemo(() => {
    const invs = invoices ?? [];
    const pays = payments ?? [];
    const billed = invs.filter((i) => i.status !== "cancelled").reduce((s, i) => s + Number(i.total_cents), 0);
    const collected = pays.reduce((s, p) => s + Number(p.amount_cents), 0);
    const outstanding = invs.filter((i) => i.status !== "cancelled" && i.status !== "paid")
      .reduce((s, i) => s + (Number(i.total_cents) - Number(i.paid_cents)), 0);
    const overdue = invs.filter((i) => i.status === "overdue")
      .reduce((s, i) => s + (Number(i.total_cents) - Number(i.paid_cents)), 0);
    const debtors = new Set(invs.filter((i) => i.status !== "cancelled" && i.status !== "paid").map((i) => i.student_id)).size;
    return { billed, collected, outstanding, overdue, debtors, invoiceCount: invs.length, paymentCount: pays.length };
  }, [invoices, payments]);

  const statusData = useMemo(() => {
    const m: Record<string, number> = {};
    (invoices ?? []).forEach((i) => { m[i.status] = (m[i.status] || 0) + 1; });
    return Object.entries(m).map(([name, value], idx) => ({ name, value, color: COLORS[idx % COLORS.length] }));
  }, [invoices]);

  const monthlyCollection = useMemo(() => {
    const months: Record<string, { month: string; collected: number; billed: number }> = {};
    const fmt = (d: Date) => d.toLocaleString("en-KE", { month: "short", year: "2-digit" });
    (payments ?? []).forEach((p) => {
      const k = fmt(new Date(p.created_at));
      months[k] = months[k] || { month: k, collected: 0, billed: 0 };
      months[k].collected += Number(p.amount_cents) / 100;
    });
    (invoices ?? []).forEach((i) => {
      if (i.status === "cancelled") return;
      const k = fmt(new Date(i.created_at));
      months[k] = months[k] || { month: k, collected: 0, billed: 0 };
      months[k].billed += Number(i.total_cents) / 100;
    });
    return Object.values(months).slice(-12);
  }, [invoices, payments]);

  const providerBreakdown = useMemo(() => {
    const m: Record<string, number> = {};
    (payments ?? []).forEach((p) => { m[p.provider] = (m[p.provider] || 0) + Number(p.amount_cents); });
    return Object.entries(m).map(([name, value], idx) => ({ name, value: value / 100, color: COLORS[idx % COLORS.length] }));
  }, [payments]);

  const topDebtors = useMemo(() => {
    const m = new Map<string, number>();
    (invoices ?? []).forEach((i) => {
      if (i.status === "paid" || i.status === "cancelled") return;
      const owed = Number(i.total_cents) - Number(i.paid_cents);
      m.set(i.student_id, (m.get(i.student_id) || 0) + owed);
    });
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([sid, owed]) => {
        const s = studentMap.get(sid);
        return { id: sid, name: s ? `${s.first_name} ${s.last_name}` : sid.slice(0, 8), email: s?.email ?? "—", owed };
      });
  }, [invoices, studentMap]);

  const aging = useMemo(() => {
    const buckets = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const today = new Date();
    (invoices ?? []).forEach((i) => {
      if (i.status === "paid" || i.status === "cancelled" || !i.due_date) return;
      const owed = Number(i.total_cents) - Number(i.paid_cents);
      if (owed <= 0) return;
      const days = Math.floor((today.getTime() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 0) buckets.current += owed;
      else if (days <= 30) buckets["1-30"] += owed;
      else if (days <= 60) buckets["31-60"] += owed;
      else if (days <= 90) buckets["61-90"] += owed;
      else buckets["90+"] += owed;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, amount: value / 100 }));
  }, [invoices]);

  const exportCsv = () => {
    const rows = [
      ["Reference", "Student", "Email", "Total", "Paid", "Outstanding", "Status", "Due", "Created"],
      ...(invoices ?? []).map((i) => {
        const s = studentMap.get(i.student_id);
        return [
          i.reference,
          s ? `${s.first_name} ${s.last_name}` : i.student_id,
          s?.email ?? "",
          (i.total_cents / 100).toString(),
          (i.paid_cents / 100).toString(),
          ((i.total_cents - i.paid_cents) / 100).toString(),
          i.status,
          i.due_date ?? "",
          new Date(i.created_at).toISOString().slice(0, 10),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `financial-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!institutionId) return <p className="text-muted-foreground">No institution.</p>;
  if (li || lp) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const collectionRate = summary.billed ? Math.round((summary.collected / summary.billed) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Financial Analytics</h3>
          <p className="text-sm text-muted-foreground">Money received, outstanding debt, and collection trends.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-secondary/50">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Billed", value: fmtKES(summary.billed), icon: TrendingUp, hint: `${summary.invoiceCount} invoices` },
          { label: "Collected", value: fmtKES(summary.collected), icon: Wallet, hint: `${collectionRate}% collection rate` },
          { label: "Outstanding", value: fmtKES(summary.outstanding), icon: AlertCircle, hint: `${summary.debtors} debtor(s)` },
          { label: "Overdue", value: fmtKES(summary.overdue), icon: AlertCircle, hint: "Past due date" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold truncate">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label} · {s.hint}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h4 className="font-semibold mb-3">Billed vs Collected (last 12 months)</h4>
          {monthlyCollection.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No data yet</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyCollection}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `KES ${Number(v).toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="billed" stroke="hsl(45, 80%, 50%)" strokeWidth={2} />
                <Line type="monotone" dataKey="collected" stroke="hsl(152, 45%, 40%)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h4 className="font-semibold mb-3">Outstanding by Age (days past due)</h4>
          {aging.every((b) => b.amount === 0) ? <p className="text-sm text-muted-foreground py-8 text-center">No outstanding debt</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={aging}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => `KES ${Number(v).toLocaleString()}`} />
                <Bar dataKey="amount" fill="hsl(20, 70%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h4 className="font-semibold mb-3">Invoice Status</h4>
          {statusData.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No invoices</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h4 className="font-semibold mb-3">Collection by Method</h4>
          {providerBreakdown.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No payments yet</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={providerBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={3} label={({ name }) => name}>
                  {providerBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `KES ${Number(v).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h4 className="font-semibold mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Top Debtors</h4>
        {topDebtors.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No outstanding debt 🎉</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr><th className="text-left py-2">Student</th><th className="text-left">Email</th><th className="text-right">Owed</th></tr>
              </thead>
              <tbody>
                {topDebtors.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-2">{d.name}</td>
                    <td className="text-muted-foreground text-xs">{d.email}</td>
                    <td className="text-right font-medium"><Badge variant="destructive">{fmtKES(d.owed)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h4 className="font-semibold mb-3">Recent Payments Received</h4>
        {(payments ?? []).length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No payments yet</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b">
                <tr><th className="text-left py-2">Receipt #</th><th className="text-left">Method</th><th className="text-left">Reference</th><th className="text-right">Amount</th><th className="text-left">When</th></tr>
              </thead>
              <tbody>
                {(payments ?? []).slice(0, 20).map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{p.receipt_number ?? "—"}</td>
                    <td className="capitalize">{p.provider.replace("_", " ")}</td>
                    <td className="font-mono text-xs">{p.provider_reference ?? "—"}</td>
                    <td className="text-right">{fmtKES(p.amount_cents)}</td>
                    <td className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialAnalytics;
