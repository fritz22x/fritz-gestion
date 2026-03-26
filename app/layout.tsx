import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fritz Gestion",
  description: "Sistema personal para gestionar modulos, items y continuidad de trabajo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-slate-950 text-slate-50">{children}</body>
    </html>
  );
}
