import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2, Loader2, Users, BookOpen, ChevronDown, ChevronRight, Upload, Plus, Pencil, Palette,
  LayoutDashboard, FileText, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { useBrandingPreview } from "@/components/BrandingProvider";
import ContrastChecker from "@/components/admin/ContrastChecker";

type Institution = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  tagline: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  website: string | null;
};

const blankForm = {
  name: "",
  slug: "",
  tagline: "",
  contact_email: "",
  contact_phone: "",
  address: "",
  website: "",
  primary_color: "#1f5132",
  secondary_color: "#d4a017",
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * Mini-mock of the LMS chrome (sidebar + topbar + dashboard card + course card)
 * rendered with the form's chosen colors so admins can preview branding before saving.
 */
const BrandPreview = ({ primary, accent, logoUrl, name }: { primary: string; accent: string; logoUrl: string | null; name: string }) => (
  <div className="rounded-xl border overflow-hidden shadow-sm bg-card">
    <div className="flex h-64">
      {/* Sidebar */}
      <div className="w-32 flex flex-col" style={{ background: primary }}>
        <div className="flex items-center gap-2 p-3 text-white">
          {logoUrl ? <img src={logoUrl} className="h-7 w-7 rounded object-cover bg-white/20" alt="" /> : <div className="h-7 w-7 rounded flex items-center justify-center" style={{ background: accent }}><BookOpen className="h-4 w-4 text-white" /></div>}
          <span className="text-xs font-bold truncate">{name || "School"}</span>
        </div>
        <div className="px-2 space-y-1 mt-2">
          <div className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[10px] text-white" style={{ background: accent }}>
            <LayoutDashboard className="h-3 w-3" /> Dashboard
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-white/70">
            <FileText className="h-3 w-3" /> Assignments
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-white/70">
            <BookOpen className="h-3 w-3" /> Courses
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 bg-background overflow-hidden">
        <div className="h-8 border-b flex items-center justify-end px-3">
          <div className="h-5 w-5 rounded-full" style={{ background: accent }} />
        </div>
        <div className="p-3 space-y-2">
          <div className="text-xs font-bold" style={{ color: primary }}>Welcome back!</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border p-2 text-[9px]" style={{ borderTopWidth: 3, borderTopColor: primary }}>
              <div className="font-semibold">Math 101</div>
              <div className="text-muted-foreground">5 lessons</div>
            </div>
            <div className="rounded border p-2 text-[9px]" style={{ borderTopWidth: 3, borderTopColor: accent }}>
              <div className="font-semibold">Science</div>
              <div className="text-muted-foreground">3 quizzes</div>
            </div>
          </div>
          <div className="rounded p-2 text-[9px] text-white" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
            <div className="font-bold">Upcoming</div>
            <div className="opacity-90">Essay due Fri</div>
          </div>
          <div className="flex gap-1.5">
            <button className="rounded px-2 py-1 text-[9px] text-white" style={{ background: primary }}>Continue</button>
            <button className="rounded px-2 py-1 text-[9px] border" style={{ color: accent, borderColor: accent }}>View all</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const InstitutionsTab = () => {
  const [selectedInst, setSelectedInst] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Institution | null>(null);
  const [form, setForm] = useState({ ...blankForm });
  const [livePreview, setLivePreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { setPreview } = useBrandingPreview();

  // Push form colors into global theme when "live preview" is on, clear on close.
  useEffect(() => {
    if (livePreview && (createOpen || editing)) {
      setPreview({ primary_color: form.primary_color, secondary_color: form.secondary_color, logo_url: editing?.logo_url ?? null, name: form.name });
    } else {
      setPreview(null);
    }
    return () => setPreview(null);
  }, [livePreview, form.primary_color, form.secondary_color, form.name, createOpen, editing, setPreview]);

  const { data: institutions, isLoading } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("*").order("name");
      if (error) throw error;
      return data as Institution[];
    },
  });

  const createInst = useMutation({
    mutationFn: async (payload: typeof blankForm) => {
      const slug = payload.slug || slugify(payload.name);
      if (!payload.name.trim() || !slug) throw new Error("Name and slug are required");
      const { error } = await supabase.from("institutions").insert({
        name: payload.name.trim(),
        slug,
        tagline: payload.tagline || null,
        contact_email: payload.contact_email || null,
        contact_phone: payload.contact_phone || null,
        address: payload.address || null,
        website: payload.website || null,
        primary_color: payload.primary_color,
        secondary_color: payload.secondary_color,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Institution created!");
      setCreateOpen(false);
      setForm({ ...blankForm });
      qc.invalidateQueries({ queryKey: ["institutions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateInst = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Institution> }) => {
      const { error } = await supabase.from("institutions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved!");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["institutions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadLogo = useMutation({
    mutationFn: async ({ instId, file }: { instId: string; file: File }) => {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const path = `${instId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from("institution-logos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("institution-logos").getPublicUrl(path);
      const { error } = await supabase.from("institutions").update({ logo_url: `${data.publicUrl}?t=${Date.now()}` }).eq("id", instId);
      if (error) throw error;
    },
    onSuccess: () => {
      setUploading(false);
      qc.invalidateQueries({ queryKey: ["institutions"] });
      toast.success("Logo uploaded!");
    },
    onError: (e: any) => { setUploading(false); toast.error(e.message); },
  });

  const { data: memberLinks } = useQuery({
    queryKey: ["inst-members-ro", selectedInst],
    enabled: !!selectedInst,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_institutions").select("user_id").eq("institution_id", selectedInst!);
      if (error) throw error;
      return data;
    },
  });

  const { data: institutionCourses } = useQuery({
    queryKey: ["institution-courses-ro", selectedInst],
    enabled: !!selectedInst,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses").select("id, code, title, color")
        .eq("institution_id", selectedInst!).order("code");
      if (error) throw error;
      return data;
    },
  });

  const openEdit = (inst: Institution) => {
    setEditing(inst);
    setForm({
      name: inst.name,
      slug: inst.slug,
      tagline: inst.tagline ?? "",
      contact_email: inst.contact_email ?? "",
      contact_phone: inst.contact_phone ?? "",
      address: inst.address ?? "",
      website: inst.website ?? "",
      primary_color: inst.primary_color ?? "#1f5132",
      secondary_color: inst.secondary_color ?? "#d4a017",
    });
  };

  const InstitutionForm = (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>School Name *</Label>
        <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value, slug: editing ? f.slug : slugify(e.target.value) }))} placeholder="Litu International School" />
      </div>
      <div className="space-y-1.5">
        <Label>URL Slug *</Label>
        <Input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: slugify(e.target.value) }))} placeholder="litu-intl" />
      </div>
      <div className="space-y-1.5">
        <Label>Website</Label>
        <Input value={form.website} onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Tagline / Motto</Label>
        <Input value={form.tagline} onChange={(e) => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Empowering learners since 1995" />
      </div>
      <div className="space-y-1.5">
        <Label>Contact Email</Label>
        <Input type="email" value={form.contact_email} onChange={(e) => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="info@school.com" />
      </div>
      <div className="space-y-1.5">
        <Label>Contact Phone</Label>
        <Input value={form.contact_phone} onChange={(e) => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="+254 ..." />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Address</Label>
        <Textarea rows={2} value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, City, Country" />
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Primary Color</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={form.primary_color} onChange={(e) => setForm(f => ({ ...f, primary_color: e.target.value }))} className="h-10 w-14 rounded-md border cursor-pointer" />
          <Input value={form.primary_color} onChange={(e) => setForm(f => ({ ...f, primary_color: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Accent Color</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={form.secondary_color} onChange={(e) => setForm(f => ({ ...f, secondary_color: e.target.value }))} className="h-10 w-14 rounded-md border cursor-pointer" />
          <Input value={form.secondary_color} onChange={(e) => setForm(f => ({ ...f, secondary_color: e.target.value }))} />
        </div>
      </div>

      <div className="sm:col-span-2 pt-2 border-t">
        <ContrastChecker primary={form.primary_color} accent={form.secondary_color} />
      </div>

      <div className="sm:col-span-2 space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Live Preview
          </Label>
          <Button
            type="button" variant={livePreview ? "default" : "outline"} size="sm"
            onClick={() => setLivePreview(v => !v)}
            className="gap-1.5"
          >
            {livePreview ? <><EyeOff className="h-3.5 w-3.5" /> Stop applying to app</> : <><Eye className="h-3.5 w-3.5" /> Apply to whole app</>}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">See how the dashboard and course pages look with this branding. Toggle "Apply to whole app" to temporarily theme the live LMS — your changes won't be saved until you click Save.</p>
        <BrandPreview primary={form.primary_color} accent={form.secondary_color} logoUrl={editing?.logo_url ?? null} name={form.name} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Institutions</h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">{institutions?.length || 0} total</Badge>
          <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) { setForm({ ...blankForm }); setLivePreview(false); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New Institution</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Institution</DialogTitle>
                <DialogDescription>Add a new school with its branding and contact details. You can upload a logo after creation.</DialogDescription>
              </DialogHeader>
              {InstitutionForm}
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={() => createInst.mutate(form)} disabled={createInst.isPending}>
                  {createInst.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Create Institution
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setLivePreview(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {editing?.name}</DialogTitle>
            <DialogDescription>Update branding, contact info, and identity for this school.</DialogDescription>
          </DialogHeader>
          {InstitutionForm}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && updateInst.mutate({ id: editing.id, patch: {
              name: form.name, slug: form.slug, tagline: form.tagline || null,
              contact_email: form.contact_email || null, contact_phone: form.contact_phone || null,
              address: form.address || null, website: form.website || null,
              primary_color: form.primary_color, secondary_color: form.secondary_color,
            } })} disabled={updateInst.isPending}>
              {updateInst.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !institutions?.length ? (
        <div className="text-center py-12 border rounded-xl border-dashed">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground mb-4">No institutions yet.</p>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Create your first school</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {institutions.map(inst => {
            const isSelected = selectedInst === inst.id;
            return (
              <div key={inst.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-secondary/30"}`}
                  onClick={() => setSelectedInst(isSelected ? null : inst.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: inst.primary_color || "hsl(var(--primary))" }}>
                      {inst.logo_url ? (
                        <img src={inst.logo_url} alt={inst.name} className="h-10 w-10 object-cover" />
                      ) : (
                        <Building2 className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold truncate">{inst.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">/{inst.slug}{inst.tagline ? ` · ${inst.tagline}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(inst); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {isSelected ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {isSelected && (
                  <div className="border-t p-4 space-y-4">
                    {/* Branding preview */}
                    <div className="rounded-lg p-4 border" style={{ background: `linear-gradient(135deg, ${inst.primary_color || "#1f5132"}, ${inst.secondary_color || "#d4a017"})` }}>
                      <div className="flex items-center gap-3 text-white">
                        {inst.logo_url ? <img src={inst.logo_url} className="h-12 w-12 rounded-lg object-cover bg-white/20" alt="" /> : <Building2 className="h-10 w-10" />}
                        <div>
                          <p className="font-display font-bold text-lg leading-tight">{inst.name}</p>
                          {inst.tagline && <p className="text-xs opacity-90">{inst.tagline}</p>}
                        </div>
                      </div>
                    </div>

                    {/* Logo Upload */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Upload className="h-4 w-4 text-muted-foreground" /> Institution Logo
                      </h4>
                      <div className="flex items-center gap-3">
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadLogo.mutate({ instId: inst.id, file });
                          e.target.value = "";
                        }} />
                        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                          {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                          {inst.logo_url ? "Change Logo" : "Upload Logo"}
                        </Button>
                      </div>
                    </div>

                    {/* Contact summary */}
                    {(inst.contact_email || inst.contact_phone || inst.address || inst.website) && (
                      <div className="grid sm:grid-cols-2 gap-2 text-sm">
                        {inst.contact_email && <div><span className="text-muted-foreground">Email:</span> {inst.contact_email}</div>}
                        {inst.contact_phone && <div><span className="text-muted-foreground">Phone:</span> {inst.contact_phone}</div>}
                        {inst.website && <div><span className="text-muted-foreground">Web:</span> {inst.website}</div>}
                        {inst.address && <div className="sm:col-span-2"><span className="text-muted-foreground">Address:</span> {inst.address}</div>}
                      </div>
                    )}

                    {/* Members + Courses counts */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-secondary/30 p-3 flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{memberLinks?.length || 0} members</span>
                      </div>
                      <div className="rounded-lg bg-secondary/30 p-3 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{institutionCourses?.length || 0} courses</span>
                      </div>
                    </div>
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

export default InstitutionsTab;
