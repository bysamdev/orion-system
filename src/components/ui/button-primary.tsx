import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonPrimaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export const ButtonPrimary = React.forwardRef<HTMLButtonElement, ButtonPrimaryProps>(
  ({ children, icon, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-[0.98]",
          className
        )}
        {...props}
      >
        {icon}
        <span>{children}</span>
      </button>
    );
  }
);
ButtonPrimary.displayName = "ButtonPrimary";
