import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./utils.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, dir = "auto", ...props }, ref) => {
    return (
      <input
        type={type}
        dir={dir}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background ps-3 pe-3 py-2 text-sm text-start ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
