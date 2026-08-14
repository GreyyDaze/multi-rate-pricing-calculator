import type { Metadata } from "next";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://multi-rate-pricing-calculator.vercel.app"),
  title: {
    default: "QuoteCalc — Quotes & invoices with exact totals",
    template: "%s | QuoteCalc",
  },
  description:
    "Draft, edit, duplicate and finalize quotes and invoices with totals that are always exact to the cent. Per-line discounts and tax applied correctly, immutable finalized documents, and date-range reports.",
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "QuoteCalc — Quotes & invoices with exact totals",
    description:
      "Quotes and invoices with money math that is exact to the cent, immutable finalization, and per-user date-range reports.",
    siteName: "QuoteCalc",
  },
  keywords: [
    "quote calculator",
    "invoice generation",
    "exact totals",
    "pricing calculator",
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full overflow-x-clip antialiased">
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}