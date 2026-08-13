import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculateDocument,
  calculateLine,
  formatDocumentTotals,
  formatLineTotals,
  ValidationError,
  type LineInput,
} from "./calculations";
import { formatMoney, round2 } from "./money";

function line(overrides: Partial<LineInput> = {}): LineInput {
  return {
    description: "Item",
    quantity: 1,
    unitPrice: 100,
    discountType: "NONE",
    discountValue: 0,
    taxPercent: 0,
    ...overrides,
  };
}

const EXPECTED_LINE_A: LineInput = {
  description: "Widget A",
  quantity: 2,
  unitPrice: 100,
  discountType: "PERCENT",
  discountValue: 10,
  taxPercent: 5,
};

const EXPECTED_LINE_B: LineInput = {
  description: "Widget B",
  quantity: 2,
  unitPrice: 25,
  discountType: "NONE",
  discountValue: 0,
  taxPercent: 5,
};

const EXPECTED_LINE_C: LineInput = {
  description: "Widget C",
  quantity: 2,
  unitPrice: 100,
  discountType: "FIXED",
  discountValue: 20,
  taxPercent: 0,
};

describe("round2 (ROUND_HALF_UP)", () => {
  it("rounds half away from zero", () => {
    expect(formatMoney(round2(1.005))).toBe("1.01");
    expect(formatMoney(round2(0.005))).toBe("0.01");
    expect(formatMoney(round2(-1.005))).toBe("-1.01");
  });

  it("rounds fractional cents", () => {
    expect(formatMoney(round2(33.333))).toBe("33.33");
    expect(formatMoney(round2(33.336))).toBe("33.34");
  });

  it("keeps integer money untouched", () => {
    expect(formatMoney(round2(189))).toBe("189.00");
  });
});

describe("calculateLine — exact assignment sample", () => {
  it("line A: 2 x 100, 10% discount, 5% tax -> lineTotal 189.00", () => {
    const t = calculateLine(EXPECTED_LINE_A);
    expect(formatLineTotals(t)).toEqual({
      subtotal: "200.00",
      discountAmount: "20.00",
      discountedAmount: "180.00",
      taxAmount: "9.00",
      lineTotal: "189.00",
    });
  });

  it("line B: 2 x 25, no discount, 5% tax -> lineTotal 52.50", () => {
    const t = calculateLine(EXPECTED_LINE_B);
    expect(formatLineTotals(t)).toEqual({
      subtotal: "50.00",
      discountAmount: "0.00",
      discountedAmount: "50.00",
      taxAmount: "2.50",
      lineTotal: "52.50",
    });
  });

  it("line C: 2 x 100, fixed 20 discount, no tax -> lineTotal 180.00", () => {
    const t = calculateLine(EXPECTED_LINE_C);
    expect(formatLineTotals(t)).toEqual({
      subtotal: "200.00",
      discountAmount: "20.00",
      discountedAmount: "180.00",
      taxAmount: "0.00",
      lineTotal: "180.00",
    });
  });
});

describe("calculateDocument — exact assignment sample", () => {
  it("three sample lines -> subtotal 450.00 / discount 40.00 / tax 11.50 / grand total 421.50", () => {
    const t = calculateDocument([EXPECTED_LINE_A, EXPECTED_LINE_B, EXPECTED_LINE_C]);
    expect(formatDocumentTotals(t)).toEqual({
      subtotal: "450.00",
      totalDiscount: "40.00",
      totalTax: "11.50",
      grandTotal: "421.50",
    });
  });

  it("grand total equals the sum of line totals", () => {
    const lines = [EXPECTED_LINE_A, EXPECTED_LINE_B, EXPECTED_LINE_C];
    const doc = calculateDocument(lines);
    const sumLineTotals = lines.reduce((acc, l) => acc.add(calculateLine(l).lineTotal), new Decimal(0));
    expect(formatMoney(doc.grandTotal)).toBe(formatMoney(round2(sumLineTotals)));
  });
});

describe("calculateLine — basic coverage", () => {
  it("no discount, no tax", () => {
    const t = calculateLine(line({ quantity: 4, unitPrice: 250 }));
    expect(formatLineTotals(t)).toEqual({
      subtotal: "1000.00",
      discountAmount: "0.00",
      discountedAmount: "1000.00",
      taxAmount: "0.00",
      lineTotal: "1000.00",
    });
  });

  it("percent discount applies before tax (tax on discounted amount)", () => {
    const t = calculateLine(line({ quantity: 1, unitPrice: 200, discountType: "PERCENT", discountValue: 25, taxPercent: 10 }));
    expect(formatLineTotals(t)).toEqual({
      subtotal: "200.00",
      discountAmount: "50.00",
      discountedAmount: "150.00",
      taxAmount: "15.00",
      lineTotal: "165.00",
    });
  });

  it("fixed discount", () => {
    const t = calculateLine(line({ quantity: 2, unitPrice: 100, discountType: "FIXED", discountValue: 50, taxPercent: 20 }));
    expect(formatLineTotals(t)).toEqual({
      subtotal: "200.00",
      discountAmount: "50.00",
      discountedAmount: "150.00",
      taxAmount: "30.00",
      lineTotal: "180.00",
    });
  });

  it("100% percent discount zeroes out the line", () => {
    const t = calculateLine(line({ quantity: 3, unitPrice: 50, discountType: "PERCENT", discountValue: 100, taxPercent: 7 }));
    expect(formatLineTotals(t)).toEqual({
      subtotal: "150.00",
      discountAmount: "150.00",
      discountedAmount: "0.00",
      taxAmount: "0.00",
      lineTotal: "0.00",
    });
  });

  it("zero unit price yields zero line", () => {
    const t = calculateLine(line({ quantity: 5, unitPrice: 0, discountType: "FIXED", discountValue: 0, taxPercent: 5 }));
    expect(formatLineTotals(t)).toEqual({
      subtotal: "0.00",
      discountAmount: "0.00",
      discountedAmount: "0.00",
      taxAmount: "0.00",
      lineTotal: "0.00",
    });
  });
});

describe("validateLine — rejections", () => {
  const rejects = (overrides: Partial<LineInput>, message: string) => {
    expect(() => calculateLine(line(overrides))).toThrow(new ValidationError(message));
  };

  it("negative quantity", () => rejects({ quantity: -1 }, "quantity must be at least 1"));
  it("zero quantity", () => rejects({ quantity: 0 }, "quantity must be at least 1"));
  it("negative unit price", () => rejects({ unitPrice: -0.01 }, "unit price must be >= 0"));
  it("negative tax percent", () => rejects({ taxPercent: -1 }, "tax percent must be between 0 and 100"));
  it("tax percent above 100", () => rejects({ taxPercent: 100.01 }, "tax percent must be between 0 and 100"));
  it("discount percent below 0", () => rejects({ discountType: "PERCENT", discountValue: -5 }, "discount percent must be between 0 and 100"));
  it("discount percent above 100", () => rejects({ discountType: "PERCENT", discountValue: 101 }, "discount percent must be between 0 and 100"));
  it("invalid discount type (would allow both/none)", () => rejects({ discountType: "FOO" as never }, "invalid discount type"));
  it("negative fixed discount", () => rejects({ discountType: "FIXED", discountValue: -1 }, "fixed discount must be >= 0"));
  it("fixed discount exceeding subtotal", () => rejects({ discountType: "FIXED", discountValue: 100.01 }, "fixed discount cannot exceed the line subtotal"));
});

describe("calculateDocument — edge cases", () => {
  it("empty document returns zeros", () => {
    expect(formatDocumentTotals(calculateDocument([]))).toEqual({
      subtotal: "0.00",
      totalDiscount: "0.00",
      totalTax: "0.00",
      grandTotal: "0.00",
    });
  });

  it("accumulates many small lines without drift", () => {
    const small = line({ unitPrice: 0.01, taxPercent: 0 });
    const doc = calculateDocument(Array.from({ length: 1000 }, () => small));
    expect(formatDocumentTotals(doc).grandTotal).toBe("10.00");
  });
});