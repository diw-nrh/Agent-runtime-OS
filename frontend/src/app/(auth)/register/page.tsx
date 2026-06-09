"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Registration failed");
      }

      router.push("/login");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Registration failed');
      } else {
        setError('Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-0"></div>
      
      <div className="relative z-10 w-full max-w-md p-8 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Join Nodebook OS</h1>
          <p className="text-sm text-gray-400">Create your enterprise account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-500/20 border border-red-500/50 text-red-200 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white placeholder-gray-500 transition-all"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white placeholder-gray-500 transition-all"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white placeholder-gray-500 transition-all"
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 mt-6 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-lg transition-all active:scale-95 disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : null}
            Register
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          Already have an account? <a href="/login" className="text-primary hover:underline">Sign In here</a>
        </div>
      </div>
    </div>
  );
}
