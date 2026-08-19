import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils.js";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        success: "border-transparent bg-success text-success-foreground",
        warning: "border-transparent bg-warning text-warning-foreground",
        info: "border-transparent bg-muted text-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const dotColor: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-primary-foreground",
  secondary: "bg-secondary-foreground",
  success: "bg-success-foreground",
  warning: "bg-warning-foreground",
  info: "bg-foreground",
  destructive: "bg-destructive-foreground",
  outline: "bg-foreground",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, dot, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dotColor[variant ?? "default"])} />}
      {children}
    </span>
  )
);
Badge.displayName = "Badge";

export { badgeVariants };
export type { VariantProps };
