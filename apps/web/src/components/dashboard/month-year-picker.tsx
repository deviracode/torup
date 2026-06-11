"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const HEBREW_DAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const HEBREW_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

interface MonthYearPickerProps {
  value: Date;
  onSelect: (date: Date) => void;
  trigger: React.ReactNode;
}

export function MonthYearPicker({ value, onSelect, trigger }: MonthYearPickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => value.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const toggle = () => {
    setViewYear(value.getFullYear());
    setViewMonth(value.getMonth());
    setOpen((o) => !o);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { date: Date; current: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(viewYear, viewMonth - 1, daysInPrev - i), current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(viewYear, viewMonth, d), current: true });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ date: new Date(viewYear, viewMonth + 1, d), current: false });
  }

  const toLocalStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const todayStr = toLocalStr(new Date());
  const selectedStr = toLocalStr(value);

  return (
    <div className="text-center relative" ref={containerRef}>
      <div className="contents" onClick={toggle} role="button" tabIndex={0}>
        {trigger}
      </div>
      {open && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-white/10 bg-[hsl(242_44%_10%)] shadow-2xl p-3 w-64">
          {/* Month/year nav */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10">
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-white">{HEBREW_MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="w-7 h-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {HEBREW_DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-white/30 py-0.5">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map(({ date, current }, i) => {
              const dateStr = toLocalStr(date);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedStr;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { onSelect(date); setOpen(false); }}
                  className={`
                    h-7 w-full rounded-md text-xs font-medium transition-colors
                    ${!current ? "text-white/20 hover:text-white/40 hover:bg-white/5" : ""}
                    ${current && !isToday && !isSelected ? "text-white/70 hover:bg-white/10 hover:text-white" : ""}
                    ${isSelected ? "text-white font-bold" : ""}
                    ${isToday && !isSelected ? "ring-1 ring-[#a78bfa] text-[#a78bfa]" : ""}
                  `}
                  style={isSelected ? { background: "var(--grad-primary)" } : {}}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
