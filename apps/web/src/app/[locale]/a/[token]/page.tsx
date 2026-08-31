import { AppointmentLinkView } from "@/components/appointment-link/appointment-link-view";

export default async function AppointmentLinkPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <AppointmentLinkView token={token} />
      </div>
    </div>
  );
}
