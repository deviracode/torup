"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const HEBREW_MONTH_ABBREVIATIONS = [
  "ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ",
];

interface MonthYearPickerProps {
  /** The date used to determine which month/year is highlighted as "current". */
  value: Date;
  /** Called with the 1st of the selected month. */
  onSelect: (date: Date) => void;
  /** The clickable element that toggles the popup open/closed. */
  trigger: React.ReactNode;
}

export function MonthYearPicker({ value, onSelect, trigger }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => value.getFullYear());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const toggle = () => {
    setPickerYear(value.getFullYear());
    setOpen((o) => !o);
  };

  const currentMonth = value.getMonth();
  const currentYear = value.getFullYear();

  return (
    <div className="text-center relative" ref={containerRef}>
      <div className="contents" onClick={toggle} role="button" tabIndex={0}>
        {trigger}
      </div>
      {open && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-white/10 bg-[hsl(242_44%_10%)] shadow-2xl p-3 w-56">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setPickerYear((y) => y - 1)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-white">{pickerYear}</span>
            <button
              type="button"
              onClick={() => setPickerYear((y) => y + 1)}
              className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {HEBREW_MONTH_ABBREVIATIONS.map((m, i) => {
              const isCurrentMonth = i === currentMonth && pickerYear === currentYear;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onSelect(new Date(pickerYear, i, 1));
                    setOpen(false);
                  }}
                  className={`rounded-lg py-1.5 text-xs transition-colors ${
                    isCurrentMonth ? "bg-primary/20 text-[#a78bfa] font-semibold" : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
