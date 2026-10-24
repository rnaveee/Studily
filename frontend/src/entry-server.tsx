import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import AppProviders from "./AppProviders";

export { appRoutes } from "./App";

export function render(url: string): string {
  const Router = ({ children }: { children: ReactNode }) => (
    <StaticRouter location={url}>{children}</StaticRouter>
  );
  return renderToString(<AppProviders router={Router} />);
}
