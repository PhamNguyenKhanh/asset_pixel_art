import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yui Art Studio — Trình vẽ Pixel Art trên trình duyệt",
  description:
    "Công cụ vẽ và chỉnh sửa Pixel Art 2D sắc nét chạy trực tiếp trên trình duyệt, không cần đăng nhập.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="bg-[#111318] text-zinc-100 antialiased selection:bg-amber-500/30">
        {children}
      </body>
    </html>
  );
}
