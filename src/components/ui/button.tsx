"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400 disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default: "bg-amber-500 text-zinc-950 hover:bg-amber-400 font-semibold shadow-sm",
        secondary: "bg-[#262a34] text-zinc-200 hover:bg-[#313644] border border-white/10",
        ghost: "text-zinc-300 hover:bg-white/8 hover:text-zinc-100",
        outline: "border border-white/12 bg-transparent text-zinc-200 hover:bg-white/8",
        tool: "text-zinc-400 hover:bg-white/8 hover:text-zinc-100 data-[active=true]:bg-amber-500/20 data-[active=true]:text-amber-300 data-[active=true]:border-amber-400/50 border border-transparent",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5 text-xs",
        icon: "h-8 w-8",
        tool: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
