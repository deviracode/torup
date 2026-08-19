import * as React from "react";
import { Label } from "./label.js";
import { cn } from "./utils.js";

export interface FieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

const errorId = (htmlFor: string | undefined, suffix: string) =>
  htmlFor ? `${htmlFor}-${suffix}` : undefined;

export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  const describedBy = error
    ? errorId(htmlFor, "error")
    : hint
      ? errorId(htmlFor, "hint")
      : undefined;
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="ms-1 text-destructive">*</span>}
        </Label>
      )}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            ...(describedBy ? { "aria-describedby": describedBy } : {}),
            ...(error ? { "aria-invalid": true } : {}),
          })
        : children}
      {error ? (
        <p id={errorId(htmlFor, "error")} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={errorId(htmlFor, "hint")} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
