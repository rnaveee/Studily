import { StrictMode, type ComponentType, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./lib/toast";
import { ConfirmProvider } from "./lib/confirm";
import App from "./App";

export default function AppProviders({
  router: Router,
}: {
  router: ComponentType<{ children: ReactNode }>;
}) {
  return (
    <StrictMode>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Router>
            <AuthProvider>
              <ConfirmProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </ConfirmProvider>
            </AuthProvider>
          </Router>
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>
  );
}
