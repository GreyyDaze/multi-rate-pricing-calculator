"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useToast } from "@/components/toast";
import { getReportSummary } from "@/lib/client";
import { oneMonthAgoIso, todayIso, formatCurrency } from "@/lib/format";
import { ApiError, type ReportSummary } from "@/lib/api";

export function ReportsPage({ email }: { email?: string }) {
  const toast = useToast();
  const [from, setFrom] = useState(oneMonthAgoIso());
  const [to, setTo] = useState(todayIso());
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true);
      try {
        const res = await getReportSummary(from, to);
        if (!cancelled) setReport(res.report);
      } catch (err) {
        if (!cancelled) {
          toast("error", err instanceof ApiError ? err.message : "Failed to load the report.");
          setReport(null);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [from, to, toast]);

  async function refresh() {
    setBusy(true);
    try {
      const res = await getReportSummary(from, to);
      setReport(res.report);
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Failed to load the report.");
      setReport(null);
    } finally {
      setBusy(false);
    }
  }

  const cards: { label: string; value: string; secondary?: string }[] = report
    ? [
        { label: "Documents", value: String(report.documentCount) },
        { label: "Grand total", value: formatCurrency(report.sumGrandTotal) },
        { label: "Tax", value: formatCurrency(report.sumTotalTax) },
        { label: "Discount", value: formatCurrency(report.sumTotalDiscount) },
      ]
    : [];

  return (
    <AppShell email={email}>
      <div className="mb-10">
        <h1 className="text-xl font-semibold tracking-[-0.01em] sm:text-2xl">Report</h1>
        <p className="mt-2 text-base text-secondary">
          Totals across finalized and draft documents by issue date.
        </p>
      </div>

      <form
        className="mb-10 flex flex-wrap items-end gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void refresh();
        }}
      >
        <div className="row">
          <label htmlFor="from" className="label">
            From
          </label>
          <input
            id="from"
            type="date"
            className="input w-52"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="row">
          <label htmlFor="to" className="label">
            To
          </label>
          <input
            id="to"
            type="date"
            className="input w-52"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          {busy ? "Loading…" : "Refresh"}
        </button>
      </form>

      {busy && !report ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-3 text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span className="text-[0.9375rem]">Loading report…</span>
        </div>
      ) : null}

      {report ? (
        <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {cards.map((card) => (
            <li key={card.label} className="card px-8 py-7">
              <p className="text-[0.8125rem] font-medium text-secondary">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold leading-8 tracking-[-0.01em]">{card.value}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </AppShell>
  );
}