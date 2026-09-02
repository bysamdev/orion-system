import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TableEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const TableEmptyState = React.forwardRef<HTMLDivElement, TableEmptyStateProps>(
  ({ className, icon: Icon = Inbox, title, description, action, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center p-8 sm:p-12 space-y-3",
          className
        )}
        {...props}
      >
        <div className="w-12 h-12 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-center text-muted-foreground">
          <Icon className="w-6 h-6" />
        </div>
        <div className="space-y-1 max-w-sm">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          {description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
        {(action || children) && (
          <div className="pt-2 flex items-center gap-2">
            {action}
            {children}
          </div>
        )}
      </div>
    );
  }
);
TableEmptyState.displayName = "TableEmptyState";

export { TableEmptyState };
