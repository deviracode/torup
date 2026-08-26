import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MapPin, Phone, MessageCircle } from "lucide-react";
import { BookingFlow } from "@/components/booking/booking-flow";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

  const wazeLink: string | undefined = business.social_links?.waze || undefined;
  const whatsappLink: string | undefined =
    business.social_links?.whatsapp ||
    (business.contact_phone || business.phone
      ? `https://wa.me/${(business.contact_phone || business.phone).replace(/[^0-9]/g, "")}`
      : undefined);
  const telLink: string | undefined = business.phone ? `tel:${business.phone}` : undefined;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Hero banner */}
      <div className="relative">
        <div
          className="h-40 w-full sm:h-56"
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
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-sky-300 hover:text-sky-700 hover:shadow"
              >
                <MapPin className="h-4 w-4" />
                {t("waze")}
              </a>
            )}
            {telLink && (
              <a
                href={telLink}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-700 hover:shadow"
              >
                <Phone className="h-4 w-4" />
                {business.phone}
              </a>
            )}
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-emerald-300 hover:text-emerald-700 hover:shadow"
              >
                <MessageCircle className="h-4 w-4" />
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
        <Link
          href={`/${locale}`}
          className="flex items-center justify-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-600"
        >
          <span>{t("poweredBy")}</span>
          <span className="font-bold tracking-tight">
            <span className="text-teal-600">Tor</span>
            <span className="text-orange-400">Up</span>
          </span>
        </Link>
      </div>
    </main>
  );
}
