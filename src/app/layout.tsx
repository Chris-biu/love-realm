import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moonlit Residence MVP",
  description: "LLM-driven romance narrative MVP powered by DeepSeek",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
