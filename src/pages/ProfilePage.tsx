import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useData";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  User, Camera, Save, Loader2, Bell, Shield, Mail, Key, Download, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type NotifPref = { key: string; label: string; desc: string };

const STUDENT_PREFS: NotifPref[] = [
  { key: "notif-assignments", label: "Assignment reminders", desc: "Get notified about upcoming due dates" },
  { key: "notif-grades", label: "Grade updates", desc: "Get notified when assignments are graded" },
  { key: "notif-discussions", label: "Discussion replies", desc: "Get notified about replies to your posts" },
  { key: "notif-quizzes", label: "Quiz availability", desc: "Get notified about new or upcoming quizzes" },
];

const TUTOR_PREFS: NotifPref[] = [
  { key: "notif-submissions", label: "New submissions", desc: "Get notified when students submit assignments" },
  { key: "notif-discussions", label: "Discussion activity", desc: "Get notified about new discussion posts" },
  { key: "notif-messages", label: "Direct messages", desc: "Get notified about new messages" },
];

const PARENT_PREFS: NotifPref[] = [
  { key: "notif-grades", label: "Grade updates", desc: "Get notified when your child's assignments are graded" },
  { key: "notif-messages", label: "Direct messages", desc: "Get notified about new messages" },
];

const ADMIN_PREFS: NotifPref[] = [
  { key: "notif-messages", label: "Direct messages", desc: "Get notified about new messages" },
  { key: "notif-users", label: "New user signups", desc: "Get notified when new users register" },
];

function getPrefsForRole(role: string): NotifPref[] {
  if (role === "parent") return PARENT_PREFS;
  if (role === "tutor" || role === "ta") return TUTOR_PREFS;
  if (["platform_admin", "school_admin"].includes(role)) return ADMIN_PREFS;
  return STUDENT_PREFS;
}

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { role } = useRole();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const notifPrefs = getPrefsForRole(role);
  const [prefState, setPrefState] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    notifPrefs.forEach(p => { state[p.key] = localStorage.getItem(p.key) !== "false"; });
    return state;
  });

  if (profile && !initialized) {
    setFirstName(profile.first_name || "");
    setLastName(profile.last_name || "");
    setInitialized(true);
  }

  const avatarUrl = avatarPreview || (profile?.avatar_url
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}`
    : null);

  const initials = (firstName?.[0] || profile?.first_name?.[0] || "?").toUpperCase() +
    (lastName?.[0] || profile?.last_name?.[0] || "").toUpperCase();

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not logged in");
      let newAvatarPath = profile?.avatar_url || null;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${user.id}/avatar.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        newAvatarPath = path;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ first_name: firstName.trim(), last_name: lastName.trim(), avatar_url: newAvatarPath })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      setAvatarFile(null);
      toast.success("Profile updated!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveNotifPrefs = () => {
    Object.entries(prefState).forEach(([key, val]) => localStorage.setItem(key, String(val)));
    toast.success("Notification preferences saved");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">My Profile</h1>
        <p className="mt-1 text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      {/* Avatar & Name */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <div className="flex items-center gap-6">
          <div className="relative group">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-20 w-20 rounded-full object-cover border-2 border-primary/20" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">{initials}</div>
            )}
            <button onClick={() => fileRef.current?.click()} className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-5 w-5 text-background" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
          </div>
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">First Name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last Name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">{role}</Badge>
              <span className="text-xs text-muted-foreground">{user?.email}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            {saveProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Profile
          </Button>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-primary" /> Notification Preferences
        </h2>
        <div className="space-y-4">
          {notifPrefs.map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={prefState[item.key] ?? true}
                onCheckedChange={(v) => setPrefState(prev => ({ ...prev, [item.key]: v }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={saveNotifPrefs}>Save Preferences</Button>
        </div>
      </div>

      {/* Account Settings */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-primary" /> Account Settings
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Password</p>
                <p className="text-xs text-muted-foreground">••••••••</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              if (!user?.email) return;
              const { error } = await supabase.auth.resetPasswordForEmail(user.email);
              if (error) toast.error(error.message);
              else toast.success("Password reset email sent!");
            }}>Change</Button>
          </div>
        </div>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t">
          <Button variant="destructive" onClick={signOut}>Sign Out</Button>
        </div>
      </div>

      {/* Privacy & Data (GDPR) */}
      <div className="rounded-xl border bg-card p-6 shadow-card">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-primary" /> Privacy & Your Data
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Download a copy of your data, or permanently delete your account. Account deletion is irreversible.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) { toast.error("Not signed in"); return; }
                const res = await fetch(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gdpr-export`,
                  { headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
                );
                if (!res.ok) throw new Error((await res.json()).error || "Export failed");
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `litu-hub-export-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Data export downloaded");
              } catch (e: any) {
                toast.error(e.message || "Export failed");
              }
            }}
            aria-label="Download all your personal data as JSON"
          >
            <Download className="mr-2 h-4 w-4" /> Export My Data
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              const phrase = window.prompt(
                "This permanently deletes your account and all associated data. This cannot be undone.\n\nType DELETE to confirm:"
              );
              if (phrase !== "DELETE") return;
              try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) { toast.error("Not signed in"); return; }
                const res = await fetch(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gdpr-delete`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${session.access_token}`,
                      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ confirm: "DELETE" }),
                  }
                );
                if (!res.ok) throw new Error((await res.json()).error || "Deletion failed");
                toast.success("Account deleted. Goodbye.");
                await supabase.auth.signOut();
                window.location.href = "/auth";
              } catch (e: any) {
                toast.error(e.message || "Deletion failed");
              }
            }}
            aria-label="Permanently delete your account and all data"
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete My Account
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
