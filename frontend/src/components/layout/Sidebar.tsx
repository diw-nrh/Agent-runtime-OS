"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();
  
  // Hide the sidebar on project workspace pages
  if (pathname?.includes('/project/')) {
    return null;
  }

  return (
    <aside className="w-64 border-r bg-muted/20 flex flex-col z-20 shrink-0">
      <div className="p-4 border-b font-bold text-lg tracking-tight">
        Nodebook OS
      </div>
      <nav className="flex-1 p-4 space-y-2 text-sm font-medium text-muted-foreground">
        <Link href="/" className="block p-2 rounded-md hover:bg-muted hover:text-foreground transition-colors">
          Dashboard
        </Link>
      </nav>
    </aside>
  );
}
