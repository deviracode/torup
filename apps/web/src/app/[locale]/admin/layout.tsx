"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Building2, BarChart3, CreditCard, FileText, ArrowLeft } from "lucide-react";

const adminNavItems = [
  { key: "businesses", href: "/admin", icon: Building2 },
  { key: "analytics", href: "/admin/analytics", icon: BarChart3 },
  { key: "plans", href: "/admin/plans", icon: CreditCard },
  { key: "templates", href: "/admin/templates", icon: FileText },
];

function AdminSidebar() {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const locale = useLocale();

  return (
    <aside className="flex h-screen w-64 flex-col border-e border-border bg-card">
      <div className="flex h-16 items-center justify-center border-b border-border">
        <h1 className="text-xl font-bold text-primary">QueuePro Admin</h1>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {adminNavItems.map((item) => {
          const href = `/${locale}${item.href}`;
          const isActive =
            item.href === "/admin"
              ? pathname.endsWith("/admin")
              : pathname.includes(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.key}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t(item.key)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <Link
          href={`/${locale}/dashboard`}
          className="flex items-center justify-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToDashboard")}
        </Link>
      </div>
    </aside>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthGuard requiredRole="super_admin">
        <div className="flex h-screen">
          <AdminSidebar />
          <main className="flex-1 overflow-auto bg-background p-6">{children}</main>
        </div>
      </AuthGuard>
    </AuthProvider>
  );
}
