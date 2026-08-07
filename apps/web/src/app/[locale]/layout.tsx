import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { NextIntlClientProvider, useMessages } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { RadixDirectionProvider } from "@/components/radix-direction-provider";
import { routing } from "@/i18n/routing";
import { Toaster } from "sonner";
import "../globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TorUp - Smart Appointment Management",
  description: "AI-powered appointment and queue management for businesses",
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
  },
};

function getDirection(locale: string) {
  return locale === "en" ? "ltr" : "rtl";
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "he" | "ar" | "en")) {
    notFound();
  }

  const messages = await getMessages();
  const dir = getDirection(locale);

  return (
    <html lang={locale} dir={dir} className={heebo.variable}>
      <body>
        {/* Radix primitives default to LTR internally — feed them the page
            direction so Tabs/Select/DropdownMenu/Popover mirror RTL. */}
        <RadixDirectionProvider dir={dir}>
          <NextIntlClientProvider messages={messages}>
            {children}
          <Toaster richColors position="top-right" />
          </NextIntlClientProvider>
        </RadixDirectionProvider>
      </body>
    </html>
  );
}
