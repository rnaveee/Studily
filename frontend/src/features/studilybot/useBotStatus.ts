import { useQuery } from "@tanstack/react-query";
import { isGuestMode } from "../../lib/api";
import { botApi, type BotStatus } from "./api";

export function useBotStatus() {
  const guest = isGuestMode();
  return useQuery<BotStatus>({
    queryKey: ["bot", "status"],
    queryFn: () => botApi.status(),
    enabled: !guest,
    staleTime: 60_000,
  });
}
