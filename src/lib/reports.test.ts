import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPrisma } from "./prisma";
import { summarizeReports } from "./reports";

const prisma = getPrisma();

const EMAIL_A = "alice@example.com";
const EMAIL_B = "bob@example.com";

async function makeUser(email: string) {
  return prisma.user.create({ data: { email, passwordHash: "x" } });
}

async function seedDocument(userId: string, issueDate: string, totals: Record<string, string>) {
  await prisma.document.create({
    data: {
      userId,
      title: `Doc ${issueDate}`,
      customer: "Acme",
      issueDate: new Date(issueDate),
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      totalTax: totals.totalTax,
      grandTotal: totals.grandTotal,
    },
  });
}

const DOC_A = { subtotal: "200", totalDiscount: "20", totalTax: "9", grandTotal: "189" };
const DOC_B = { subtotal: "250", totalDiscount: "20", totalTax: "2.5", grandTotal: "232.5" };
const DOC_OUTSIDE = { subtotal: "100", totalDiscount: "0", totalTax: "0", grandTotal: "100" };

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterEach(async () => {
  await prisma.user.deleteMany();
});

describe("summarizeReports", () => {
  it("sums document totals for documents issued inside the inclusive range", async () => {
    const user = await makeUser(EMAIL_A);
    await seedDocument(user.id, "2026-08-01", DOC_A);
    await seedDocument(user.id, "2026-08-31", DOC_B);
    await seedDocument(user.id, "2026-07-31", DOC_OUTSIDE);
    await seedDocument(user.id, "2026-09-01", DOC_OUTSIDE);

    const report = await summarizeReports(user.id, "2026-08-01", "2026-08-31");
    expect(report).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
      documentCount: 2,
      sumSubtotal: "450.00",
      sumTotalDiscount: "40.00",
      sumTotalTax: "11.50",
      sumGrandTotal: "421.50",
    });
  });

  it("includes documents exactly on the from and to boundaries", async () => {
    const user = await makeUser(EMAIL_A);
    await seedDocument(user.id, "2026-08-01", DOC_A);
    await seedDocument(user.id, "2026-08-15", DOC_B);

    const report = await summarizeReports(user.id, "2026-08-15", "2026-08-15");
    expect(report.documentCount).toBe(1);
    expect(report.sumGrandTotal).toBe("232.50");

    const all = await summarizeReports(user.id, "2026-08-01", "2026-08-15");
    expect(all.documentCount).toBe(2);
  });

  it("only aggregates the caller's own documents", async () => {
    const userA = await makeUser(EMAIL_A);
    const userB = await makeUser(EMAIL_B);
    await seedDocument(userA.id, "2026-08-01", DOC_A);
    await seedDocument(userB.id, "2026-08-05", DOC_B);

    const report = await summarizeReports(userA.id, "2026-08-01", "2026-08-31");
    expect(report.documentCount).toBe(1);
    expect(report.sumGrandTotal).toBe("189.00");
  });

  it("returns zeros for an empty range", async () => {
    const user = await makeUser(EMAIL_A);
    await seedDocument(user.id, "2026-07-01", DOC_A);

    const report = await summarizeReports(user.id, "2026-08-01", "2026-08-31");
    expect(report).toMatchObject({
      documentCount: 0,
      sumSubtotal: "0.00",
      sumTotalDiscount: "0.00",
      sumTotalTax: "0.00",
      sumGrandTotal: "0.00",
    });
  });

  it("defaults to: everything up to today when no params are given", async () => {
    const user = await makeUser(EMAIL_A);
    await seedDocument(user.id, "2020-01-01", DOC_A);

    const report = await summarizeReports(user.id);
    expect(report.documentCount).toBe(1);
    expect(report.sumGrandTotal).toBe("189.00");
  });

  it("rejects an invalid date (422)", async () => {
    const user = await makeUser(EMAIL_A);
    await expect(summarizeReports(user.id, "2026-13-99", "2026-08-31")).rejects.toMatchObject({
      status: 422,
      message: "from is not a valid date",
    });
    await expect(summarizeReports(user.id, "not-a-date", "2026-08-31")).rejects.toMatchObject({
      status: 422,
      message: "from must be a date in YYYY-MM-DD format",
    });
  });

  it("rejects a range where to is before from (422)", async () => {
    const user = await makeUser(EMAIL_A);
    await expect(summarizeReports(user.id, "2026-08-31", "2026-08-01")).rejects.toMatchObject({
      status: 422,
      message: "to must be on or after from",
    });
  });
});