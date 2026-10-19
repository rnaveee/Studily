import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import WarningModal from "./WarningModal";
import type { MeModeration } from "../../types";

export default function ModerationNotices() {
  const { user, guest } = useAuth();

  const { data } = useQuery({
    queryKey: ["me", "moderation"],
    queryFn: () => api.get<MeModeration>("/me/moderation"),
    enabled: !!user && !user.suspended && !guest,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  if (!data || data.warnings.length === 0) return null;
  return <WarningModal warnings={data.warnings} />;
}
