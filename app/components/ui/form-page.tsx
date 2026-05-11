import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

interface FormPageProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function FormPage({ icon: Icon, title, subtitle, children, actions, className }: FormPageProps) {
  return (
    <div className={cn("max-w-3xl animate-fade-in", className)}>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {children}
      </div>

      {actions && (
        <div className="flex gap-3 pt-6 border-t border-slate-200 dark:border-slate-800 mt-6">
          {actions}
        </div>
      )}
    </div>
  );
}
