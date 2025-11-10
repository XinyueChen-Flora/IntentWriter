import type { Metadata } from "next";
import "./globals.css";
import LinkifyWarningSuppress from "@/components/common/LinkifyWarningSuppress";

export const metadata: Metadata = {
  title: "Intent Writer - Collaborative Writing with Intent Alignment",
  description: "Real-time collaborative writing platform with intent awareness",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <LinkifyWarningSuppress />
        {children}
      </body>
    </html>
  );
}
