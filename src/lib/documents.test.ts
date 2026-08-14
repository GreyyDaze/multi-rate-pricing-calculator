import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { getPrisma } from "./prisma";
import { HttpError } from "./http-error";
import {
  addLine,
  createDocument,
  deleteDocument,
  deleteLine,
  duplicateDocument,
  finalizeDocument,
  getDocument,
  listDocuments,
  parseIssueDate,
  parseLineInput,
  parseLinePatch,
  updateDocumentMeta,
  updateLine,
  type RawLineInput,
} from "./documents";

const prisma = getPrisma();

const EMAIL_A = "alice@example.com";
const EMAIL_B = "bob@example.com";

async function makeUser(email: string) {
  return prisma.user.create({ data: { email, passwordHash: "x" } });
}

async function expectHttpError(promise: Promise<unknown>, status: number, message: string) {
  await expect(promise).rejects.toMatchObject({ status, message });
}

const SAMPLE_LINE_A: RawLineInput = {
  description: "Widget A",
  quantity: 2,
  unitPrice: 100,
  discountType: "PERCENT",
  discountValue: 10,
  taxPercent: 5,
};

const SAMPLE_LINE_B: RawLineInput = {
  description: "Widget B",
  quantity: 2,
  unitPrice: 25,
  discountType: "NONE",
  discountValue: 0,
  taxPercent: 5,
};

const SAMPLE_LINE_C: RawLineInput = {
  description: "Widget C",
  quantity: 2,
  unitPrice: 100,
  discountType: "FIXED",
  discountValue: 20,
  taxPercent: 0,
};

const SAMPLE = [SAMPLE_LINE_A, SAMPLE_LINE_B, SAMPLE_LINE_C];

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterEach(async () => {
  await prisma.user.deleteMany();
});

describe("createDocument", () => {
  it("creates a draft with zero totals", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice #1", customer: "Acme" });
    expect(doc.title).toBe("Invoice #1");
    expect(doc.customer).toBe("Acme");
    expect(doc.status).toBe("DRAFT");
    expect(doc.grandTotal).toBe("0.00");
  });

  it("rejects missing title/customer", async () => {
    const user = await makeUser(EMAIL_A);
    await expectHttpError(createDocument(user.id, { customer: "Acme" }), 422, "title is required");
    await expectHttpError(createDocument(user.id, { title: "T" }), 422, "customer is required");
  });

  it("rejects an invalid issueDate", async () => {
    const user = await makeUser(EMAIL_A);
    await expectHttpError(
      createDocument(user.id, { title: "T", customer: "C", issueDate: "not-a-date" }),
      422,
      "issueDate must be a valid date (YYYY-MM-DD)",
    );
    expect(() => parseIssueDate("not-a-date")).toThrow(HttpError);
  });
});

describe("lines and document totals (server-persisted math)", () => {
  it("adding the sample lines yields subtotal 450.00 / discount 40.00 / tax 11.50 / total 421.50", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice", customer: "Acme" });

    addLine(user.id, doc.id, parseLineInput(SAMPLE_LINE_A));
    const afterB = await addLine(user.id, doc.id, parseLineInput(SAMPLE_LINE_B));
    const afterC = await addLine(user.id, doc.id, parseLineInput(SAMPLE_LINE_C));

    expect(afterB.document.subtotal).toBe("250.00");
    expect(afterC.document).toMatchObject({
      subtotal: "450.00",
      totalDiscount: "40.00",
      totalTax: "11.50",
      grandTotal: "421.50",
    });
    expect(afterC.line.lineTotal).toBe("180.00");
  });

  it("client cannot influence totals — they come from the calc module", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice", customer: "Acme" });

    const result = await addLine(user.id, doc.id, parseLineInput(SAMPLE_LINE_A));
    const stored = await prisma.document.findUnique({ where: { id: doc.id } });

    expect(result.document.grandTotal).toBe("189.00");
    expect(stored?.grandTotal.toString()).toBe("189");
    expect(result.line).toMatchObject({ lineTotal: "189.00", taxAmount: "9.00" });
  });

  it("updating a line recomputes document totals", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice", customer: "Acme" });
    const created = await addLine(user.id, doc.id, parseLineInput(SAMPLE_LINE_A));

    const result = await updateLine(
      user.id,
      doc.id,
      created.line.id,
      parseLinePatch({ quantity: 4, unitPrice: 50, discountType: "NONE", discountValue: 0, taxPercent: 0 }),
    );

    expect(result.line.lineTotal).toBe("200.00");
    expect(result.document.grandTotal).toBe("200.00");
  });

  it("deleting a line recomputes document totals", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice", customer: "Acme" });
    const a = await addLine(user.id, doc.id, parseLineInput(SAMPLE_LINE_A));
    await addLine(user.id, doc.id, parseLineInput(SAMPLE_LINE_B));

    const afterDelete = await deleteLine(user.id, doc.id, a.line.id);
    expect(afterDelete.document.grandTotal).toBe("52.50");
    expect(afterDelete.document.subtotal).toBe("50.00");
  });

  it("rejects a line whose fixed discount exceeds the subtotal (422)", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice", customer: "Acme" });
    await expectHttpError(
      addLine(user.id, doc.id, parseLineInput({ ...SAMPLE_LINE_A, quantity: 1, unitPrice: 1, discountType: "FIXED", discountValue: 2 })),
      422,
      "fixed discount cannot exceed the line subtotal",
    );
  });

  it("rejects a line with quantity below 1 (422)", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice", customer: "Acme" });
    await expectHttpError(
      addLine(user.id, doc.id, parseLineInput({ ...SAMPLE_LINE_A, quantity: 0 })),
      422,
      "quantity must be at least 1",
    );
  });

  it("rejects an unknown discountType (422)", async () => {
    expect(() => parseLineInput({ ...SAMPLE_LINE_A, discountType: "BOTH" })).toThrow(
      new HttpError(422, "discountType must be one of NONE, PERCENT, FIXED"),
    );
  });
});

describe("ownership and listing", () => {
  it("get returns only own documents; other users see 404", async () => {
    const userA = await makeUser(EMAIL_A);
    const userB = await makeUser(EMAIL_B);
    const doc = await createDocument(userA.id, { title: "A's", customer: "Acme" });

    expect((await getDocument(userA.id, doc.id)).id).toBe(doc.id);
    await expectHttpError(getDocument(userB.id, doc.id), 404, "Document not found");
    await expectHttpError(getDocument(userB.id, "does-not-exist"), 404, "Document not found");
  });

  it("list returns only the caller's documents", async () => {
    const userA = await makeUser(EMAIL_A);
    const userB = await makeUser(EMAIL_B);
    await createDocument(userA.id, { title: "A #1", customer: "Acme" });
    await createDocument(userA.id, { title: "A #2", customer: "Acme" });
    await createDocument(userB.id, { title: "B #1", customer: "Acme" });

    const docs = await listDocuments(userA.id);
    expect(docs.map((d) => d.title).sort()).toEqual(["A #1", "A #2"]);
  });

  it("cannot mutate another user's document (404)", async () => {
    const userA = await makeUser(EMAIL_A);
    const userB = await makeUser(EMAIL_B);
    const doc = await createDocument(userA.id, { title: "A's", customer: "Acme" });

    await expectHttpError(deleteDocument(userB.id, doc.id), 404, "Document not found");
    await expectHttpError(
      updateDocumentMeta(userB.id, doc.id, { title: "hacked" }),
      404,
      "Document not found",
    );
  });
});

describe("duplicateDocument", () => {
  it("copies a finalized document into a new draft with the same lines and totals", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice #7", customer: "Acme" });
    for (const raw of SAMPLE) {
      await addLine(user.id, doc.id, parseLineInput(raw));
    }
    await finalizeDocument(user.id, doc.id);

    const copy = await duplicateDocument(user.id, doc.id);
    expect(copy.id).not.toBe(doc.id);
    expect(copy.status).toBe("DRAFT");
    expect(copy.title).toBe("Invoice #7 (copy)");
    expect(copy.customer).toBe("Acme");
    expect(copy.grandTotal).toBe("421.50");
    expect(copy.lines?.length).toBe(3);
    expect(copy.lines?.map((l) => l.description).sort()).toEqual([
      "Widget A",
      "Widget B",
      "Widget C",
    ]);

    const original = await getDocument(user.id, doc.id);
    expect(copy.lines?.map((l) => l.lineTotal).sort()).toEqual(
      original.lines?.map((l) => l.lineTotal).sort(),
    );
    expect(copy.lines?.find((l) => l.description === "Widget A")).toMatchObject({
      quantity: "2.00",
      unitPrice: "100.00",
      discountType: "PERCENT",
      discountValue: "10.00",
      taxPercent: "5.00",
      lineTotal: "189.00",
    });
  });

  it("duplicating a draft works too", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Draft", customer: "Acme" });
    const copy = await duplicateDocument(user.id, doc.id);
    expect(copy.status).toBe("DRAFT");
    expect(copy.title).toBe("Draft (copy)");
    expect(copy.lines).toEqual([]);
  });

  it("cannot duplicate another user's document (404)", async () => {
    const userA = await makeUser(EMAIL_A);
    const userB = await makeUser(EMAIL_B);
    const doc = await createDocument(userA.id, { title: "A's", customer: "Acme" });
    await expectHttpError(duplicateDocument(userB.id, doc.id), 404, "Document not found");
  });
});

describe("lifecycle: draft vs finalized", () => {
  it("a draft is fully editable and deletable", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice", customer: "Acme" });

    const line = await addLine(user.id, doc.id, parseLineInput(SAMPLE_LINE_A));

    const updated = await updateDocumentMeta(user.id, doc.id, { title: "Renamed", customer: "NewCo" });
    expect(updated.title).toBe("Renamed");

    await updateLine(user.id, doc.id, line.line.id, parseLinePatch({ taxPercent: 0 }));
    await deleteDocument(user.id, doc.id);
    expect(await prisma.document.findUnique({ where: { id: doc.id } })).toBeNull();
  });

  it("finalize locks the document: all mutations return 409", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice", customer: "Acme" });
    await addLine(user.id, doc.id, parseLineInput(SAMPLE_LINE_A));

    const finalized = await finalizeDocument(user.id, doc.id);
    expect(finalized.status).toBe("FINALIZED");

    await expectHttpError(updateDocumentMeta(user.id, doc.id, { title: "X" }), 409, "Finalized documents cannot be modified.");
    await expectHttpError(deleteDocument(user.id, doc.id), 409, "Finalized documents cannot be modified.");
    await expectHttpError(addLine(user.id, doc.id, parseLineInput(SAMPLE_LINE_A)), 409, "Finalized documents cannot be modified.");
    await expectHttpError(finalizeDocument(user.id, doc.id), 409, "Finalized documents cannot be modified.");
  });

  it("line-level mutations on a finalized document return 409", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice", customer: "Acme" });
    const line = await addLine(user.id, doc.id, parseLineInput(SAMPLE_LINE_A));
    await finalizeDocument(user.id, doc.id);

    await expectHttpError(updateLine(user.id, doc.id, line.line.id, parseLinePatch({ quantity: 5 })), 409, "Finalized documents cannot be modified.");
    await expectHttpError(deleteLine(user.id, doc.id, line.line.id), 409, "Finalized documents cannot be modified.");
  });

  it("cannot finalize an empty document (422)", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice", customer: "Acme" });
    await expectHttpError(finalizeDocument(user.id, doc.id), 422, "A document must have at least one line to be finalized");
  });

  it("finalize re-validates stored lines and rejects invalid ones (422)", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await prisma.document.create({
      data: {
        userId: user.id,
        title: "Invoice",
        customer: "Acme",
        issueDate: new Date(),
        lines: {
          create: { description: "Broken", quantity: new Decimal(0), unitPrice: new Decimal(10) },
        },
      },
    });

    await expectHttpError(finalizeDocument(user.id, doc.id), 422, "quantity must be at least 1");
  });

  it("finalize persists the computed totals and matches the calc module", async () => {
    const user = await makeUser(EMAIL_A);
    const doc = await createDocument(user.id, { title: "Invoice", customer: "Acme" });
    for (const raw of SAMPLE) {
      await addLine(user.id, doc.id, parseLineInput(raw));
    }

    const finalized = await finalizeDocument(user.id, doc.id);
    expect(finalized).toMatchObject({
      status: "FINALIZED",
      subtotal: "450.00",
      totalDiscount: "40.00",
      totalTax: "11.50",
      grandTotal: "421.50",
    });

    const stored = await prisma.document.findUnique({ where: { id: doc.id } });
    expect(stored?.grandTotal.toString()).toBe("421.5");
  });
});