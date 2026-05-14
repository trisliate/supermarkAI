import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { Toaster } from "~/components/ui/sonner";
import { ThemeProvider } from "~/components/theme-provider";
import { TooltipProvider } from "~/components/ui/tooltip";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t=localStorage.getItem("theme")||"dark";
            var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme:dark)").matches);
            if(d)document.documentElement.classList.add("dark");
            var a=localStorage.getItem("accent-color")||"blue";
            var m={blue:{l:"oklch(0.55 0.24 265)",d:"oklch(0.65 0.24 265)"},indigo:{l:"oklch(0.50 0.24 285)",d:"oklch(0.60 0.24 285)"},violet:{l:"oklch(0.52 0.24 300)",d:"oklch(0.62 0.24 300)"},cyan:{l:"oklch(0.60 0.16 200)",d:"oklch(0.70 0.16 200)"},emerald:{l:"oklch(0.55 0.18 160)",d:"oklch(0.65 0.18 160)"},amber:{l:"oklch(0.65 0.18 85)",d:"oklch(0.75 0.18 85)"},rose:{l:"oklch(0.55 0.22 15)",d:"oklch(0.65 0.22 15)"},black:{l:"oklch(0.20 0 0)",d:"oklch(0.85 0 0)"}};
            var o=m[a]||m.blue;
            var v=d?o.d:o.l;
            var fg=d?"oklch(0.15 0.02 265)":"oklch(0.99 0 0)";
            var r=document.documentElement.style;
            r.setProperty("--primary",v);r.setProperty("--primary-foreground",fg);
            r.setProperty("--ring",v);r.setProperty("--sidebar-primary",v);
            r.setProperty("--sidebar-primary-foreground",fg);
          })();
        `}} />
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ThemeProvider>
        <Toaster position="top-right" richColors closeButton />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "出错了";
  let details = "发生了意外错误。";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "错误";
    details =
      error.status === 404
        ? "找不到请求的页面。"
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main style={{ padding: "4rem 1rem", maxWidth: "640px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1rem" }}>{message}</h1>
      <p style={{ color: "#666", marginBottom: "1rem" }}>{details}</p>
      {stack && (
        <pre style={{ width: "100%", padding: "1rem", overflow: "auto", background: "#f5f5f5", borderRadius: "8px" }}>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
