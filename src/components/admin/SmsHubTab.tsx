import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMyInstitution } from "@/hooks/useInstitution";
import { sanitizeSmsText, smsSegments, SMS_MAX_CHARS, type SmsAudience } from "@/lib/sms";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Wallet, Send, AlertTriangle } from "lucide-react";

type Msg = { id: string; event: string; recipient_phone: string | null; status: string; cost_cents: number; created_at: string; body: string };
const kes = (c: number) => `KES ${(c / 100).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
const statusVariant = (s: string): "default" | "destructive" | "secondary" => (s === "sent" ? "default" : s === "failed" ? "destructive" : "secondary");

export default function SmsHubTab() {
  const { data: inst } = useMyInstitution();
  const qc = useQueryClient();
  const [audience, setAudience] = useState<SmsAudience>("all_parents");
  const [cohortId, setCohortId] = useState("");
  const [message, setMessage] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [sending, setSending] = useState(false);

  const wallet = useQuery({
    queryKey: ["sms-wallet", inst?.id], enabled: !!inst?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("sms_wallets" as any) as any).select("balance_cents").eq("institution_id", inst!.id).maybeSingle();
      if (error) throw error;
      return (data?.balance_cents as number) ?? 0;
    },
  });
  const log = useQuery({
    queryKey: ["sms-log", inst?.id], enabled: !!inst?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("sms_messages" as any) as any)
        .select("id,event,recipient_phone,status,cost_cents,created_at,body").eq("institution_id", inst!.id)
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });
  const cohorts = useQuery({
    queryKey: ["sms-cohorts", inst?.id], enabled: !!inst?.id && audience === "cohort_parents",
    queryFn: async () => {
      const { data, error } = await (supabase.from("cohorts" as any) as any).select("id,stream_name,academic_year").eq("institution_id", inst!.id);
      if (error) throw error;
      return (data ?? []) as { id: string; stream_name: string; academic_year: string }[];
    },
  });

  const unavailable = wallet.isError || log.isError;
  const clean = sanitizeSmsText(message);
  const segs = clean ? smsSegments(clean) : 0;
  const canSend = clean.length > 0 && clean.length <= SMS_MAX_CHARS && (audience !== "cohort_parents" || !!cohortId) && !sending;

  const send = async () => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: { action: "broadcast", audience, message: clean, emergency, ...(audience === "cohort_parents" ? { cohort_id: cohortId } : {}) },
    });
    setSending(false);
    if (error) { toast.error("Couldn't send. Text messaging isn't available until the online database is resumed and SMS details are added."); return; }
    toast.success(`Queued for ${data?.recipients ?? 0} parent(s).`);
    setMessage("");
    qc.invalidateQueries({ queryKey: ["sms-log"] });
    qc.invalidateQueries({ queryKey: ["sms-wallet"] });
  };

  return (
    <div className="space-y-6">
      {unavailable && (
        <div className="flex items-start gap-2 rounded-md border border-accent bg-accent/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-accent-foreground" />
          <span>The SMS log and credit balance will appear once the online database is resumed.</span>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Wallet className="h-4 w-4" />SMS credit</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{wallet.data != null ? kes(wallet.data) : "—"}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><MessageSquare className="h-4 w-4" />Sent (last 100)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{log.data?.filter(m => m.status === "sent").length ?? "—"}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Failed / skipped</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{log.data?.filter(m => m.status === "failed" || m.status === "skipped").length ?? "—"}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-4 w-4" />Broadcast to parents</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Select value={audience} onValueChange={(v) => setAudience(v as SmsAudience)}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all_parents">All parents</SelectItem>
                <SelectItem value="cohort_parents">Parents in a class/stream</SelectItem>
                <SelectItem value="defaulters">Parents with overdue fees</SelectItem>
              </SelectContent>
            </Select>
            {audience === "cohort_parents" && (
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Choose class/stream" /></SelectTrigger>
                <SelectContent>
                  {(cohorts.data ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.stream_name} ({c.academic_year})</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message…" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className={clean.length > SMS_MAX_CHARS ? "text-destructive" : ""}>{clean.length}/{SMS_MAX_CHARS} characters · {segs} SMS part(s) per parent</span>
            <label className="flex items-center gap-2"><Checkbox checked={emergency} onCheckedChange={(v) => setEmergency(!!v)} />Mark as emergency</label>
          </div>
          <Button onClick={send} disabled={!canSend}>{sending ? "Sending…" : "Send broadcast"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Message history</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {!log.data?.length ? <p className="text-sm text-muted-foreground">No messages yet.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-2">Time</th><th>Type</th><th>Phone</th><th>Status</th><th>Cost</th><th>Message</th></tr></thead>
              <tbody>
                {log.data.map(m => (
                  <tr key={m.id} className="border-t">
                    <td className="py-2 whitespace-nowrap">{new Date(m.created_at).toLocaleString("en-KE")}</td>
                    <td className="capitalize">{m.event.replace("_", " ")}</td>
                    <td>{m.recipient_phone ?? "—"}</td>
                    <td><Badge variant={statusVariant(m.status)}>{m.status}</Badge></td>
                    <td>{kes(m.cost_cents)}</td>
                    <td className="max-w-xs truncate">{m.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
