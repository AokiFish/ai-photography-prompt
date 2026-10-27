import type { Metadata } from "next";
import "./globals.css";
import { Grain } from "@/components/Grain";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Toast } from "@/components/Toast";
import { AuthProvider } from "@/lib/auth-client";

export const metadata: Metadata = {
  title: {
    default: "AI 摄影提示词图鉴 · THE PROMPT PHOTOGRAPH",
    template: "%s · AI 摄影提示词图鉴",
  },
  description:
    "一册可以照着拍的 AI 摄影提示词。六种摄影语言，策展式画廊，复制即用。",
  metadataBase: new URL("https://prmpt.example.com"),
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='10' fill='%23141414'/%3E%3Ccircle cx='32' cy='32' r='16' fill='none' stroke='%23C89B4A' stroke-width='3'/%3E%3Ccircle cx='32' cy='32' r='5' fill='%23EDE7DA'/%3E%3C/svg%3E",
  },
  openGraph: {
    title: "AI 摄影提示词图鉴",
    description: "一册可以照着拍的 AI 摄影提示词。",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        {/* React 19 自动把这些资源标签提升到 <head> */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Space+Grotesk:wght@300..700&family=Space+Mono:ital,wght@0,400;0,700&display=swap"
          rel="stylesheet"
        />
        <AuthProvider>
          <Grain />
          <Nav />
          <main style={{ paddingTop: 64 }}>{children}</main>
          <Footer />
          <Toast />
        </AuthProvider>
      </body>
    </html>
  );
}
