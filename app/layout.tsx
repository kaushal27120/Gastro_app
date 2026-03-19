import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "OneLink — Restaurant Management",
  description: "Professional restaurant management platform by OneLink",
};

const inter = Inter({
  variable: "--font-inter",
  display: "swap",
  subsets: ["latin", "latin-ext"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-[#F7F8FA] text-[#111827]`}>
        {children}
      </body>
    </html>
  );
}
