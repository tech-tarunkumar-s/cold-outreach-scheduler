import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReachInbox - Full-Stack Email Job Scheduler",
  description: "AI-Driven Cold Outreach & Reliable Scheduling with BullMQ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col font-sans bg-slate-900 text-slate-100">
        {children}
      </body>
    </html>
  );
}
