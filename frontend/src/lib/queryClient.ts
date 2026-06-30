import { MutationCache, QueryClient } from "@tanstack/react-query";
import { toast } from "./toast";

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (err) => {
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
