import Link from "next/link";
import { redirect } from "next/navigation";
import { getDocument } from "@/lib/documents";
import { currentUser } from "@/lib/current-user";
import { formatCurrency, formatDate } from "@/lib/format";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function DocumentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  let document;
  try {
    document = await getDocument(user.id, id);
  } catch {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="no-print mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="btn btn-text">
            Back to documents
          </Link>
        </div>
        <div className="card px-8 py-16 text-center">
          <h1 className="text-xl font-semibold tracking-[-0.01em]">Couldn’t load this document</h1>
          <p className="mx-auto mt-2 max-w-sm text-[0.9375rem] text-secondary">
            It may have been deleted, or you don’t have access to it.
          </p>
        </div>
      </div>
    );
  }
  const lines = document.lines ?? [];

  const rows = [
    { label: "Subtotal", value: document.subtotal },
    { label: "Discount", value: document.totalDiscount },
    { label: "Tax", value: document.totalTax },
    { label: "Grand total", value: document.grandTotal, strong: true },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="no-print mb-8 flex items-center justify-between gap-4">
        <a href={`/documents/${document.id}`} className="btn btn-text">
          Back to document
        </a>
        <PrintButton />
      </div>

      <article className="print-sheet card p-8 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-neutral pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.01em]">{document.title}</h1>
            <p className="mt-1 text-[0.9375rem] text-secondary">{document.customer}</p>
          </div>
          <dl className="space-y-1 text-right text-[0.875rem]">
            <div>
              <dt className="sr-only">Issue date</dt>
              <dd className="text-secondary">{formatDate(document.issueDate)}</dd>
            </div>
            <div>
              <dt className="sr-only">Status</dt>
              <dd
                className={`inline-block rounded-full px-3 py-1 text-[0.75rem] font-medium ${
                  document.status === "FINALIZED"
                    ? "bg-[#e6f4ea] text-[#1e7a3c]"
                    : "bg-tertiary text-secondary"
                }`}
              >
                {document.status === "FINALIZED" ? "Finalized" : "Draft"}
              </dd>
            </div>
          </dl>
        </header>

        {lines.length === 0 ? (
          <p className="py-14 text-center text-[0.9375rem] text-secondary">
            No line items.
          </p>
        ) : (
          <table className="print-table mt-8 w-full border-collapse">
            <thead>
              <tr className="border-b border-neutral text-left text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-secondary">
                <th className="py-2.5 pr-4">Description</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Unit price</th>
                <th className="px-3 py-2.5 text-right">Discount</th>
                <th className="px-3 py-2.5 text-right">Tax %</th>
                <th className="py-2.5 pl-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-neutral">
                  <td className="py-3 pr-4 text-[0.9375rem]">{line.description}</td>
                  <td className="px-3 py-3 text-right text-[0.875rem]">
                    {formatCurrency(line.quantity)}
                  </td>
                  <td className="px-3 py-3 text-right text-[0.875rem]">
                    {formatCurrency(line.unitPrice)}
                  </td>
                  <td className="px-3 py-3 text-right text-[0.875rem]">
                    {line.discountType === "NONE"
                      ? "—"
                      : `${formatCurrency(line.discountValue)}${
                          line.discountType === "PERCENT" ? "%" : ""
                        }`}
                  </td>
                  <td className="px-3 py-3 text-right text-[0.875rem]">
                    {formatCurrency(line.taxPercent)}%
                  </td>
                  <td className="py-3 pl-4 text-right text-[0.9375rem] font-medium">
                    {formatCurrency(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <dl className="ml-auto mt-8 w-full max-w-xs space-y-3 text-[0.9375rem]">
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