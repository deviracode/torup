"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/components/auth/auth-provider";
import { LanguagePicker } from "@/components/language-picker";
import { Button, Sheet, SheetContent, SheetTrigger, SheetTitle, Separator } from "@torup/ui";
import { Calendar, Users, Scissors, Settings, BarChart3, CreditCard, LogOut, Menu } from "lucide-react";

const navItems = [
  { key: "calendar", href: "/dashboard", icon: Calendar },
  { key: "customers", href: "/dashboard/customers", icon: Users },
  { key: "services", href: "/dashboard/services", icon: Scissors },
  { key: "settings", href: "/dashboard/settings", icon: Settings },
  { key: "analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { key: "billing", href: "/dashboard/billing", icon: CreditCard },
];

function NavLinks({ locale, pathname, t, onNavigate }: { locale: string; pathname: string; t: (key: string) => string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 p-4">
      {navItems.map((item) => {
        const href = `/${locale}${item.href}`;
        const isActive =
          item.href === "/dashboard"
            ? pathname.endsWith("/dashboard")
            : pathname.includes(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.key}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
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
  );
}

export function Sidebar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = useLocale();
  const { signOut } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  const tCommon = useTranslations("common");
  const logoutLabel = tCommon("logout");

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-14 items-center justify-center border-b">
              <span className="text-lg font-bold text-primary">TorUp</span>
            </div>
            <NavLinks locale={locale} pathname={pathname} t={t} onNavigate={() => setSheetOpen(false)} />
            <div className="border-t p-4 space-y-2">
              <LanguagePicker />
              <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={() => signOut()}>
                <LogOut className="h-4 w-4" />
                {logoutLabel}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        <span className="text-lg font-bold text-primary">TorUp</span>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-64 flex-col border-e bg-background">
        <div className="flex h-14 items-center justify-center border-b">
          <span className="text-lg font-bold text-primary">TorUp</span>
        </div>

        <NavLinks locale={locale} pathname={pathname} t={t} />

        <Separator />
        <div className="p-4 space-y-2">
          <LanguagePicker />
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" />
            {logoutLabel}
          </Button>
        </div>
      </aside>
    </>
  );
}
