import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyInstitution } from "./useInstitution";
import type { GradingSystem } from "@/lib/grading";

/** Returns the grading system configured for the user's school (defaults to university). */
export function useGradingSystem(): GradingSystem {
  const { data: inst } = useMyInstitution();
  const { data } = useQuery({
    queryKey: ["grading-system", inst?.id],
    enabled: !!inst?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.from("institutions") as any)
        .select("grading_system")
        .eq("id", inst!.id)
        .maybeSingle();
      if (error) return "university";
      return (data?.grading_system === "cbc" ? "cbc" : "university") as GradingSystem;
    },
  });
  return data ?? "university";
}
