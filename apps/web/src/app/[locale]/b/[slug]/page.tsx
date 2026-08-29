import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Phone } from "lucide-react";
import { BookingFlow } from "@/components/booking/booking-flow";
import { ShareButton } from "@/components/booking/share-button";
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

function WazeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 122.71 122.88" className={className} aria-hidden="true">
      <path
        fill="#FFFFFF"
        d="M55.14,104.21c4.22,0,8.44,0.19,12.66-0.09c3.84-0.19,7.88-0.56,11.63-1.5c29.82-7.31,45.76-40.23,32.72-68.07 C104.27,17.76,90.77,8.19,72.3,6.22c-14.16-1.5-26.82,2.72-37.51,12.28c-10.5,9.47-15.94,21.28-16.31,35.44 c-0.09,3.28,0,6.66,0,9.94C18.38,71.02,14.35,76.55,7.5,78.7c-0.09,0-0.28,0.19-0.38,0.19c2.63,6.94,13.31,17.16,19.97,19.69 C35.45,87.14,52.32,91.18,55.14,104.21L55.14,104.21z"
      />
      <path
        fill="#000000"
        d="M54.95,110.49c-1.03,4.69-3.56,8.16-7.69,10.31c-5.25,2.72-10.6,2.63-15.57-0.56c-5.16-3.28-7.41-8.25-7.03-14.35 c0.09-1.03-0.19-1.41-1.03-1.88c-9.1-4.78-16.31-11.44-21.28-20.44c-0.94-1.78-1.69-3.66-2.16-5.63c-0.66-2.72,0.38-4.03,3.19-4.31 c3.38-0.38,6.38-1.69,7.88-4.88c0.66-1.41,1.03-3.09,1.03-4.69c0.19-4.03,0-8.06,0.19-12.1c1.03-15.57,7.5-28.5,19.32-38.63 C42.67,3.97,55.42-0.43,69.76,0.03c25.04,0.94,46.51,18.57,51.57,43.23c4.59,22.32-2.34,40.98-20.07,55.51 c-1.03,0.84-2.16,1.69-3.38,2.44c-0.66,0.47-0.84,0.84-0.56,1.59c2.34,7.13-0.94,15-7.5,18.38c-8.91,4.41-19.22-0.09-21.94-9.66 c-0.09-0.38-0.56-0.84-0.84-0.84C63.11,110.4,59.07,110.49,54.95,110.49L54.95,110.49z M55.14,104.21c4.22,0,8.44,0.19,12.66-0.09 c3.84-0.19,7.88-0.56,11.63-1.5c29.82-7.31,45.76-40.23,32.72-68.07C104.27,17.76,90.77,8.19,72.3,6.22 c-14.16-1.5-26.82,2.72-37.51,12.28c-10.5,9.47-15.94,21.28-16.31,35.44c-0.09,3.28,0,6.66,0,9.94 C18.38,71.02,14.35,76.55,7.5,78.7c-0.09,0-0.28,0.19-0.38,0.19c2.63,6.94,13.31,17.16,19.97,19.69 C35.45,87.14,52.32,91.18,55.14,104.21L55.14,104.21z"
      />
      <path
        fill="#000000"
        d="M74.92,79.74c-11.07-0.56-18.38-4.97-23.07-13.78c-1.13-2.16-0.09-4.31,2.06-4.78c1.31-0.28,2.53,0.66,3.47,2.16 c1.22,1.88,2.44,3.75,4.03,5.25c8.81,8.34,23.25,5.72,28.79-5.06c0.66-1.31,1.5-2.34,3.09-2.34c2.34,0.09,3.66,2.44,2.63,4.59 c-2.91,5.91-7.5,10.22-13.69,12.28C79.51,78.99,76.7,79.36,74.92,79.74L74.92,79.74z"
      />
      <path
        fill="#000000"
        d="M55.32,48.98c-3.38,0-6.09-2.72-6.09-6.09s2.72-6.09,6.09-6.09s6.09,2.72,6.09,6.09C61.42,46.17,58.7,48.98,55.32,48.98 L55.32,48.98z"
      />
      <path
        fill="#000000"
        d="M98.27,42.79c0,3.38-2.72,6.09-6,6.19c-3.38,0-6.09-2.63-6.09-6.09c0-3.38,2.63-6.09,6-6.19 C95.46,36.7,98.17,39.42,98.27,42.79L98.27,42.79z"
      />
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
  const displayPhone: string | undefined = business.contact_phone || business.phone || undefined;
  const telLink: string | undefined = displayPhone ? `tel:${displayPhone}` : undefined;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero banner */}
      <div className="relative">
        <div
          className="h-40 w-full sm:h-64"
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

        <ShareButton businessName={business.name} className="absolute end-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-all hover:bg-black/45" />

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
          <div className="mt-4 flex items-center justify-center gap-3">
            {wazeLink && (
              <a
                href={wazeLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("waze")}
                title={t("waze")}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-sky-100 bg-sky-50 shadow-sm transition-all hover:border-sky-300 hover:shadow"
              >
                <WazeIcon className="h-7 w-7" />
              </a>
            )}
            {telLink && (
              <a
                href={telLink}
                aria-label={displayPhone}
                title={displayPhone}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-indigo-500 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:shadow"
              >
                <Phone className="h-7 w-7" />
              </a>
            )}
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("whatsapp")}
                title={t("whatsapp")}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-500 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:shadow"
              >
                <WhatsAppIcon className="h-7 w-7" />
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
