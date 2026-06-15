import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBackendUrl() {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // If running under Nginx proxy (any port that is not Next.js 3000)
    if (port !== "3000") {
      const portSuffix = port ? `:${port}` : "";
      return `${protocol}//${hostname}${portSuffix}/api/backend`;
    }
    
    // Fallback for direct port 3000 development
    return `${protocol}//${hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
}
