import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
      images: business.logo_url ? [business.logo_url] : [],
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

  return (
    <main className="min-h-screen bg-gray-50" style={{ backgroundColor: "#f8fafc" }}>
      {/* Business Header */}
      <div className="border-b" style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}>
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="flex items-center gap-4">
            {business.logo_url && (
              <img
                src={business.logo_url}
                alt={business.name}
                className="h-16 w-16 rounded-full object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>{business.name}</h1>
              {business.description && (
                <p className="mt-1" style={{ color: "#64748b" }}>{business.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Flow */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        <BookingFlow
          business={business}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          services={services as any[]}
          categories={categories}
          locale={locale}
        />
      </div>
    </main>
  );
}
