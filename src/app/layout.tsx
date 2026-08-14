import type { Metadata } from "next";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuoteCalc",
  description: "Build, edit and finalize quotes with trusted server-computed totals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full overflow-x-clip antialiased">
      <body className="min-h-full flex flex-col overflow-x-clip">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}