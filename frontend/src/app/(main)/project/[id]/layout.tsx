import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Bot, ArrowLeft } from "lucide-react";
import { ProjectNavTabs } from "@/components/layout/ProjectNavTabs";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { id } = await params;

  // Fetch project details for the header
  const blueprint = await prisma.agentBlueprint.findUnique({
    where: { id },
    select: { name: true }
  });

  const projectName = blueprint?.name || "Unknown Project";

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Project Top Navigation Bar */}
      <header className="h-14 border-b glass-panel flex items-center px-4 justify-between shrink-0 z-20 sticky top-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-md hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 border-r pr-4 mr-2">
            <div className="bg-primary/10 text-primary p-1.5 rounded-md">
              <Bot className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm truncate max-w-[200px]">{projectName}</span>
          </div>

          {/* Navigation Tabs */}
          <ProjectNavTabs projectId={id} />
        </div>
      </header>

      {/* Project Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}
