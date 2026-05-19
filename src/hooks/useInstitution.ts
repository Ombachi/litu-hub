import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type MyInstitution = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  tagline: string | null;
};

export function useMyInstitution() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-institution", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_institutions")
        .select("institution_id, institutions(id, name, slug, logo_url, primary_color, secondary_color, tagline)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.institutions ?? null) as MyInstitution | null;
    },
  });
}
