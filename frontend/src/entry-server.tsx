import type { ReactNode } from "react";
import { prerender } from "react-dom/static";
import { StaticRouter } from "react-router-dom";
import AppProviders from "./AppProviders";

export { appRoutes } from "./App";

export async function render(url: string): Promise<string> {
  const Router = ({ children }: { children: ReactNode }) => (
    <StaticRouter location={url}>{children}</StaticRouter>
  );
  const { prelude } = await prerender(<AppProviders router={Router} />, {
    progressiveChunkSize: Number.POSITIVE_INFINITY,
  });
  return new Response(prelude).text();
}
