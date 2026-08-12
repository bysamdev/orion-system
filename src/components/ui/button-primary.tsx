import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonPrimaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export function ButtonPrimary({ children, icon, className, ...props }: ButtonPrimaryProps) {
  return (
    <button
      className={cn(
        "bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-[0.98]",
        className
      )}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
