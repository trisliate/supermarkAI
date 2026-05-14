import { useState } from "react";
import type { AuthUser } from "~/lib/auth";
import { SidebarProvider, SidebarInset } from "~/components/ui/sidebar";
import { AppSidebar } from "./sidebar";
import { Header } from "./header";
import { FloatingCat } from "~/components/pet/floating-cat";
import { ChatWidget } from "~/components/ai-assistant/chat-widget";
import { useFlashToast } from "~/lib/flash";

interface AppLayoutProps {
  user: AuthUser;
  children: React.ReactNode;
  description?: string;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function AppLayout({ user, children, description, backTo, backLabel, actions }: AppLayoutProps) {
  useFlashToast();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return document.cookie.includes("sidebar_state=true");
  });
  const [catEnabled, setCatEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("cat-enabled") !== "false";
  });
  const [chatOpen, setChatOpen] = useState(false);

  const toggleCat = () => {
    const next = !catEnabled;
    setCatEnabled(next);
    localStorage.setItem("cat-enabled", String(next));
  };

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar user={user} />
      <SidebarInset className="bg-slate-50 dark:bg-slate-950">
        <Header user={user} catEnabled={catEnabled} onToggleCat={toggleCat} onOpenChat={() => setChatOpen(true)} description={description} backTo={backTo} backLabel={backLabel} actions={actions} />
        <div className="flex-1 p-6 pb-12 min-h-0">{children}</div>
      </SidebarInset>

      {catEnabled && <FloatingCat />}
      <ChatWidget isOpen={chatOpen} onOpen={() => setChatOpen(true)} onClose={() => setChatOpen(false)} />
    </SidebarProvider>
  );
}
