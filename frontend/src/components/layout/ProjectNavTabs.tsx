"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Network, BookOpen, TerminalSquare, Settings } from "lucide-react";

export function ProjectNavTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname() || "";

  // Helper to determine if a tab is active
  // - Settings: /project/[id]/settings
  // - Playground: /project/[id]/playground
  // - Note: /project/[id]/notebook
  // - Canvas: exactly /project/[id]
  const isActive = (path: string) => {
    if (path === `/project/${projectId}`) {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  const getTabClass = (path: string) => {
    const active = isActive(path);
    return `flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
      active
        ? "bg-muted text-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;
  };

  return (
    <nav className="flex items-center gap-1">
      <Link 
        href={`/project/${projectId}`} 
        className={getTabClass(`/project/${projectId}`)}
      >
        <Network className="w-4 h-4" />
        Canvas
      </Link>
      <Link 
        href={`/project/${projectId}/notebook`} 
        className={getTabClass(`/project/${projectId}/notebook`)}
      >
        <BookOpen className="w-4 h-4" />
        Agent Note
      </Link>
      <Link 
        href={`/project/${projectId}/playground`} 
        className={getTabClass(`/project/${projectId}/playground`)}
      >
        <TerminalSquare className="w-4 h-4" />
        Playground
      </Link>
      <div className="w-px h-6 bg-border mx-1"></div>
      <Link 
        href={`/project/${projectId}/settings`} 
        className={getTabClass(`/project/${projectId}/settings`)}
      >
        <Settings className="w-4 h-4" />
        AI Connections
      </Link>
    </nav>
  );
}
