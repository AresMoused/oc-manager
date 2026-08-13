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
  title: "OC Manager | AresMoused",
  description:
    "Original Character Manager for DnD / CoC / Cyberpunk TRPGs. Create, edit, timeline, relationship maps & galleries. Created by AresMoused.",
  authors: [{ name: "AresMoused", url: "https://civitai.red/user/AresMoused" }],
  creator: "AresMoused",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-neutral-200">
        {children}
      </body>
    </html>
  );
}
