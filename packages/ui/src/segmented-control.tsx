import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "./utils.js";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function SegmentedControl({ options, value, onChange, className, disabled }: SegmentedControlProps) {
  const layoutId = React.useId();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const buttonRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    const currentIndex = options.findIndex((opt) => opt.value === value);
    if (currentIndex < 0) return;

    const dir =
      containerRef.current?.closest("[dir]")?.getAttribute("dir") ??
      (document.dir || "ltr");
    const rtl = dir === "rtl";
    const step = rtl ? -1 : 1;

    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else if (event.key === "ArrowRight") nextIndex = currentIndex + step;
    else if (event.key === "ArrowLeft") nextIndex = currentIndex - step;

    if (nextIndex === currentIndex || nextIndex < 0 || nextIndex >= options.length) return;

    event.preventDefault();
    buttonRefs.current[nextIndex]?.focus();
    onChange(options[nextIndex].value);
  };

  return (
    <div
      role="radiogroup"
      onKeyDown={handleKeyDown}
      ref={containerRef}
      className={cn(
        "inline-flex items-center rounded-lg bg-muted p-1 text-muted-foreground",
        disabled && "pointer-events-none opacity-50",
        className
      )}
    >
      {options.map((opt, index) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-foreground" : "hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${layoutId}`}
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
