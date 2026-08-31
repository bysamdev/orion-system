import * as React from "react";
import { toast as sonnerToast } from "sonner";

export interface ToastProps {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive" | "success" | "warning" | "info" | string;
  action?: React.ReactNode;
}

export function toast({ title, description, variant, action }: ToastProps) {
  const message = typeof title === "string" ? title : (description as string) || "";
  const opts = {
    description: typeof title === "string" ? (description as string) : undefined,
    action: action as any,
  };

  if (variant === "destructive") {
    return sonnerToast.error(message, opts);
  }
  if (variant === "success") {
    return sonnerToast.success(message, opts);
  }
  if (variant === "warning") {
    return sonnerToast.warning(message, opts);
  }
  if (variant === "info") {
    return sonnerToast.info(message, opts);
  }
  return sonnerToast(message, opts);
}

export function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    toasts: [],
  };
}

