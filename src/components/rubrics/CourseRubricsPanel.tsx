import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isMissingTable } from "@/lib/features/backendReady";
import { parseRubricCriteria } from "@/lib/features/rubricTypes";
import RubricBuilder from "./RubricBuilder";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Assignment = { id: string; title: string; max_score: number; rubric_criteria?: unknown };

export default function CourseRubricsPanel({ courseId, assignments }: { courseId: string; assignments: Assignment[] }) {
  const [selectedId, setSelectedId] = useState("");
  const qc = useQueryClient();
  const assignment = assignments.find(a => a.id === selectedId);
  return <div className="space-y-5">
    <h3 className="font-display font-semibold">Assignment rubrics</h3>
    <Select value={selectedId} onValueChange={setSelectedId}>
      <SelectTrigger className="max-w-lg"><SelectValue placeholder="Select an assignment" /></SelectTrigger>
      <SelectContent>{assignments.map(a => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}</SelectContent>
    </Select>
    {!assignments.length && <p className="text-sm text-muted-foreground">No assignments in this course.</p>}
    {assignment && <>
      <p className="text-sm text-muted-foreground">Assignment maximum: {assignment.max_score} points</p>
      <RubricBuilder key={assignment.id} targetId={assignment.id} initial={{ title: assignment.title, targetType: "assignment", targetId: assignment.id, criteria: parseRubricCriteria(assignment.rubric_criteria) }}
        onPersist={async rubric => {
          const { data, error } = await supabase.from("assignments")
            .update({ rubric_criteria: JSON.parse(JSON.stringify(rubric.criteria)) })
            .eq("id", assignment.id).eq("course_id", courseId).select("id").single();
          if (error) { if (isMissingTable(error)) return false; throw error; }
          return !!data;
        }}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["assignments"] });
          void qc.invalidateQueries({ queryKey: ["grading-queue"] });
        }} />
    </>}
  </div>;
}