import { Calculator, CircleDollarSign, FileCheck2, Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const PREVIEW_LINES = [
  { desc: "Design system package", qty: "2 × $1,200", total: "$2,400" },
  { desc: "Brand guidelines", qty: "1 × $800", total: "$800" },
  { desc: "Ongoing support — monthly", qty: "1 × $450", total: "$450" },
];

const HIGHLIGHTS = [
  { icon: CircleDollarSign, label: "To-the-cent math" },
  { icon: Lock, label: "Immutable finalize" },
  { icon: FileCheck2, label: "Any status, anytime" },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-1 items-center justify-center gap-16 bg-tertiary/60 px-6 py-10 lg:pr-16 lg:pl-6">
      <aside className="relative hidden h-full flex-1 overflow-hidden rounded-3xl bg-primary text-white lg:block">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(1100px 600px at 15% -10%, rgba(255,255,255,0.14), transparent 60%),
              radial-gradient(900px 500px at 110% 115%, rgba(255,255,255,0.08), transparent 60%)`,
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden="true"
        />

        <div className="relative flex h-full flex-col px-14 py-12">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            title="QuoteCalc"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
              <Calculator className="h-4.5 w-4.5 text-white" aria-hidden="true" />
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.01em]">QuoteCalc</span>
          </Link>

          <div className="mt-14">
            <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-[-0.01em]">
              Every number you can trust.
            </h2>
            <p className="mt-4 max-w-md text-[1.0625rem] leading-relaxed text-white/70">
              Quotes and invoices whose totals are always right to the cent —
              discounts and tax applied correctly, nothing lost in rounding,
              and final numbers locked in when you finalize.
            </p>
          </div>

          <div className="mt-12 grid max-w-xl grid-cols-3 gap-4">
            {HIGHLIGHTS.map((h) => (
              <div key={h.label} className="rounded-xl bg-white/[0.08] px-5 py-5">
                <h.icon className="h-5 w-5 text-white/80" aria-hidden="true" />
                <p className="mt-3 text-[0.8125rem] font-medium text-white/60">{h.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 max-w-md min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-[0.9375rem] font-semibold">Acme Studio — Invoice</p>
              <span className="chip shrink-0 bg-white/15 text-white">Finalized</span>
            </div>
            <ul className="mt-5 space-y-3.5">
              {PREVIEW_LINES.map((line) => (
                <li key={line.desc} className="flex items-baseline justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[0.875rem] text-white/90">{line.desc}</p>
                    <p className="mt-0.5 text-[0.75rem] text-white/45">{line.qty}</p>
                  </div>
                  <span className="shrink-0 text-[0.875rem] font-medium">{line.total}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-baseline justify-between border-t border-white/10 pt-4">
              <span className="text-[0.8125rem] text-white/50">Grand total</span>
              <span className="text-[1.0625rem] font-semibold">$3,650.00</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="w-full max-w-md shrink-0">
        <Link
          href="/"
          className="mb-10 flex items-center gap-2.5 lg:hidden"
          title="QuoteCalc"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
            <Calculator className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <span className="text-[17px] font-semibold tracking-[-0.01em] text-primary">QuoteCalc</span>
        </Link>
        <div className="card px-8 py-10 sm:px-10">{children}</div>
      </main>
    </div>
  );
}