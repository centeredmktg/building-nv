import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Building NV | Commercial Tenant Improvement | Reno, NV",
  description:
    "Building NV specializes in commercial tenant improvement projects across Reno, Nevada. Office buildouts, retail spaces, medical, and more. Get a quote today.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans bg-bg text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
