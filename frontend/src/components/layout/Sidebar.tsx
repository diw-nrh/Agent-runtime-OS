"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { LogOut, User } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  
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
        <Link 
          href="/" 
          className={`block p-2 rounded-md transition-colors ${pathname === '/' ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted hover:text-foreground'}`}
        >
          Dashboard
        </Link>
        <Link 
          href="/tools" 
          className={`block p-2 rounded-md transition-colors ${pathname?.startsWith('/tools') ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted hover:text-foreground'}`}
        >
          MCP Tools
        </Link>
        
        {session?.user?.role === 'ADMIN' && (
          <div className="pt-4 mt-4 border-t">
            <div className="px-2 text-xs font-semibold text-muted-foreground/60 mb-2 uppercase tracking-wider">Super Admin</div>
            <Link 
              href="/admin" 
              className={`block p-2 rounded-md transition-colors ${pathname?.startsWith('/admin') ? 'bg-primary/10 text-primary font-semibold flex items-center gap-2' : 'hover:bg-muted hover:text-foreground flex items-center gap-2'}`}
            >
              Admin Panel
            </Link>
          </div>
        )}
      </nav>

      {session?.user && (
        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <User size={16} />
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">{session.user.name || 'User'}</span>
                <span className="text-[10px] text-muted-foreground truncate">{session.user.email}</span>
              </div>
            </div>
            <button 
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.href = '/login';
              }}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors shrink-0"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
