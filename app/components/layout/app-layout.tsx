import type { AuthUser } from "~/lib/auth";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { ChatWidget } from "~/components/ai-assistant/chat-widget";
import { FloatingCat } from "~/components/pet/floating-cat";

export function AppLayout({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col">
        <Header user={user} />
        <main className="flex-1 p-6 bg-slate-50 dark:bg-slate-950">{children}</main>
      </div>

      {/* Floating widgets */}
      <FloatingCat />
      <ChatWidget />
    </div>
  );
}
