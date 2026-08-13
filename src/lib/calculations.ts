import Decimal from "decimal.js";
import { formatMoney, round2, toDecimal } from "./money";

export type DiscountType = "NONE" | "PERCENT" | "FIXED";

export interface LineInput {
  description: string;
  quantity: Decimal.Value | Decimal;
  unitPrice: Decimal.Value | Decimal;
  discountType: DiscountType;
  discountValue: Decimal.Value | Decimal;
  taxPercent: Decimal.Value | Decimal;
}

export interface LineTotals {
  subtotal: Decimal;
  discountAmount: Decimal;
  discountedAmount: Decimal;
  taxAmount: Decimal;
  lineTotal: Decimal;
}

export interface DocumentTotals {
  subtotal: Decimal;
  totalDiscount: Decimal;
  totalTax: Decimal;
  grandTotal: Decimal;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const DISCOUNT_TYPES: readonly DiscountType[] = ["NONE", "PERCENT", "FIXED"];

export function validateLine(input: LineInput): void {
  const quantity = toDecimal(input.quantity);
  if (!quantity.isFinite() || quantity.lt(1)) {
    throw new ValidationError("quantity must be at least 1");
  }

  const unitPrice = toDecimal(input.unitPrice);
  if (!unitPrice.isFinite() || unitPrice.lt(0)) {
    throw new ValidationError("unit price must be >= 0");
  }

  const taxPercent = toDecimal(input.taxPercent);
  if (!taxPercent.isFinite() || taxPercent.lt(0) || taxPercent.gt(100)) {
    throw new ValidationError("tax percent must be between 0 and 100");
  }

  if (!DISCOUNT_TYPES.includes(input.discountType)) {
    throw new ValidationError("invalid discount type");
  }

  const discountValue = toDecimal(input.discountValue);
  if (input.discountType === "PERCENT") {
    if (!discountValue.isFinite() || discountValue.lt(0) || discountValue.gt(100)) {
      throw new ValidationError("discount percent must be between 0 and 100");
    }
  } else if (input.discountType === "FIXED") {
    if (!discountValue.isFinite() || discountValue.lt(0)) {
      throw new ValidationError("fixed discount must be >= 0");
    }
    const subtotal = quantity.mul(unitPrice);
    if (discountValue.gt(subtotal)) {
      throw new ValidationError("fixed discount cannot exceed the line subtotal");
    }
  }
}

export function calculateLine(input: LineInput): LineTotals {
  validateLine(input);

  const quantity = toDecimal(input.quantity);
  const unitPrice = toDecimal(input.unitPrice);
  const discountValue = toDecimal(input.discountValue);
  const taxPercent = toDecimal(input.taxPercent);

  const subtotal = round2(quantity.mul(unitPrice));

  let discountAmount = new Decimal(0);
  if (input.discountType === "PERCENT") {
    discountAmount = round2(subtotal.mul(discountValue).div(100));
  } else if (input.discountType === "FIXED") {
    discountAmount = round2(discountValue);
  }

  const discountedAmount = round2(subtotal.sub(discountAmount));
  const taxAmount = round2(discountedAmount.mul(taxPercent).div(100));
  const lineTotal = round2(discountedAmount.add(taxAmount));

  return { subtotal, discountAmount, discountedAmount, taxAmount, lineTotal };
}

export function calculateDocument(lines: LineInput[]): DocumentTotals {
  let subtotal = new Decimal(0);
  let totalDiscount = new Decimal(0);
  let totalTax = new Decimal(0);
  let grandTotal = new Decimal(0);

  for (const line of lines) {
    const totals = calculateLine(line);
    subtotal = subtotal.add(totals.subtotal);
    totalDiscount = totalDiscount.add(totals.discountAmount);
    totalTax = totalTax.add(totals.taxAmount);
    grandTotal = grandTotal.add(totals.lineTotal);
  }

  return {
    subtotal: round2(subtotal),
    totalDiscount: round2(totalDiscount),
    totalTax: round2(totalTax),
    grandTotal: round2(grandTotal),
  };
}

export function formatLineTotals(totals: LineTotals): Record<keyof LineTotals, string> {
  return {
    subtotal: formatMoney(totals.subtotal),
    discountAmount: formatMoney(totals.discountAmount),
    discountedAmount: formatMoney(totals.discountedAmount),
    taxAmount: formatMoney(totals.taxAmount),
    lineTotal: formatMoney(totals.lineTotal),
  };
}

export function formatDocumentTotals(totals: DocumentTotals): Record<keyof DocumentTotals, string> {
  return {
    subtotal: formatMoney(totals.subtotal),
    totalDiscount: formatMoney(totals.totalDiscount),
    totalTax: formatMoney(totals.totalTax),
    grandTotal: formatMoney(totals.grandTotal),
  };
}