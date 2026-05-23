import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Got Dirt? — Find Dirt Pits Near You",
  description:
    "Locate borrow pits and waste pits across Georgia. Built for contractors and trucking companies.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Got Dirt?" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16a34a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased bg-white text-gray-900`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
