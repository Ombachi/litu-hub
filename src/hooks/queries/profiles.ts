import { useQuery } from "@tanstack/react-query";
import { profilesApi } from "@/lib/api";
import { useAuth } from "../useAuth";
import { STALE } from "./staleTimes";

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: () => profilesApi.byUserId(user!.id),
    staleTime: STALE.reference,
  });
}

export function useUserRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user,
    queryFn: () => profilesApi.roleFor(user!.id),
    staleTime: STALE.reference,
  });
}
