import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyInstitution } from "@/hooks/useInstitution";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Loader2, Trash2, BookOpen, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

const SchoolAdminCoursesTab = () => {
  const { user } = useAuth();
  const { data: myInstitution } = useMyInstitution();
  const qc = useQueryClient();
  const institutionId = myInstitution?.id;

  const [courseForm, setCourseForm] = useState({ open: false, title: "", code: "", description: "" });
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [assignTutorId, setAssignTutorId] = useState("");

  // Institution courses
  const { data: courses, isLoading } = useQuery({
    queryKey: ["inst-courses-admin", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, terms(name)")
        .eq("institution_id", institutionId!)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  // Course tutors for selected course
  const { data: courseTutors } = useQuery({
    queryKey: ["course-tutors", selectedCourseId],
    enabled: !!selectedCourseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_tutors")
        .select("id, tutor_id")
        .eq("course_id", selectedCourseId!);
      if (error) throw error;
      return data;
    },
  });

  const { data: tutorProfiles } = useQuery({
    queryKey: ["course-tutor-profiles", selectedCourseId],
    enabled: !!courseTutors?.length,
    queryFn: async () => {
      const ids = courseTutors!.map(ct => ct.tutor_id);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", ids);
      if (error) throw error;
      return data;
    },
  });

  // Institution members with tutor role (for assigning)
  const { data: institutionTutors } = useQuery({
    queryKey: ["inst-tutors", institutionId],
    enabled: !!institutionId,
    queryFn: async () => {
      // Get institution member user_ids
      const { data: members, error: mErr } = await supabase
        .from("user_institutions")
        .select("user_id")
        .eq("institution_id", institutionId!);
      if (mErr) throw mErr;
      if (!members?.length) return [];
      const userIds = members.map(m => m.user_id);
      // Get users with tutor role
      const { data: roles, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", userIds)
        .eq("role", "tutor");
      if (rErr) throw rErr;
      if (!roles?.length) return [];
      const tutorIds = roles.map(r => r.user_id);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", tutorIds);
      if (pErr) throw pErr;
      return profiles;
    },
  });

  const createCourse = useMutation({
    mutationFn: async (params: { title: string; code: string; description: string }) => {
      const { error } = await supabase.from("courses").insert({
        title: params.title,
        code: params.code,
        description: params.description,
        created_by: user?.id,
        institution_id: institutionId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inst-courses-admin"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      setCourseForm({ open: false, title: "", code: "", description: "" });
      toast.success("Course created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCourse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inst-courses-admin"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
      if (selectedCourseId) setSelectedCourseId(null);
      toast.success("Course deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignTutor = useMutation({
    mutationFn: async ({ courseId, tutorId }: { courseId: string; tutorId: string }) => {
      const { error } = await supabase.from("course_tutors").insert({ course_id: courseId, tutor_id: tutorId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-tutors"] });
      qc.invalidateQueries({ queryKey: ["course-tutor-profiles"] });
      setAssignTutorId("");
      toast.success("Tutor assigned to course");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeTutor = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("course_tutors").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-tutors"] });
      qc.invalidateQueries({ queryKey: ["course-tutor-profiles"] });
      toast.success("Tutor removed from course");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const existingTutorIds = new Set(courseTutors?.map(ct => ct.tutor_id) || []);
  const availableTutors = institutionTutors?.filter(t => !existingTutorIds.has(t.user_id)) || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{myInstitution?.name} Courses</h3>
        <button
          onClick={() => setCourseForm({ open: true, title: "", code: "", description: "" })}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Create Course
        </button>
      </div>

      {courseForm.open && (
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">New Course</h4>
            <button onClick={() => setCourseForm({ ...courseForm, open: false })} className="p-1 hover:bg-secondary rounded"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} placeholder="e.g. BUS101" />
            <Input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} placeholder="e.g. Introduction to Business" />
          </div>
          <Input value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} placeholder="Course description..." />
          <button
            onClick={() => createCourse.mutate({ title: courseForm.title, code: courseForm.code, description: courseForm.description })}
            disabled={!courseForm.title.trim() || !courseForm.code.trim() || createCourse.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {createCourse.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create Course
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : !courses?.length ? (
        <p className="text-center text-muted-foreground py-12">No courses yet. Create one to get started.</p>
      ) : (
        <div className="grid gap-3">
          {courses.map(c => {
            const isSelected = selectedCourseId === c.id;
            return (
              <div key={c.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div
                  className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-secondary/30"}`}
                  onClick={() => setSelectedCourseId(isSelected ? null : c.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full" style={{ background: c.color || "hsl(var(--primary))" }} />
                    <div>
                      <h4 className="font-semibold">{c.code} — {c.title}</h4>
                      <p className="text-xs text-muted-foreground">{c.description || "No description"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(c as any).terms?.name && (
                      <Badge variant="secondary" className="text-[10px]">{(c as any).terms.name}</Badge>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${c.code}"?`)) deleteCourse.mutate(c.id); }}
                      className="p-1.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Tutor assignment panel */}
                {isSelected && (
                  <div className="border-t p-4 space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" /> Course Tutors ({courseTutors?.length || 0})
                    </h4>
                    <div className="flex gap-2">
                      <Select value={assignTutorId} onValueChange={setAssignTutorId}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Assign a tutor..." /></SelectTrigger>
                        <SelectContent>
                          {availableTutors.map(t => (
                            <SelectItem key={t.user_id} value={t.user_id}>
                              {t.first_name} {t.last_name} ({t.email})
                            </SelectItem>
                          ))}
                          {!availableTutors.length && (
                            <div className="px-3 py-2 text-xs text-muted-foreground">No available tutors. Add users with "tutor" role to your institution first.</div>
                          )}
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => assignTutorId && assignTutor.mutate({ courseId: c.id, tutorId: assignTutorId })}
                        disabled={!assignTutorId || assignTutor.isPending}
                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    </div>
                    {courseTutors?.map(ct => {
                      const profile = tutorProfiles?.find(p => p.user_id === ct.tutor_id);
                      return (
                        <div key={ct.id} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                          <span className="text-sm">
                            {profile?.first_name} {profile?.last_name}
                            <span className="text-muted-foreground ml-1">({profile?.email})</span>
                          </span>
                          <button
                            onClick={() => removeTutor.mutate(ct.id)}
                            className="p-1 hover:bg-destructive/10 text-destructive rounded"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
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

export default SchoolAdminCoursesTab;
