import Sidebar from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-60 min-h-screen">
        {children}
      </main>
    </div>
  );
}
