import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARJARNTON | ระบบสอบออนไลน์",
  description: "Hybrid Online & Onsite Learning Management System with a secure exam engine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&family=IBM+Plex+Sans+Thai+Looped:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Kanit:ital,wght@1,800;1,900&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface font-sans text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen">
        {children}
      </body>
    </html>
  );
}
