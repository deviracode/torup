import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js";
import { cn } from "./utils.js";

export interface TimePickerProps {
  value: string; // "HH:mm", 24h
  onChange: (value: string) => void;
  minuteStep?: number;
  className?: string;
  disabled?: boolean;
  hourPlaceholder?: string;
  minutePlaceholder?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const DEFAULT_MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export function TimePicker({ value, onChange, minuteStep = 5, className, disabled, hourPlaceholder = "--", minutePlaceholder = "--" }: TimePickerProps) {
  const [hour, minute] = (value ?? "09:00").split(":");
  const minutes =
    minuteStep === 5 ? DEFAULT_MINUTES : Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => String(i * minuteStep).padStart(2, "0"));

  const setHour = (h: string) => onChange(`${h}:${minute}`);
  const setMinute = (m: string) => onChange(`${hour}:${m}`);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={hour} onValueChange={setHour} disabled={disabled}>
        <SelectTrigger className="w-20" aria-label="Hour">
          <SelectValue placeholder={hourPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground" aria-hidden>
        :
      </span>
      <Select value={minutes.includes(minute) ? minute : undefined} onValueChange={setMinute} disabled={disabled}>
        <SelectTrigger className="w-20" aria-label="Minute">
          <SelectValue placeholder={minutePlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {minutes.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
