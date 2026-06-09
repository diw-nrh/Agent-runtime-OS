import { Sidebar } from '@/components/layout/Sidebar';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-muted/5 relative">
        {children}
      </main>
    </>
  );
}
