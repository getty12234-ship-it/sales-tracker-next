import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sales Tracker",
  description: "営業チーム管理ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased dark">
      <body className="min-h-full bg-[#0a0f1e] text-slate-200">
        {children}
      </body>
    </html>
  );
}
