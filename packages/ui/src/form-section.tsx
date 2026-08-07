import * as React from "react";
import { cn } from "./utils.js";

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn("border-b border-border pb-6 last:border-b-0", className)}>
      <div className="mb-4">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export interface SettingRowProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}

export function SettingRow({ title, description, children, htmlFor, className }: SettingRowProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="space-y-0.5">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {title}
        </label>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
