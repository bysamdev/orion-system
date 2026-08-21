import React from "react";
import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "@/components/ui/button";

export interface ButtonPrimaryProps extends ButtonProps {
  icon?: React.ReactNode;
}

export const ButtonPrimary = React.forwardRef<HTMLButtonElement, ButtonPrimaryProps>(
  ({ children, icon, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          "font-semibold gap-2 shadow-xs transition-all active:scale-[0.98]",
          className
        )}
        {...props}
      >
        {icon}
        <span>{children}</span>
      </Button>
    );
  }
);
ButtonPrimary.displayName = "ButtonPrimary";
