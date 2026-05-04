import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AZISTO",
  description: "A Canadian service marketplace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-white text-slate-950 antialiased">
        {children}
      </body>
    </html>
  );
}
