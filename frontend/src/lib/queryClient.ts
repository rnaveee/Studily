import { MutationCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { toast } from "./toast";

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (err) => {
      if (err instanceof ApiError && err.code === "ACCOUNT_SUSPENDED") return;
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
