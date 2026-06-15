import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AgentBlueprint } from "@/types";
import Link from "next/link";
import { Plus, Bot } from "lucide-react";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { NewProjectButton } from "@/components/dashboard/NewProjectButton";
import { JoinWorkspaceModal } from "@/components/dashboard/JoinWorkspaceModal";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // 1. Check Authentication
  const session = await getServerSession(authOptions);
  
  // 2. Fetch User and their Blueprints
  let blueprints: AgentBlueprint[] = [];
  let currentUserId: string | null = null;
  
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (user) {
      currentUserId = user.id;
      blueprints = await prisma.agentBlueprint.findMany({
        where: {
          workspace: {
            OR: [
              { ownerId: user.id },
              {
                members: {
                  some: {
                    userId: user.id,
                    status: 'ACTIVE'
                  }
                }
              }
            ]
          },
          deletedAt: null
        },
        include: {
          workspace: {
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      }) as unknown as AgentBlueprint[];
    }
  } else {
    // Fallback for development without auth: fetch all blueprints
    blueprints = await prisma.agentBlueprint.findMany({
      where: {
        deletedAt: null
      },
      include: {
        workspace: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    }) as unknown as AgentBlueprint[];
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1">Manage your AI Agent workflows and blueprints.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <JoinWorkspaceModal />
            <NewProjectButton />
          </div>
        </div>
        
        {/* Projects Grid */}
        {blueprints.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-12 text-center flex flex-col items-center justify-center bg-card/50">
            <div className="bg-primary/10 text-primary p-4 rounded-full mb-4">
              <Bot className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              You haven't created any AI agent workflows yet. Create your first project to get started.
            </p>
            <NewProjectButton variant="card" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blueprints.map((bp) => (
              <ProjectCard key={bp.id} blueprint={bp} currentUserId={currentUserId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
