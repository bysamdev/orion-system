import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent shadow-xs",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent shadow-xs",
        outline:
          "border border-border/60 bg-background/50 backdrop-blur-sm hover:bg-accent/20 hover:text-accent-foreground hover:border-primary/40 shadow-xs",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent shadow-xs",
        ghost: "hover:bg-accent/15 hover:text-accent-foreground border border-transparent",
        link: "text-primary underline-offset-4 hover:underline border border-transparent",
        success:
          "bg-success text-success-foreground hover:bg-success/90 border border-transparent shadow-xs",
        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90 border border-transparent shadow-xs",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs gap-1.5",
        lg: "h-11 rounded-xl px-6 text-base gap-2.5",
        icon: "h-9 w-9 p-0 rounded-xl",
        "icon-sm": "h-8 w-8 p-0 rounded-lg",
        "icon-xs": "h-7 w-7 p-0 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
