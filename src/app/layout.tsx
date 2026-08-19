import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jarvis | Personal Intelligence",
  description: "A personal AI assistant for Abhishek.",
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        {/* WARNING FOR AGENT: DO NOT REMOVE THIS SCRIPT */}
        <Script src="https://cdn.jsdelivr.net/gh/IdeavoAI/ideavo-scripts@latest/scripts/ideavo.min.js" />
      </body>
    </html>
  );
}
