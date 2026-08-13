import Decimal from "decimal.js";
import { getPrisma } from "./prisma";
import { HttpError } from "./http-error";
import { formatMoney } from "./money";

export interface ReportSummary {
  from: string;
  to: string;
  documentCount: number;
  sumSubtotal: string;
  sumTotalDiscount: string;
  sumTotalTax: string;
  sumGrandTotal: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(value: unknown, field: string): Date {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new HttpError(422, `${field} must be a date in YYYY-MM-DD format`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(422, `${field} is not a valid date`);
  }
  return date;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function endOfDayPlusOne(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

export async function summarizeReports(
  userId: string,
  fromRaw?: unknown,
  toRaw?: unknown,
): Promise<ReportSummary> {
  const to = parseDateParam(toRaw ?? todayIso(), "to");
  const from = parseDateParam(fromRaw ?? "1970-01-01", "from");
  if (to < from) {
    throw new HttpError(422, "to must be on or after from");
  }

  const where = {
    userId,
    issueDate: { gte: from, lt: endOfDayPlusOne(to) },
  };

  const agg = await getPrisma().document.aggregate({
    where,
    _count: { id: true },
    _sum: { subtotal: true, totalDiscount: true, totalTax: true, grandTotal: true },
  });

  const zero = new Decimal(0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    documentCount: agg._count.id,
    sumSubtotal: formatMoney(agg._sum.subtotal ?? zero),
    sumTotalDiscount: formatMoney(agg._sum.totalDiscount ?? zero),
    sumTotalTax: formatMoney(agg._sum.totalTax ?? zero),
    sumGrandTotal: formatMoney(agg._sum.grandTotal ?? zero),
  };
}