"use client";

import { Clock, X } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export interface ChangeRequest {
  id: string;
  type: "edit" | "cancel";
  proposed_start_time: string | null;
  reason: string | null;
  created_at: string;
  appointment_id: string;
}

interface Props {
  requests: ChangeRequest[];
  loading: boolean;
  isRtl: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export function PendingRequestsPanel({
  requests, loading, isRtl, onClose, onApprove, onReject,
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
          {t("pendingRequestsTitle")}
          {requests.length > 0 && (
            <span className="ms-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {requests.length}
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
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-white/30 text-sm">
            {t("noPendingChangeRequests")}
          </div>
        ) : (
          requests.map((req) => {
            const proposedTime = req.proposed_start_time
              ? new Date(req.proposed_start_time).toLocaleString(isRtl ? "he-IL" : "en-US", {
                  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
                })
              : null;

            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl p-3 border border-orange-400/20"
                style={{ background: "rgba(239,68,68,0.06)" }}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <p className="text-xs font-semibold text-white">
                    {req.type === "cancel" ? t("changeRequestCancel") : t("changeRequestEdit")}
                  </p>
                </div>

                {proposedTime && (
                  <div className="flex items-center gap-1 text-[10px] text-white/50 mb-2">
                    <Clock className="h-3 w-3" />
                    {proposedTime}
                  </div>
                )}

                {req.reason && (
                  <p className="text-[10px] text-white/35 border-t border-white/6 pt-1.5 mt-1.5 line-clamp-2">{req.reason}</p>
                )}

                <div className="flex gap-2 mt-2 pt-2 border-t border-white/6">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onApprove(req.id)}
                    className="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)" }}
                  >
                    {t("approve")}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onReject(req.id)}
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
