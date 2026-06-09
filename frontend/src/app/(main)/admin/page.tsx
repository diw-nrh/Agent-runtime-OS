"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Shield, ShieldAlert, ShieldCheck, User as UserIcon, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
    
    // Prevent self-demotion
    if (session?.user?.id === userId && newRole !== "ADMIN") {
      alert("You cannot demote yourself. Another Admin must do this.");
      return;
    }

    if (!confirm(`Change role to ${newRole}?`)) return;

    setUpdatingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newRole })
      });
      
      const data = await res.json();
      if (data.success) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      } else {
        alert(data.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Failed to update role", error);
    } finally {
      setUpdatingId(null);
    }
  };

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center">
        <ShieldAlert className="w-16 h-16 text-destructive mb-4 opacity-50" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You do not have permission to view the Admin Dashboard.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto w-full h-full bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          </div>
          <p className="text-muted-foreground mt-2 leading-relaxed max-w-2xl">
            Manage user accounts, assign roles, and configure system-wide settings.
            <br />
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md mt-2 inline-block">
              Currently logged in as Super Admin
            </span>
          </p>
        </div>

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b flex justify-between items-center bg-muted/20">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-muted-foreground" />
              User Management
            </h2>
            <div className="text-sm text-muted-foreground font-medium">
              Total Users: {users.length}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin mb-4 opacity-50" />
              Loading users...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 font-medium">User</th>
                    <th className="px-6 py-4 font-medium">Email</th>
                    <th className="px-6 py-4 font-medium">Joined</th>
                    <th className="px-6 py-4 font-medium">Role</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{user.name || "Unnamed User"}</div>
                        {session.user.id === user.id && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase mt-1 inline-block">You</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.role === "ADMIN" 
                            ? "bg-primary/15 text-primary border border-primary/20" 
                            : "bg-muted text-muted-foreground border border-border"
                        }`}>
                          {user.role === "ADMIN" ? <ShieldCheck className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => toggleRole(user.id, user.role)}
                          disabled={updatingId === user.id || session.user.id === user.id}
                          className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                            session.user.id === user.id
                              ? "opacity-30 cursor-not-allowed bg-muted"
                              : "hover:bg-muted bg-background border shadow-sm"
                          }`}
                        >
                          {updatingId === user.id ? "Updating..." : (user.role === "ADMIN" ? "Demote to User" : "Promote to Admin")}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
