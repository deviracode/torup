import { AppointmentLinkView } from "@/components/appointment-link/appointment-link-view";

export default async function AppointmentLinkPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { token } = await params;
  return (
    <main
      className="relative min-h-screen overflow-hidden"
      style={{ background: "hsl(244 93% 5%)" }}
    >
      {/* Ambient background orbs — same brand treatment as the landing page */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div
          className="orb-1 absolute top-[-200px] left-[-150px] h-[500px] w-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="orb-3 absolute bottom-[-180px] left-1/2 h-[400px] w-[400px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(212,162,78,0.18) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <AppointmentLinkView token={token} />
        </div>
      </div>
    </main>
  );
}
