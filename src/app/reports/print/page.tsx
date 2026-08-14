import { redirect } from "next/navigation";
import { summarizeReports } from "@/lib/reports";
import { currentUser } from "@/lib/current-user";
import { formatCurrency } from "@/lib/format";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { from, to } = await searchParams;

  let report;
  try {
    report = await summarizeReports(user.id, from, to);
  } catch {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="no-print mb-8 flex items-center justify-between gap-4">
          <a href="/reports" className="btn btn-text">
            Back to reports
          </a>
        </div>
        <p className="text-[0.9375rem] text-secondary">
          Could not generate this report. Make sure the dates are valid.
        </p>
      </div>
    );
  }

  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: "Documents", value: String(report.documentCount) },
    { label: "Subtotal", value: formatCurrency(report.sumSubtotal) },
    { label: "Discount", value: formatCurrency(report.sumTotalDiscount) },
    { label: "Tax", value: formatCurrency(report.sumTotalTax) },
    { label: "Grand total", value: formatCurrency(report.sumGrandTotal), strong: true },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="no-print mb-8 flex items-center justify-between gap-4">
        <a href="/reports" className="btn btn-text">
          Back to reports
        </a>
        <PrintButton />
      </div>

      <article className="print-sheet card p-8 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.01em]">Report</h1>
            <p className="mt-1 text-[0.9375rem] text-secondary">
              Totals across documents by issue date.
            </p>
          </div>
          <dl className="space-y-1 text-right text-[0.875rem]">
            <div>
              <dt className="sr-only">From</dt>
              <dd className="text-secondary">{report.from}</dd>
            </div>
            <div>
              <dt className="sr-only">To</dt>
              <dd className="text-secondary">{report.to}</dd>
            </div>
          </dl>
        </header>

        <dl className="mt-8 space-y-3 text-[0.9375rem]">
          {rows.map((row) => (
            <div
              key={row.label}
              className={`flex items-baseline justify-between gap-6 ${
                row.strong ? "border-t border-neutral pt-4 text-lg font-semibold" : ""
              }`}
            >
              <dt className="text-secondary">{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </article>
    </div>
  );
}