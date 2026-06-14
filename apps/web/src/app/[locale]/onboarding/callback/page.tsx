"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@torup/ui";

export default function OnboardingCallbackPage() {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (status !== "success") return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          router.replace(`/${locale}/dashboard`);
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status, locale, router]);

  if (status === "success") {
    return (
      <div className="text-center space-y-3">
        <div className="text-5xl">🎉</div>
        <p className="text-white font-semibold text-lg">{t("paymentSuccess")}</p>
        <p className="text-white/40 text-sm">Redirecting in {countdown}s...</p>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="text-5xl">❌</div>
      <p className="text-red-300 font-medium">{t("paymentFailed")}</p>
      <Button onClick={() => router.replace(`/${locale}/onboarding`)}>
        {t("tryAgain")}
      </Button>
    </div>
  );
}
