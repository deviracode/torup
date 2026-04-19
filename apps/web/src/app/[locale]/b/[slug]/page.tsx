import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookingFlow } from "@/components/booking/booking-flow";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

async function getServices(businessId: string) {
  try {
    const res = await fetch(`${API_URL}/api/businesses/${businessId}/services`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
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

  const services = await getServices(business.id);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Business Header */}
      <div className="bg-white border-b">
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
              <h1 className="text-2xl font-bold">{business.name}</h1>
              {business.description && (
                <p className="text-gray-600 mt-1">{business.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Flow */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        <BookingFlow
          business={business}
          services={services}
          locale={locale}
        />
      </div>
    </main>
  );
}
