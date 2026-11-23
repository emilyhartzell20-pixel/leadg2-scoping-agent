import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadG2 Scoping Agent",
  description: "Interactive solutions consultant for scoping LeadG2 client proposals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-white font-sans text-navy antialiased">{children}</body>
    </html>
  );
}
