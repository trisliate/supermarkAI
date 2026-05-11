import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

interface FormSectionProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ icon: Icon, title, description, children, className }: FormSectionProps) {
  return (
    <div className={cn(
      "bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5",
      className
    )}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              {Icon && <Icon className="w-4 h-4 text-primary" />}
              {title}
            </div>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
