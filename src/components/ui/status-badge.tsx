import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
  {
    variants: {
      variant: {
        online: "border-success/30 bg-success/15 text-success",
        offline: "border-destructive/30 bg-destructive/15 text-destructive",
        warning: "border-warning/30 bg-warning/15 text-warning",
        info: "border-info/30 bg-info/15 text-info",
        muted: "border-border/50 bg-muted/40 text-muted-foreground",
        success: "border-success/30 bg-success/15 text-success",
        destructive: "border-destructive/30 bg-destructive/15 text-destructive",
        secondary: "border-border/40 bg-secondary text-secondary-foreground",
        outline: "border-border/60 text-foreground bg-background/50 backdrop-blur-xs",
        primary: "border-primary/30 bg-primary/15 text-primary",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.2 text-micro font-medium gap-1",
        lg: "px-3 py-1 text-sm gap-2",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  dot?: boolean;
  pulse?: boolean;
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ className, variant = "secondary", size = "default", dot = true, pulse = false, children, ...props }, ref) => {
    const dotColors: Record<string, string> = {
      online: "bg-success",
      success: "bg-success",
      offline: "bg-destructive",
      destructive: "bg-destructive",
      warning: "bg-warning",
      info: "bg-info",
      muted: "bg-muted-foreground",
      secondary: "bg-muted-foreground",
      outline: "bg-foreground",
      primary: "bg-primary",
    };

    const dotColor = variant ? dotColors[variant] || "bg-current" : "bg-current";

    return (
      <div ref={ref} className={cn(statusBadgeVariants({ variant, size }), className)} {...props}>
        {dot && (
          <span className="relative flex h-1.5 w-1.5">
            {pulse && (
              <span
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  dotColor
                )}
              />
            )}
            <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", dotColor)} />
          </span>
        )}
        <span>{children}</span>
      </div>
    );
  }
);
StatusBadge.displayName = "StatusBadge";

export { StatusBadge, statusBadgeVariants };
