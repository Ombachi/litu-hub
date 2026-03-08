import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Building2, Loader2, Users, BookOpen, ChevronDown, ChevronRight, Upload, X } from "lucide-react";
import { toast } from "sonner";

const InstitutionsTab = () => {
  const [selectedInst, setSelectedInst] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const uploadLogo = useMutation({
    mutationFn: async ({ instId, file }: { instId: string; file: File }) => {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const path = `${instId}/logo.${ext}`;
      const { error: upErr } = await supabase.storage.from("institution-logos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("institution-logos").getPublicUrl(path);
      const { error } = await supabase.from("institutions").update({ logo_url: data.publicUrl }).eq("id", instId);
      if (error) throw error;
    },
    onSuccess: () => {
      setUploading(false);
      qc.invalidateQueries({ queryKey: ["institutions"] });
      toast.success("Logo uploaded!");
    },
    onError: (e: any) => { setUploading(false); toast.error(e.message); },
  });

  const { data: institutions, isLoading } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("institutions").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: memberLinks } = useQuery({
    queryKey: ["inst-members-ro", selectedInst],
    enabled: !!selectedInst,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_institutions")
        .select("user_id")
        .eq("institution_id", selectedInst!);
      if (error) throw error;
      return data;
    },
  });

  const { data: memberProfiles } = useQuery({
    queryKey: ["inst-member-profiles-ro", selectedInst],
    enabled: !!memberLinks?.length,
    queryFn: async () => {
      const userIds = memberLinks!.map(m => m.user_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: memberRoles } = useQuery({
    queryKey: ["inst-member-roles-ro", selectedInst],
    enabled: !!memberLinks?.length,
    queryFn: async () => {
      const userIds = memberLinks!.map(m => m.user_id);
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);
      if (error) throw error;
      return data;
    },
  });

  const { data: institutionCourses } = useQuery({
    queryKey: ["institution-courses-ro", selectedInst],
    enabled: !!selectedInst,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, code, title, color")
        .eq("institution_id", selectedInst!)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const getRoleForUser = (userId: string) =>
    memberRoles?.find(r => r.user_id === userId)?.role || "student";

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Institutions</h3>
        <Badge variant="secondary" className="text-xs">{institutions?.length || 0} total</Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !institutions?.length ? (
        <p className="text-center text-muted-foreground py-12">No institutions yet.</p>
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
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden" style={{ backgroundColor: inst.primary_color || "hsl(var(--primary))", opacity: inst.logo_url ? 1 : 0.15 }}>
                      {inst.logo_url ? (
                        <img src={inst.logo_url} alt={inst.name} className="h-10 w-10 object-cover" />
                      ) : (
                        <Building2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold">{inst.name}</h4>
                      <p className="text-xs text-muted-foreground">/{inst.slug}</p>
                    </div>
                  </div>
                  {isSelected ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>

                {isSelected && (
                  <div className="border-t p-4 space-y-4">
                    {/* Logo Upload */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Upload className="h-4 w-4 text-muted-foreground" /> Institution Logo
                      </h4>
                      <div className="flex items-center gap-3">
                        {inst.logo_url ? (
                          <img src={inst.logo_url} alt="" className="h-16 w-16 rounded-lg object-cover border" />
                        ) : (
                          <div className="h-16 w-16 rounded-lg border border-dashed flex items-center justify-center bg-secondary/30">
                            <Building2 className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadLogo.mutate({ instId: inst.id, file });
                          }} />
                          <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                          >
                            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                            {inst.logo_url ? "Change Logo" : "Upload Logo"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Members (read-only) */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" /> Members ({memberLinks?.length || 0})
                      </h4>
                      {!memberProfiles?.length ? (
                        <p className="text-xs text-muted-foreground pl-6">No members assigned.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {memberProfiles.map(p => (
                            <div key={p.user_id} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                              <span className="text-sm">{p.first_name} {p.last_name} <span className="text-muted-foreground">({p.email})</span></span>
                              <Badge variant="secondary" className="text-[10px] capitalize">{getRoleForUser(p.user_id).replace("_", " ")}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Courses (read-only) */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" /> Courses ({institutionCourses?.length || 0})
                      </h4>
                      {!institutionCourses?.length ? (
                        <p className="text-xs text-muted-foreground pl-6">No courses yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {institutionCourses.map(c => (
                            <div key={c.id} className="flex items-center gap-3 rounded-lg bg-secondary/30 px-3 py-2">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ background: c.color || "hsl(var(--primary))" }} />
                              <span className="text-sm font-medium">{c.code} — {c.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
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
