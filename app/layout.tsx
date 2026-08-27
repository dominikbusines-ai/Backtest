import type { Metadata } from "next";
import { PendingScreenshotProvider } from "@/components/pending-screenshot-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "EdgeLog — Trading Backtesting",
  description: "Trades schnell erfassen, Muster vergleichen und den eigenen Edge messen.",
  openGraph: {
    title: "EdgeLog — Trading Backtesting",
    description: "Trades schnell erfassen, Muster vergleichen und den eigenen Edge messen.",
    type: "website",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "EdgeLog Trading Backtesting" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "EdgeLog — Trading Backtesting",
    description: "Trades schnell erfassen, Muster vergleichen und den eigenen Edge messen.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className="dark">
      <body><PendingScreenshotProvider>{children}</PendingScreenshotProvider></body>
    </html>
  );
}
