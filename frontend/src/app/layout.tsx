import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Nodebook OS - Enterprise ADK",
  description: "Advanced Agentic Workflow & Note-taking IDE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground flex h-screen overflow-hidden`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
