"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";

interface NewProjectButtonProps {
  className?: string;
  variant?: "default" | "outline" | "card";
}

export function NewProjectButton({ className = "", variant = "default" }: NewProjectButtonProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        setShowModal(false);
        router.push(`/project/${data.blueprint.id}`);
      } else {
        console.error("Failed to create project:", data.error);
        setIsCreating(false);
      }
    } catch (err) {
      console.error("Error creating project:", err);
      setIsCreating(false);
    }
  };

  // Different trigger styles based on where the button is placed
  let TriggerButton;
  
  if (variant === "card") {
    TriggerButton = (
      <button 
        onClick={() => setShowModal(true)}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2 ${className}`}
      >
        <Plus className="w-4 h-4" />
        Create Project
      </button>
    );
  } else {
    TriggerButton = (
      <button 
        onClick={() => setShowModal(true)}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2 ${className}`}
      >
        <Plus className="w-4 h-4" />
        New Project
      </button>
    );
  }

  return (
    <>
      {TriggerButton}

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-lg border overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Create New Project</h2>
              <form onSubmit={handleCreate}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g. Sales Agent Workflow"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
                      placeholder="Optional description..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !name.trim()}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Project'
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
