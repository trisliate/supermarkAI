import { useState } from "react";
import type { AuthUser } from "~/lib/auth";
import { SidebarProvider, SidebarInset } from "~/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { Header } from "./header";
import { FloatingCat } from "~/components/pet/floating-cat";
import { useFlashToast } from "~/lib/flash";

export function AppLayout({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  useFlashToast();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return document.cookie.includes("sidebar_state=true");
  });
  const [catEnabled, setCatEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("cat-enabled") !== "false";
  });

  const toggleCat = () => {
    const next = !catEnabled;
    setCatEnabled(next);
    localStorage.setItem("cat-enabled", String(next));
  };

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar user={user} />
      <SidebarInset className="bg-slate-50 dark:bg-slate-950">
        <Header user={user} catEnabled={catEnabled} onToggleCat={toggleCat} />
        <div className="flex-1 p-6 h-full">{children}</div>
      </SidebarInset>

      {catEnabled && <FloatingCat />}
    </SidebarProvider>
  );
}
