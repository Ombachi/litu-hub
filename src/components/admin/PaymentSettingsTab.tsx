import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Eye, EyeOff, ShieldAlert, Smartphone, CreditCard, Landmark, CheckCircle2, Circle, Download, Upload, Loader2, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMyInstitution } from "@/hooks/useInstitution";
import { useRole } from "@/hooks/useRole";
import {
  isValidShortcode, isValidPrefix, isValidCallbackToken, buildReference, MPESA_REF_MAX,
  maskSecret, normalizeKenyanPhone, RECON_COLUMNS, validateReconCsv,
} from "@/lib/paymentConfig";

const SecretField = ({ label, value, onChange, valid }: { label: string; value: string; onChange: (v: string) => void; valid?: boolean }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input type={show ? "text" : "password"} value={value} autoComplete="off" spellCheck={false}
          onChange={e => onChange(e.target.value)} onPaste={() => setShow(false)} />
        <Button type="button" variant="outline" size="icon" onClick={() => setShow(s => !s)} aria-label={show ? "Hide" : "Show"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {value && <p className={`text-xs ${valid === false ? "text-destructive" : "text-muted-foreground"}`}>
        {valid === false ? "Invalid format" : `Will be stored as ${maskSecret(value)}`}
      </p>}
    </div>
  );
};

const StatusBadge = ({ s }: { s: "not_connected" | "pending" }) =>
  s === "pending" ? <Badge variant="secondary">Pending backend setup</Badge> : <Badge variant="outline">Not connected</Badge>;

const INVOICE_STATES = [
  ["Unpaid", "outline"], ["Pending confirmation", "secondary"], ["Paid", "default"], ["Partially paid", "secondary"],
  ["Overdue", "destructive"], ["Failed", "destructive"], ["Reversed", "outline"], ["Refunded", "outline"],
] as const;

export default function PaymentSettingsTab() {
  const { toast } = useToast();
  const { data: inst } = useMyInstitution();
  const { isAdmin } = useRole();

  const [mpesa, setMpesa] = useState({ enabled: false, env: "sandbox", type: "paybill", shortcode: "", prefix: "", business: "", key: "", secret: "", passkey: "", token: "" });
  const [methods, setMethods] = useState({ mpesa: true, card: false, bank: true, paystack: false, flutterwave: false });
  const [ref, setRef] = useState({ prefix: "SCH", student: "001", invoice: "INV", year: "2026" });
  const [flw, setFlw] = useState(""); const [pst, setPst] = useState("");
  const [stk, setStk] = useState<"idle" | "sent" | "timeout" | "cancelled" | "receipt">("idle");
  const [phone, setPhone] = useState("");
  const [csvResult, setCsvResult] = useState<ReturnType<typeof validateReconCsv> | null>(null);

  const r = buildReference(ref);
  const checks = {
    shortcode: !mpesa.shortcode || isValidShortcode(mpesa.shortcode),
    prefix: !mpesa.prefix || isValidPrefix(mpesa.prefix),
    token: !mpesa.token || isValidCallbackToken(mpesa.token),
  };
  const saveBlocked = () => toast({ title: "Not saved yet", description: "Secure key storage turns on once the backend is resumed. Values stay only in this browser tab." });

  const downloadTemplate = () => {
    const csv = RECON_COLUMNS.join(",") + "\n2026-01-15,mpesa,QWE123RTY,5000,Jane Wanjiku,INV-001\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "reconciliation-template.csv"; a.click();
  };

  const guide = [
    ["Create a Safaricom Daraja account and app", true],
    ["Test in sandbox with shortcode 174379", !!mpesa.shortcode],
    ["Enter consumer key, secret and passkey", !!(mpesa.key && mpesa.secret && mpesa.passkey)],
    ["Set a callback token (32+ characters)", isValidCallbackToken(mpesa.token)],
    ["Run a test STK prompt for KES 1", false],
    ["Request go-live from Safaricom, then switch to production", mpesa.env === "production"],
  ] as const;

  return (
    <div className="space-y-6">
      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Payment settings for {inst?.name ?? "your school"}</AlertTitle>
        <AlertDescription>
          {isAdmin ? "Platform view: you can see setup status only, never keys. " : ""}
          Saving is paused until the backend is resumed. Anything typed here stays in this tab only and is never sent anywhere.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="providers">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="methods">Methods & references</TabsTrigger>
          <TabsTrigger value="guide">M-Pesa guide</TabsTrigger>
          <TabsTrigger value="preview">Parent payment preview</TabsTrigger>
          <TabsTrigger value="recon">Reconciliation import</TabsTrigger>
          <TabsTrigger value="history">Change history</TabsTrigger>
          <TabsTrigger value="receipt">Receipt design</TabsTrigger>
          <TabsTrigger value="charts">Payment charts</TabsTrigger>
          <TabsTrigger value="messages">Message previews</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div><CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" />M-Pesa (Daraja)</CardTitle>
                <CardDescription>STK prompts go to your school's own PayBill or Till.</CardDescription></div>
              <div className="flex items-center gap-3"><StatusBadge s={mpesa.key ? "pending" : "not_connected"} />
                <Switch checked={mpesa.enabled} onCheckedChange={v => setMpesa({ ...mpesa, enabled: v })} /></div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label>Mode</Label>
                <Select value={mpesa.env} onValueChange={v => setMpesa({ ...mpesa, env: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="sandbox">Sandbox (testing)</SelectItem><SelectItem value="production">Production (live)</SelectItem></SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>Payment type</Label>
                <Select value={mpesa.type} onValueChange={v => setMpesa({ ...mpesa, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="paybill">PayBill</SelectItem><SelectItem value="buygoods">Buy Goods (Till)</SelectItem></SelectContent>
                </Select></div>
              <div className="space-y-1"><Label>{mpesa.type === "paybill" ? "PayBill number" : "Till number"}</Label>
                <Input value={mpesa.shortcode} inputMode="numeric" onChange={e => setMpesa({ ...mpesa, shortcode: e.target.value })} />
                {!checks.shortcode && <p className="text-xs text-destructive">Must be 5–7 digits</p>}</div>
              <div className="space-y-1"><Label>Account reference prefix</Label>
                <Input value={mpesa.prefix} onChange={e => setMpesa({ ...mpesa, prefix: e.target.value.toUpperCase() })} />
                {!checks.prefix && <p className="text-xs text-destructive">2–6 letters or numbers</p>}</div>
              <div className="space-y-1 sm:col-span-2"><Label>Business / settlement name</Label>
                <Input value={mpesa.business} onChange={e => setMpesa({ ...mpesa, business: e.target.value })} /></div>
              <SecretField label="Consumer key" value={mpesa.key} onChange={v => setMpesa({ ...mpesa, key: v })} />
              <SecretField label="Consumer secret" value={mpesa.secret} onChange={v => setMpesa({ ...mpesa, secret: v })} />
              <SecretField label="Passkey" value={mpesa.passkey} onChange={v => setMpesa({ ...mpesa, passkey: v })} />
              <SecretField label="Callback token" value={mpesa.token} valid={checks.token} onChange={v => setMpesa({ ...mpesa, token: v })} />
              <div className="sm:col-span-2 flex justify-end"><Button onClick={saveBlocked}>Save M-Pesa settings</Button></div>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {[["Flutterwave", flw, setFlw], ["Paystack", pst, setPst]].map(([name, val, set]) => (
              <Card key={name as string}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base"><CreditCard className="h-5 w-5 text-primary" />{name as string} <span className="text-xs text-muted-foreground">(optional)</span></CardTitle>
                  <StatusBadge s={val ? "pending" : "not_connected"} />
                </CardHeader>
                <CardContent className="space-y-3">
                  <SecretField label="Secret key" value={val as string} onChange={set as (v: string) => void} />
                  <Button variant="outline" className="w-full" onClick={saveBlocked}>Save</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="methods" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Methods parents & students can use</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {([["mpesa", "M-Pesa"], ["card", "Card"], ["bank", "Bank transfer"], ["paystack", "Paystack"], ["flutterwave", "Flutterwave"]] as const).map(([k, l]) => (
                <div key={k} className="flex items-center justify-between"><Label>{l}</Label>
                  <Switch checked={methods[k]} onCheckedChange={v => setMethods({ ...methods, [k]: v })} /></div>
              ))}
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="mb-2 font-medium">Parents will see:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(methods).filter(([, v]) => v).map(([k]) => <Badge key={k} variant="secondary">{k}</Badge>)}
                  {!Object.values(methods).some(Boolean) && <span className="text-muted-foreground">No payment options</span>}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Reference builder</CardTitle><CardDescription>M-Pesa allows up to {MPESA_REF_MAX} characters.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(["prefix", "student", "invoice", "year"] as const).map(k => (
                  <div key={k} className="space-y-1"><Label className="capitalize">{k}</Label>
                    <Input value={ref[k]} onChange={e => setRef({ ...ref, [k]: e.target.value })} /></div>
                ))}
              </div>
              <div className="rounded-md border p-3 font-mono text-lg">{r.ref || "—"}</div>
              <p className={`text-sm ${r.fitsMpesa ? "text-muted-foreground" : "text-destructive"}`}>
                {r.length} / {MPESA_REF_MAX} characters {r.fitsMpesa ? "· fits M-Pesa" : "· too long, will be cut off"}
              </p>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">Invoice status labels</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {INVOICE_STATES.map(([l, v]) => <Badge key={l} variant={v}>{l}</Badge>)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guide" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Going live with M-Pesa</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {guide.map(([t, done]) => (
                <div key={t} className="flex items-center gap-3 text-sm">
                  {done ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}{t}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <Card className="mx-auto max-w-md">
            <CardHeader><CardTitle className="text-base">Pay school fees</CardTitle><CardDescription>Preview of what parents see. No real prompt is sent.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-3"><p className="text-sm text-muted-foreground">Amount</p><p className="font-display text-2xl font-bold">KES 12,500</p></div>
              {stk === "idle" && <>
                <div className="space-y-1"><Label>M-Pesa phone number</Label>
                  <Input value={phone} placeholder="07XX XXX XXX" onChange={e => setPhone(e.target.value)} />
                  {phone && !normalizeKenyanPhone(phone) && <p className="text-xs text-destructive">Enter a valid Safaricom number</p>}</div>
                <Button className="w-full" disabled={!normalizeKenyanPhone(phone)} onClick={() => setStk("sent")}>Send prompt</Button>
              </>}
              {stk === "sent" && <div className="space-y-3 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p>Prompt sent to {normalizeKenyanPhone(phone)}. Enter your M-Pesa PIN.</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setStk("receipt")}>Approved</Button>
                  <Button size="sm" variant="outline" onClick={() => setStk("timeout")}>Timeout</Button>
                  <Button size="sm" variant="outline" onClick={() => setStk("cancelled")}>Cancelled</Button>
                </div></div>}
              {(stk === "timeout" || stk === "cancelled") && <div className="space-y-3 text-center">
                {stk === "timeout" ? <Clock className="mx-auto h-8 w-8 text-muted-foreground" /> : <XCircle className="mx-auto h-8 w-8 text-destructive" />}
                <p>{stk === "timeout" ? "No response from your phone in time." : "The payment was cancelled."}</p>
                <Button className="w-full" onClick={() => setStk("idle")}>Try again</Button></div>}
              {stk === "receipt" && <div className="space-y-3 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
                <p>Payment received. Your receipt is being prepared.</p>
                <Button variant="outline" className="w-full" onClick={() => setStk("idle")}>Done</Button></div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recon" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-5 w-5 text-primary" />Bank / cash / M-Pesa statement import</CardTitle>
              <CardDescription>Check a file before upload. Matching to invoices starts once the backend is resumed.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Download template</Button>
                <Button variant="outline" asChild><label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />Check a file
                  <input type="file" accept=".csv" className="hidden" onChange={async e => {
                    const f = e.target.files?.[0]; if (f) setCsvResult(validateReconCsv(await f.text()));
                  }} /></label></Button>
              </div>
              {csvResult && (csvResult.ok
                ? <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>{csvResult.rows} rows look good.</AlertDescription></Alert>
                : <Alert variant="destructive"><AlertDescription><ul className="list-disc pl-4">{csvResult.errors.map(e => <li key={e}>{e}</li>)}</ul></AlertDescription></Alert>)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Change history</CardTitle>
              <CardDescription>Every change will show who, when and which setting changed. Key values are never shown.</CardDescription></CardHeader>
            <CardContent><p className="py-8 text-center text-sm text-muted-foreground">No changes recorded yet.</p></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
