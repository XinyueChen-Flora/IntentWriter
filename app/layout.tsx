import type { Metadata } from "next";
import { Plus_Jakarta_Sans, DM_Serif_Display, Quicksand } from "next/font/google";
import "./globals.css";
import LinkifyWarningSuppress from "@/components/common/LinkifyWarningSuppress";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const dmSerif = DM_Serif_Display({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-brand",
});

export const metadata: Metadata = {
  title: "IntentWriter - Collaborative Writing with Intent Alignment",
  description:
    "Define your writing intentions upfront, then write collaboratively while staying aligned with your original goals. Real-time collaboration with drift detection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.className} ${dmSerif.variable} ${quicksand.variable}`} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <LinkifyWarningSuppress />
        {children}
      </body>
    </html>
  );
}
