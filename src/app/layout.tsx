import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pixel Art Studio — Browser-based Pixel Art Editor",
  description:
    "Fast, crisp browser-based 2D pixel art editor with zero login required. Open, draw, enhance, and export.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-[#111318] text-zinc-100 antialiased selection:bg-amber-500/30">
        {children}
      </body>
    </html>
  );
}
