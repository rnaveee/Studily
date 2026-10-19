import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./lib/auth";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./lib/toast";
import { ConfirmProvider } from "./lib/confirm";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  (window as unknown as { deferredInstallPrompt?: Event }).deferredInstallPrompt = e;
  window.dispatchEvent(new Event("studily:install-ready"));
});

function stripTokenParam(url: string) {
  return url.replace(/([?&])token=[^&#]*/g, "$1token=redacted");
}

function scrubTokens<T extends { request?: { url?: string } }>(event: T): T {
  if (event.request?.url) event.request.url = stripTokenParam(event.request.url);
  return event;
}

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
Sentry.init({
  dsn: sentryDsn,
  enabled: !!sentryDsn,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.2,
  beforeSend: scrubTokens,
  beforeBreadcrumb: (crumb) => {
    if (crumb.data) {
      for (const key of ["url", "from", "to"]) {
        if (typeof crumb.data[key] === "string") crumb.data[key] = stripTokenParam(crumb.data[key]);
      }
    }
    return crumb;
  },
  ignoreErrors: [
    /window\.webkit\.messageHandlers/,
    /^ResizeObserver loop/,
  ],
  denyUrls: [
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    /^safari-(web-)?extension:\/\//,
  ],
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ConfirmProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </ConfirmProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
