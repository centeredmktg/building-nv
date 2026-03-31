import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Building NV | General Contractor | Reno, NV",
  description:
    "Building NV is a Reno, Nevada general contractor specializing in residential builds, remodels, and commercial tenant improvement. We show up, we do the work, we stand behind it.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${geistMono.variable}`}>
      <head>
        <script
          defer
          src="https://umami-production-9b943.up.railway.app/script.js"
          data-website-id="dce9c2df-07f1-4d9f-ba7b-cda861eeb739"
        />
      </head>
      <body className="font-sans bg-bg text-text-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
