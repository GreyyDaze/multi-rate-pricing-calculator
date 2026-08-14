"use client";

import { Calculator, FileText, Loader2, LogOut, PieChart } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export function AppShell({ children, email }: { children: ReactNode; email?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const nav = [
    { href: "/", label: "Documents", icon: FileText },
    { href: "/reports", label: "Reports", icon: PieChart },
  ];
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-full">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-56 flex-col border-r border-border bg-surface">
        <div className="border-b border-border px-5 py-5">
          <Link href="/" className="flex items-center gap-2.5" title="QuoteCalc">
            <Calculator className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-primary">QuoteCalc</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-secondary">
            Menu
          </p>
          {nav.map((item) => {
            const isActive = active(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9375rem] font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-white"
                    : "text-onsurface hover:bg-tertiary"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-3 py-4">
          {email ? (
            <p className="mb-2 truncate px-3 text-[0.8125rem] text-secondary" title={email}>
              {email}
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[0.9375rem] font-medium text-onsurface transition-colors hover:bg-tertiary ${
              signingOut
                ? "cursor-progress opacity-60"
                : "cursor-pointer hover:text-primary"
            }`}
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <main className="ml-56 min-w-0 flex-1 px-6 py-10 sm:px-12 sm:py-12">{children}</main>
    </div>
  );
}