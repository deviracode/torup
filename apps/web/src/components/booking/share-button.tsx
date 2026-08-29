"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function ShareButton({
  businessName,
  className,
}: {
  businessName: string;
  className?: string;
}) {
  const t = useTranslations("booking");

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: businessName, url });
      } catch {
        // User cancelled the share sheet — not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch {
      toast.error(url);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={t("share")}
      title={t("share")}
      className={
        className ??
        "flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-all hover:bg-black/45"
      }
    >
      <Share2 className="h-5 w-5" />
    </button>
  );
}
