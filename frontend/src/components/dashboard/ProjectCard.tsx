"use client";

import Link from "next/link";
import { Bot, Clock, MoreVertical, Trash2, Edit } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface ProjectCardProps {
  blueprint: {
    id: string;
    name?: string | null;
    description?: string | null;
    updatedAt: Date;
  };
}

export function ProjectCard({ blueprint }: ProjectCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  // Rename Modal State
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newName, setNewName] = useState(blueprint.name || "");
  const [newDescription, setNewDescription] = useState(blueprint.description || "");
  const [isRenaming, setIsRenaming] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); 
    setShowMenu(false);
    
    if (confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      setIsDeleting(true);
      try {
        const res = await fetch(`/api/blueprints/${blueprint.id}`, {
          method: 'DELETE'
        });
        
        if (res.ok) {
          router.refresh();
        } else {
          console.error("Failed to delete project");
          setIsDeleting(false);
        }
      } catch (err) {
        console.error("Error deleting:", err);
        setIsDeleting(false);
      }
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRenaming(true);
    try {
      const res = await fetch(`/api/blueprints/${blueprint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDescription })
      });
      if (res.ok) {
        setShowRenameModal(false);
        router.refresh();
      } else {
        console.error("Failed to rename project");
      }
    } catch (err) {
      console.error("Error renaming:", err);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <>
      <div className={`relative group h-full ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}>
        <Link href={`/project/${blueprint.id}`} className="block h-full">
          <div className="border rounded-xl p-6 bg-card text-card-foreground shadow-sm hover:shadow-md hover:border-primary/50 transition-all h-full flex flex-col relative overflow-hidden">
            {/* Decorative top border */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 to-primary/10 group-hover:from-primary group-hover:to-primary/50 transition-all"></div>
            
            <div className="flex justify-between items-start mb-4 mt-2">
              <div className="bg-primary/10 text-primary p-2.5 rounded-lg">
                <Bot className="w-5 h-5" />
              </div>
            </div>
            
            <h2 className="text-lg font-semibold mb-2 line-clamp-1 group-hover:text-primary transition-colors pr-8">
              {blueprint.name || "Untitled Project"}
            </h2>
            
            <p className="text-sm text-muted-foreground mb-6 line-clamp-2 flex-1">
              {blueprint.description || "A custom AI agent workflow blueprint."}
            </p>
            
            <div className="flex items-center text-xs text-muted-foreground pt-4 border-t mt-auto">
              <Clock className="w-3 h-3 mr-1.5" />
              Updated {new Date(blueprint.updatedAt).toLocaleDateString()}
            </div>
          </div>
        </Link>
        
        {/* Dropdown Menu Toggle */}
        <div className="absolute top-4 right-4 z-10">
          <button 
            onClick={(e) => {
              e.preventDefault();
              setShowMenu(!showMenu);
            }}
            onBlur={() => setTimeout(() => setShowMenu(false), 200)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          
          {/* Simple Dropdown Menu */}
          {showMenu && (
            <div className="absolute right-0 mt-1 w-36 bg-popover border shadow-md rounded-md overflow-hidden z-20">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setShowRenameModal(true);
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center gap-2 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Rename
              </button>
              <button
                onClick={handleDelete}
                className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-muted flex items-center gap-2 transition-colors border-t"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-lg border overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Edit Project</h2>
              <form onSubmit={handleRename}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Project Name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      value={newDescription}
                      onChange={e => setNewDescription(e.target.value)}
                      className="w-full border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
                      placeholder="Project Description..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowRenameModal(false)}
                    className="px-4 py-2 text-sm border rounded-md hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRenaming}
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isRenaming ? 'Saving...' : 'Save Changes'}
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
