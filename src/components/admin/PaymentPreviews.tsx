import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMyInstitution } from "@/hooks/useInstitution";

const kes = (n: number) => `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;

export function ReceiptPreview() {
  const { data: inst } = useMyInstitution();
  const name = inst?.name ?? "Your School";
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div><CardTitle className="text-base">Receipt design</CardTitle>
          <CardDescription>How a receipt will look with your school's logo and colours. Sample figures only.</CardDescription></div>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print</Button>
      </CardHeader>
      <CardContent>
        <div className="mx-auto max-w-md rounded-lg border bg-background p-6 text-sm">
          <div className="flex items-center gap-3 border-b-4 border-primary pb-3">
            {inst?.logo_url ? <img src={inst.logo_url} alt="" className="h-12 w-12 object-contain" /> :
              <div className="h-12 w-12 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold">{name[0]}</div>}
            <div><div className="font-display font-semibold">{name}</div><div className="text-xs text-muted-foreground">{inst?.tagline ?? "Official payment receipt"}</div></div>
          </div>
          <div className="mt-4 flex justify-between"><span className="font-semibold">RECEIPT</span><span className="font-mono text-xs">RCT-2026-00123</span></div>
          <dl className="mt-3 space-y-1">
            {[["Student", "Jane Wanjiku · ADM 0042"], ["Invoice", "SCH-0042-INV-26"], ["Method", "M-Pesa · QK7XY12ABC"], ["Date", "21 Oct 2026"]].map(([k, v]) =>
              <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <div className="mt-4 rounded bg-secondary/40 p-3 flex justify-between font-semibold"><span>Amount paid</span><span>{kes(15000)}</span></div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>Balance remaining</span><span>{kes(10000)}</span></div>
          <p className="mt-4 text-center text-xs text-muted-foreground">Thank you. Keep this receipt for your records.</p>
        </div>
      </CardContent>
    </Card>
  );
}

const MONTHS = [["Jul", 420], ["Aug", 610], ["Sep", 980], ["Oct", 540]].map(([m, v]) => ({ m, v: (v as number) * 1000 }));
const METHODS = [{ n: "M-Pesa", v: 72 }, { n: "Bank", v: 18 }, { n: "Card", v: 7 }, { n: "Cash", v: 3 }];
const AGING = [{ b: "0–30 days", v: 310000 }, { b: "31–60", v: 145000 }, { b: "61–90", v: 62000 }, { b: "90+", v: 28000 }];
const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))", "hsl(var(--secondary-foreground))"];

export function PaymentChartsPreview() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground"><Badge variant="secondary" className="mr-2">Sample data</Badge>Real figures appear once the database is resumed.</p>
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Collected", kes(2550000)], ["Collection rate", "78%"], ["Outstanding", kes(545000)], ["Overdue", kes(90000)]].map(([k, v]) =>
          <Card key={k}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="font-semibold">{v}</div></CardContent></Card>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Collections by month</CardTitle></CardHeader><CardContent className="h-56">
          <ResponsiveContainer><BarChart data={MONTHS}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="m" /><YAxis tickFormatter={v => `${v / 1000}k`} /><Tooltip formatter={(v: number) => kes(v)} /><Bar dataKey="v" fill="hsl(var(--primary))" radius={4} /></BarChart></ResponsiveContainer>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Payment methods</CardTitle></CardHeader><CardContent className="h-56">
          <ResponsiveContainer><PieChart><Pie data={METHODS} dataKey="v" nameKey="n" outerRadius={80} label={(e: any) => `${e.n} ${e.v}%`}>
            {METHODS.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
        </CardContent></Card>
        <Card className="md:col-span-2"><CardHeader><CardTitle className="text-base">Overdue fees by age</CardTitle></CardHeader><CardContent className="h-56">
          <ResponsiveContainer><BarChart data={AGING} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" tickFormatter={v => `${v / 1000}k`} /><YAxis type="category" dataKey="b" width={80} /><Tooltip formatter={(v: number) => kes(v)} /><Bar dataKey="v" fill="hsl(var(--destructive))" radius={4} /></BarChart></ResponsiveContainer>
        </CardContent></Card>
      </div>
    </div>
  );
}

const TEMPLATES = {
  receipt: { label: "Payment received", sms: "{school}: Payment of KES 15,000.00 for Jane Wanjiku received (Ref QK7XY12ABC). Balance KES 10,000.00. Thank you.", subject: "Receipt RCT-2026-00123" },
  failed: { label: "Payment failed", sms: "{school}: Your M-Pesa payment of KES 15,000.00 for Jane Wanjiku did not go through. Please try again from the parent portal.", subject: "Payment not completed" },
  overdue: { label: "Overdue reminder", sms: "{school}: Fees of KES 10,000.00 for Jane Wanjiku were due on 15 Oct 2026. Please pay via PayBill 123456, account SCH-0042.", subject: "Fee reminder" },
  recon: { label: "Reconciliation alert", sms: "{school} bursar: 3 payments from yesterday's statement could not be matched to an invoice. Please review.", subject: "Unmatched payments" },
} as const;

export function NotificationPreviews() {
  const { data: inst } = useMyInstitution();
  const [k, setK] = useState<keyof typeof TEMPLATES>("receipt");
  const t = TEMPLATES[k];
  const school = inst?.name ?? "Your School";
  const body = t.sms.replace("{school}", school);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Message previews</CardTitle>
        <CardDescription>What parents and the bursar will receive. Sending starts once the database is resumed.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map(key =>
            <Button key={key} size="sm" variant={k === key ? "default" : "outline"} onClick={() => setK(key)}>{TEMPLATES[key].label}</Button>)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><div className="text-xs uppercase text-muted-foreground mb-2">SMS · {body.length} characters</div>
            <div className="rounded-2xl rounded-bl-sm bg-secondary p-3 text-sm max-w-xs">{body}</div></div>
          <div><div className="text-xs uppercase text-muted-foreground mb-2">Email</div>
            <div className="rounded-lg border text-sm">
              <div className="border-b-4 border-primary p-3 font-semibold">{school}</div>
              <div className="p-3 space-y-2"><div className="font-medium">{t.subject}</div><p className="text-muted-foreground">{body.replace(`${school}: `, "").replace(`${school} bursar: `, "")}</p></div>
            </div></div>
        </div>
      </CardContent>
    </Card>
  );
}
