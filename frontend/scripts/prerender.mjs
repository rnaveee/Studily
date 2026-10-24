import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRoutesFromChildren } from "react-router-dom";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const out = join(dist, "prerender");
const routesFile = join(root, "src", "routes.json");

const BASE = "__STUDILY_BASE_URL__";
const NOT_FOUND_TITLE = "Page Not Found · Studily";
const SEGMENT = /^(?::[A-Za-z_][A-Za-z0-9_]*|[A-Za-z0-9._~-]+)$/;

const errors = [];
const fail = (message) => errors.push(message);

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const routes = JSON.parse(readFileSync(routesFile, "utf8"));
const publicPaths = routes.public.map((r) => r.path);
const appPatterns = routes.app;

function checkRouteList() {
  const all = [...publicPaths, ...appPatterns];
  const seen = new Set();
  for (const path of all) {
    if (seen.has(path)) fail(`routes.json lists "${path}" more than once.`);
    seen.add(path);
    const valid =
      path.startsWith("/") &&
      (path === "/" || path.slice(1).split("/").every((segment) => SEGMENT.test(segment)));
    if (!valid) {
      fail(
        `routes.json pattern "${path}" is not supported: use only literal segments and :param segments.`,
      );
    }
  }
}

function flattenRoutes(nodes, prefix = "") {
  const paths = [];
  for (const node of nodes) {
    const segment = (node.path ?? "").replace(/^\/+|\/+$/g, "");
    const full = segment ? `${prefix}/${segment}` : prefix;
    if (node.children?.length) paths.push(...flattenRoutes(node.children, full));
    else if (node.path !== undefined) paths.push(full === "" ? "/" : full);
  }
  return paths;
}

function checkDrift(appRoutes) {
  const routerPaths = new Set(
    flattenRoutes(createRoutesFromChildren(appRoutes)).filter((p) => !p.endsWith("*")),
  );
  const listed = new Set([...publicPaths, ...appPatterns]);
  for (const path of routerPaths) {
    if (!listed.has(path)) {
      fail(
        `Route "${path}" exists in App.tsx but not in src/routes.json. Add it to routes.json as "public" (with a title and description) or "app".`,
      );
    }
  }
  for (const path of listed) {
    if (!routerPaths.has(path)) {
      fail(
        `Route "${path}" is listed in src/routes.json but App.tsx has no matching route. Remove it from routes.json or add the route.`,
      );
    }
  }
}

function setMeta(html, attr, key, value) {
  const pattern = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
  if (!pattern.test(html)) {
    fail(`index.html is missing <meta ${attr}="${key}">.`);
    return html;
  }
  return html.replace(pattern, (_, a, b) => `${a}${escapeHtml(value)}${b}`);
}

function setTitle(html, title) {
  return html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
}

function headExtras(html, extras) {
  return html.replace(/ *<\/head>/, `${extras.map((e) => `    ${e}\n`).join("")}  </head>`);
}

function jsonLd(description) {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Studily",
    description,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: `${BASE}/`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

function publicPage(template, markup, route) {
  const canonical = route.path === "/" ? `${BASE}/` : `${BASE}${route.path}`;
  let html = template.replace(/\s*<meta name="robots" content="noindex" \/>/, "");
  html = setTitle(html, route.title);
  html = setMeta(html, "name", "description", route.description);
  html = setMeta(html, "property", "og:title", route.title);
  html = setMeta(html, "property", "og:description", route.description);
  html = setMeta(html, "property", "og:url", canonical);
  html = setMeta(html, "property", "og:image", `${BASE}/og-image.png`);
  html = setMeta(html, "name", "twitter:title", route.title);
  html = setMeta(html, "name", "twitter:description", route.description);
  html = setMeta(html, "name", "twitter:image", `${BASE}/og-image.png`);
  const extras = [`<link rel="canonical" href="${canonical}" />`];
  if (route.path === "/") extras.push(jsonLd(route.description));
  html = headExtras(html, extras);
  return inject(html, markup);
}

function notFoundPage(template, markup) {
  let html = setTitle(template, NOT_FOUND_TITLE);
  html = setMeta(html, "property", "og:title", NOT_FOUND_TITLE);
  html = setMeta(html, "name", "twitter:title", NOT_FOUND_TITLE);
  return inject(html, markup);
}

function inject(html, markup) {
  if (!html.includes('<div id="root"></div>')) {
    fail('dist/index.html has no empty <div id="root"></div> to render into.');
    return html;
  }
  return html.replace('<div id="root"></div>', () => `<div id="root">${markup}</div>`);
}

function checkOutput(label, html, markup) {
  for (const match of html.matchAll(/<script\b([^>]*)>/g)) {
    const attrs = match[1];
    if (!/\ssrc="/.test(` ${attrs}`) && !/type="application\/ld\+json"/.test(attrs)) {
      fail(`${label}: inline <script> found (CSP script-src 'self' would block it): ${match[0]}`);
    }
  }
  for (const tag of ["title", "meta", "link", "script"]) {
    if (new RegExp(`<${tag}[\\s>]`).test(markup)) {
      fail(`${label}: <${tag}> tag found inside #root.`);
    }
  }
}

function write(relative, content) {
  const file = join(out, relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function stripPreloads(rendered) {
  return rendered.replace(/^(?:<link rel="preload"[^>]*>)*/, "");
}

function renderPage(render, url) {
  try {
    return stripPreloads(render(url));
  } catch (error) {
    fail(`Rendering "${url}" failed: ${error?.stack ?? error}`);
    return null;
  }
}

checkRouteList();

const ssr = await import(pathToFileURL(join(root, "dist-ssr", "entry-server.js")).href);
checkDrift(ssr.appRoutes);

let template;
try {
  template = readFileSync(join(dist, "index.html"), "utf8");
} catch {
  console.error("dist/index.html not found. Run `vite build` first; this script deletes it after prerendering.");
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const pages = [];
for (const route of routes.public) {
  const rendered = renderPage(ssr.render, route.path);
  if (rendered == null) continue;
  const relative = route.path === "/" ? "index.html" : `${route.path.slice(1)}/index.html`;
  pages.push([relative, publicPage(template, rendered, route), rendered]);
}
const notFound = renderPage(ssr.render, "/__not-found__");
if (notFound != null) pages.push(["404.html", notFoundPage(template, notFound), notFound]);

for (const [relative, html, markup] of pages) checkOutput(relative, html, markup);

if (errors.length) {
  console.error(`\nPrerender failed with ${errors.length} problem(s):\n`);
  for (const message of errors) console.error(`  - ${message}\n`);
  process.exit(1);
}

copyFileSync(routesFile, join(out, "routes.json"));
for (const [relative, html] of pages) write(relative, html);
write("app.html", template);
rmSync(join(dist, "index.html"));
console.log(`Prerendered ${pages.length} pages into dist/prerender`);
