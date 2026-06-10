"use client";

import { Clock, Scissors, X } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

interface Appointment {
  id: string;
  status: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  customers?: { name: string; phone: string };
  services?: { name_he: string; name_en: string | null };
}

interface Props {
  appointments: Appointment[];
  loading: boolean;
  isRtl: boolean;
  onClose: () => void;
  onApprove: (id: string, date: string) => void;
  onReject: (id: string) => void;
  onSelectDate: (date: string) => void;
}

export function PendingApprovalsPanel({
  appointments, loading, isRtl, onClose, onApprove, onReject, onSelectDate,
}: Props) {
  const t = useTranslations("dashboard");
  return (
    <div
      className="flex flex-col rounded-xl border border-white/8 overflow-hidden flex-shrink-0"
      style={{ width: 360, background: "rgba(255,255,255,0.03)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/7">
        <h2 className="text-sm font-bold text-white">
          {t("pendingApprovalsTitle")}
          {appointments.length > 0 && (
            <span className="ms-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {appointments.length}
            </span>
          )}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/8 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-white/5 h-24" />
          ))
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-white/30 text-sm">
            {t("noPendingRequests")}
          </div>
        ) : (
          appointments.map((apt) => {
            const startDate = new Date(apt.start_time);
            const date = apt.start_time.split("T")[0];
            const time = startDate.toLocaleTimeString(isRtl ? "he-IL" : "en-US", {
              hour: "2-digit", minute: "2-digit", hour12: false,
            });
            const endTime = new Date(apt.end_time).toLocaleTimeString(isRtl ? "he-IL" : "en-US", {
              hour: "2-digit", minute: "2-digit", hour12: false,
            });
            const dateLabel = startDate.toLocaleDateString(isRtl ? "he-IL" : "en-US", {
              weekday: "short", day: "numeric", month: "short",
            });

            return (
              <motion.div
                key={apt.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-3 border border-orange-400/20 cursor-pointer hover:border-orange-400/40 transition-colors"
                style={{ background: "rgba(239,68,68,0.06)" }}
                onClick={() => onSelectDate(date)}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #ef4444, #f472b6)" }}
                    >
                      {apt.customers?.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{apt.customers?.name ?? "—"}</p>
                      <p className="text-[10px] text-white/40">{apt.customers?.phone ?? ""}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[10px] text-white/50 mb-2">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {dateLabel} · {time}–{endTime}
                  </span>
                  {apt.services && (
                    <span className="flex items-center gap-1">
                      <Scissors className="h-3 w-3" />
                      {isRtl ? apt.services.name_he : (apt.services.name_en ?? apt.services.name_he)}
                    </span>
                  )}
                </div>

                {apt.notes && (
                  <p className="text-[10px] text-white/35 border-t border-white/6 pt-1.5 mt-1.5 line-clamp-1">{apt.notes}</p>
                )}

                <div className="flex gap-2 mt-2 pt-2 border-t border-white/6">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={(e) => { e.stopPropagation(); onApprove(apt.id, date); }}
                    className="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)" }}
                  >
                    {t("approve")}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={(e) => { e.stopPropagation(); onReject(apt.id); }}
                    className="flex-1 rounded-lg py-1.5 text-[11px] font-bold border border-red-500/30 bg-red-500/10 text-red-300"
                  >
                    {t("reject")}
                  </motion.button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
