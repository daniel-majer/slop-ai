import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { env } from "@/env";

import { Providers } from "./providers";

import "./globals.css";

// If you replace these fonts, keep the variables in globals.css aligned.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Makes relative URLs in Open Graph and canonical tags absolute.
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: "slop-ai",
    template: "%s | slop-ai",
  },
  description:
    "Describe a web app in plain language and watch it get built, previewed and shipped.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
