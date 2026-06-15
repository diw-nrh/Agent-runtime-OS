"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Loader2 } from "lucide-react";

interface JoinWorkspaceModalProps {
  className?: string;
}

export function JoinWorkspaceModal({ className = "" }: JoinWorkspaceModalProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId.trim()) return;

    setIsJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspaceId.trim() }),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        setShowModal(false);
        setWorkspaceId("");
        alert("Successfully joined workspace!");
        router.refresh();
      } else {
        setError(data.error || "Failed to join workspace. Please verify the Workspace ID.");
      }
    } catch (err) {
      console.error("Error joining workspace:", err);
      setError("An unexpected network error occurred.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => {
          setShowModal(true);
          setError(null);
          setWorkspaceId("");
        }}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-white/10 bg-white/5 hover:bg-white/10 text-foreground h-10 px-4 py-2 gap-2 ${className}`}
      >
        <Users className="w-4 h-4" />
        Join Workspace
      </button>

      {/* Join Workspace Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-lg border border-white/10 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4 text-foreground">Join Collaborative Workspace</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Enter a Workspace ID shared by an owner to gain collaborator access to their blueprints.
              </p>
              
              <form onSubmit={handleJoin}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-foreground">
                      Workspace ID <span className="text-destructive">*</span>
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={workspaceId}
                      onChange={e => setWorkspaceId(e.target.value)}
                      className="w-full border border-white/10 rounded-md px-3 py-2 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                      placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                      required
                    />
                  </div>

                  {error && (
                    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-md">
                      {error}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm border border-white/10 rounded-md hover:bg-muted text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isJoining || !workspaceId.trim()}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 font-semibold"
                  >
                    {isJoining ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      'Join Workspace'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
