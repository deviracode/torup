import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "hsl(242 44% 8%)" }}
      >
        {children}
      </div>
    </AuthProvider>
  );
}
