import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useMyInstitution } from "@/hooks/useInstitution";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertCircle, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

const fmtKES = (c: number) => `KES ${(c / 100).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;

type Plan = {
  id: string; slug: string; name: string; description: string;
  price_cents: number; currency: string; billing_period: string;
  max_students: number | null; features: string[]; active: boolean; sort_order: number;
};

const SubscriptionsTab = () => {
  const { role, isAdmin } = useRole();
  const isPlatformAdmin = role === "platform_admin" || isAdmin;
  const isSchoolAdmin = role === "school_admin";
  const { data: myInstitution } = useMyInstitution();
  const qc = useQueryClient();

  const { data: plans } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans" as any).select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Plan[];
    },
  });

  const { data: mySub } = useQuery({
    queryKey: ["my-subscription", myInstitution?.id],
    enabled: !!myInstitution?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institution_subscriptions" as any)
        .select("*, subscription_plans(name, slug, price_cents, billing_period)")
        .eq("institution_id", myInstitution!.id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: subPayments } = useQuery({
    queryKey: ["sub-payments", myInstitution?.id],
    enabled: !!myInstitution?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_payments" as any)
        .select("id, amount_cents, currency, provider, provider_reference, status, paid_at, created_at, period_end")
        .eq("institution_id", myInstitution!.id)
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Platform admin: view all subscriptions
  const { data: allSubs } = useQuery({
    queryKey: ["all-subscriptions"],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institution_subscriptions" as any)
        .select("*, subscription_plans(name, slug, billing_period), institutions(name, slug)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const [paying, setPaying] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<"mpesa" | "flutterwave" | "paystack" | "bank_transfer">("mpesa");

  const initiate = useMutation({
    mutationFn: async (planId: string) => {
      if (!myInstitution?.id) throw new Error("No institution");
      const { data, error } = await supabase.functions.invoke("subscription-initiate", {
        body: { plan_id: planId, institution_id: myInstitution.id, provider, phone },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (res: any) => {
      toast.success(res?.message ?? "Subscription updated");
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
      qc.invalidateQueries({ queryKey: ["sub-payments"] });
      setPaying(null); setPhone("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Platform admin plan editor ----
  const [editing, setEditing] = useState<Partial<Plan> | null>(null);
  const savePlan = useMutation({
    mutationFn: async (p: Partial<Plan>) => {
      if (p.id) {
        const { error } = await supabase.from("subscription_plans" as any).update({
          name: p.name, description: p.description, price_cents: p.price_cents,
          billing_period: p.billing_period, max_students: p.max_students,
          features: p.features, active: p.active,
        }).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subscription_plans" as any).insert({
          slug: p.slug, name: p.name, description: p.description ?? "",
          price_cents: p.price_cents ?? 0, billing_period: p.billing_period ?? "monthly",
          max_students: p.max_students ?? null, features: p.features ?? [], active: p.active ?? true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Plan saved"); qc.invalidateQueries({ queryKey: ["subscription-plans"] }); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { v: any; label: string }> = {
      trial: { v: "secondary", label: "Trial" },
      active: { v: "default", label: "Active" },
      past_due: { v: "destructive", label: "Past due" },
      canceled: { v: "outline", label: "Canceled" },
      expired: { v: "destructive", label: "Expired" },
    };
    const m = map[status] ?? { v: "outline", label: status };
    return <Badge variant={m.v}>{m.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* School admin: current subscription */}
      {isSchoolAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Your subscription
              {mySub && statusBadge(mySub.status)}
            </CardTitle>
            <CardDescription>
              {mySub
                ? `Plan: ${mySub.subscription_plans?.name ?? "—"}. Renews ${mySub.current_period_end ? new Date(mySub.current_period_end).toLocaleDateString() : "—"}.`
                : "No active subscription. Pick a plan below to get started."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Plans grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {(plans ?? []).map((p) => {
          const isCurrent = mySub?.plan_id === p.id && mySub?.status === "active";
          return (
            <Card key={p.id} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{p.name}</CardTitle>
                    <CardDescription>{p.description}</CardDescription>
                  </div>
                  {isPlatformAdmin && (
                    <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="pt-2">
                  <span className="text-3xl font-bold">{fmtKES(p.price_cents)}</span>
                  <span className="text-muted-foreground">/{p.billing_period === "yearly" ? "yr" : "mo"}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.max_students ? `Up to ${p.max_students.toLocaleString()} students` : "Unlimited students"}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm">
                  {(p.features ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isSchoolAdmin && (
                  isCurrent
                    ? <Badge className="w-full justify-center" variant="default">Current plan</Badge>
                    : <Button className="w-full" onClick={() => setPaying(p.id)} disabled={!p.active}>
                        {mySub?.status === "active" ? "Switch to this plan" : "Subscribe"}
                      </Button>
                )}
                {!p.active && isPlatformAdmin && <Badge variant="outline">Inactive</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isPlatformAdmin && (
        <Button variant="outline" onClick={() => setEditing({ active: true, billing_period: "monthly", features: [] })}>
          <Plus className="h-4 w-4 mr-2" />New plan
        </Button>
      )}

      {/* Pay dialog */}
      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pay for subscription</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Payment method</Label>
              <Select value={provider} onValueChange={(v: any) => setProvider(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="flutterwave">Flutterwave</SelectItem>
                  <SelectItem value="paystack">Paystack</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {provider === "mpesa" && (
              <div>
                <Label>Phone (Safaricom)</Label>
                <Input placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            )}
            <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-md bg-muted/40 p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>If your provider isn't configured yet, the subscription will activate in sandbox mode so you can test the flow end-to-end.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button>
            <Button onClick={() => paying && initiate.mutate(paying)} disabled={initiate.isPending}>
              {initiate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan editor (platform admin) */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit plan" : "New plan"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Slug</Label>
                  <Input value={editing.slug ?? ""} disabled={!!editing.id}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Price (KES)</Label>
                  <Input type="number" value={(editing.price_cents ?? 0) / 100}
                    onChange={(e) => setEditing({ ...editing, price_cents: Math.round(Number(e.target.value) * 100) })} />
                </div>
                <div>
                  <Label>Billing</Label>
                  <Select value={editing.billing_period ?? "monthly"} onValueChange={(v) => setEditing({ ...editing, billing_period: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Max students</Label>
                  <Input type="number" placeholder="Unlimited" value={editing.max_students ?? ""}
                    onChange={(e) => setEditing({ ...editing, max_students: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </div>
              <div>
                <Label>Features (one per line)</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background p-2 text-sm min-h-[120px]"
                  value={(editing.features ?? []).join("\n")}
                  onChange={(e) => setEditing({ ...editing, features: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.active ?? true} onCheckedChange={(c) => setEditing({ ...editing, active: c })} />
                <Label>Active</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && savePlan.mutate(editing)} disabled={savePlan.isPending}>
              {savePlan.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* School admin: payments history */}
      {isSchoolAdmin && subPayments && subPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {subPayments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                <div>
                  <div className="font-medium">{fmtKES(p.amount_cents)}</div>
                  <div className="text-xs text-muted-foreground">{p.provider} · {p.provider_reference}</div>
                </div>
                <div className="text-right">
                  <Badge variant={p.status === "succeeded" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>{p.status}</Badge>
                  <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Platform admin: all subscriptions */}
      {isPlatformAdmin && allSubs && (
        <Card>
          <CardHeader>
            <CardTitle>All institution subscriptions</CardTitle>
            <CardDescription>{allSubs.length} schools</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {allSubs.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                <div>
                  <div className="font-medium">{s.institutions?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{s.subscription_plans?.name ?? "No plan"} · {s.subscription_plans?.billing_period ?? ""}</div>
                </div>
                <div className="text-right">
                  {statusBadge(s.status)}
                  <div className="text-xs text-muted-foreground">
                    {s.current_period_end ? `Renews ${new Date(s.current_period_end).toLocaleDateString()}` : "—"}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SubscriptionsTab;
