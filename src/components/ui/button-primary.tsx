import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonPrimaryProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export function ButtonPrimary({ children, icon, className, ...props }: ButtonPrimaryProps) {
  return (
    <button
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
