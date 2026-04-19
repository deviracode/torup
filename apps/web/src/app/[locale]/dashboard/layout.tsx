import { AuthProvider } from "@/components/auth/auth-provider";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthGuard>
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto bg-background p-6">{children}</main>
        </div>
      </AuthGuard>
    </AuthProvider>
  );
}
