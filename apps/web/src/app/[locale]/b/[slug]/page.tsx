import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MapPin, Phone } from "lucide-react";
import { BookingFlow } from "@/components/booking/booking-flow";
import { toInternationalPhone } from "@/lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const TORUP_SITE_URL = "https://torup.pandacode.co.il";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.06c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.13.11-1.82-.12-.42-.13-.96-.32-1.65-.62-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.02-2.41.26-.29.58-.36.77-.36.19 0 .39 0 .55.01.18.01.42-.07.65.5.24.58.81 2 .88 2.15.07.15.12.32.02.52-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.76 1.25 1.64 2.02 1.13.99 2.08 1.3 2.37 1.44.29.15.46.13.63-.05.17-.19.72-.83.91-1.12.19-.29.38-.24.63-.14.26.1 1.63.77 1.91.91.29.15.48.22.55.34.07.13.07.72-.17 1.4Z" />
    </svg>
  );
}

interface ServiceCategory {
  id: string;
  name_he: string;
  name_ar: string | null;
  name_en: string | null;
  sort_order: number;
}

async function getBusiness(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/businesses/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getServices(businessId: string): Promise<{ services: unknown[]; categories: ServiceCategory[] }> {
  try {
    const res = await fetch(`${API_URL}/api/businesses/${businessId}/services`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { services: [], categories: [] };
    const result = await res.json();
    if (Array.isArray(result)) {
      return { services: result, categories: [] };
    }
    return { services: result.services || [], categories: result.categories || [] };
  } catch {
    return { services: [], categories: [] };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusiness(slug);

  if (!business) return { title: "Business Not Found" };

  return {
    title: `${business.name} - Book an Appointment`,
    description: business.description || `Book an appointment with ${business.name}`,
    openGraph: {
      title: business.name,
      description: business.description || `Book an appointment with ${business.name}`,
      images: business.cover_url
        ? [business.cover_url]
        : business.logo_url
          ? [business.logo_url]
          : [],
    },
  };
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const business = await getBusiness(slug);

  if (!business) notFound();

  const { services, categories } = await getServices(business.id);
  const t = await getTranslations({ locale, namespace: "booking" });

  const wazeLink: string | undefined =
    business.social_links?.waze ||
    (business.address ? `https://waze.com/ul?q=${encodeURIComponent(business.address)}&navigate=yes` : undefined);
  const whatsappNumber: string | undefined =
    business.social_links?.whatsapp || business.contact_phone || business.phone || undefined;
  const whatsappLink: string | undefined = whatsappNumber
    ? `https://wa.me/${toInternationalPhone(whatsappNumber)}`
    : undefined;
  const telLink: string | undefined = business.phone ? `tel:${business.phone}` : undefined;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero banner */}
      <div className="relative">
        <div
          // Matches the recommended upload size (1600×600, an 8:3 ratio) so a
          // correctly-sized banner always shows with zero cropping — no
          // max-height cap, since that would clip the image on wide screens.
          className="aspect-[8/3] w-full min-h-[140px]"
          style={
            business.cover_url
              ? {
                  backgroundImage: `url(${business.cover_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {
                  background:
                    "linear-gradient(135deg, #4f46e5 0%, #6366f1 45%, #d4a24e 130%)",
                }
          }
        >
          <div className="h-full w-full bg-gradient-to-t from-black/40 via-black/0 to-black/0" />
        </div>

        <div className="mx-auto max-w-2xl px-4">
          <div className="-mt-10 flex items-end gap-4 sm:-mt-12">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg sm:h-24 sm:w-24">
              {business.logo_url ? (
                <img
                  src={business.logo_url}
                  alt={business.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-indigo-50 text-2xl font-bold text-indigo-400">
                  {business.name?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Business info + quick actions */}
      <div className="mx-auto max-w-2xl px-4 pb-2 pt-4">
        <h1 className="text-2xl font-bold text-slate-900">{business.name}</h1>
        {business.description && (
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{business.description}</p>
        )}

        {(wazeLink || telLink || whatsappLink) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {wazeLink && (
              <a
                href={wazeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 hover:shadow"
              >
                <MapPin className="h-[18px] w-[18px] shrink-0 text-sky-500" />
                {t("waze")}
              </a>
            )}
            {telLink && (
              <a
                href={telLink}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow"
              >
                <Phone className="h-[18px] w-[18px] shrink-0 text-indigo-500" />
                <span dir="ltr">{business.phone}</span>
              </a>
            )}
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow"
              >
                <WhatsAppIcon className="h-[18px] w-[18px] shrink-0 text-emerald-500" />
                {t("whatsapp")}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Booking Flow */}
      <div className="mx-auto max-w-2xl px-4 py-6">
        <BookingFlow
          business={business}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          services={services as any[]}
          categories={categories}
          locale={locale}
        />
      </div>

      {/* Platform footer */}
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-2">
        <a
          href={TORUP_SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-600"
        >
          <span>{t("poweredBy")}</span>
          <span className="font-bold tracking-tight">
            <span className="text-teal-600">Tor</span>
            <span className="text-orange-400">Up</span>
          </span>
        </a>
      </div>
    </main>
  );
}
