import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "./prisma";
import { HttpError } from "./http-error";
import {
  calculateDocument,
  calculateLine,
  ValidationError,
  type DocumentTotals,
  type LineTotals,
} from "./calculations";
import { formatMoney } from "./money";
import type { DiscountType, DocumentView, LineView } from "./api";

export type { DiscountType, DocumentView, LineView };
export const DISCOUNT_TYPES: readonly DiscountType[] = ["NONE", "PERCENT", "FIXED"];

export interface RawLineInput {
  description?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  discountType?: unknown;
  discountValue?: unknown;
  taxPercent?: unknown;
}

export interface ResolvedLineInput {
  description: string;
  quantity: Decimal;
  unitPrice: Decimal;
  discountType: DiscountType;
  discountValue: Decimal;
  taxPercent: Decimal;
}

interface DocumentRecord {
  id: string;
  title: string;
  customer: string;
  issueDate: Date;
  status: "DRAFT" | "FINALIZED";
  subtotal: Decimal;
  totalDiscount: Decimal;
  totalTax: Decimal;
  grandTotal: Decimal;
  createdAt: Date;
  updatedAt: Date;
}

interface LineRecord {
  id: string;
  documentId: string;
  description: string;
  quantity: Decimal;
  unitPrice: Decimal;
  discountType: DiscountType;
  discountValue: Decimal;
  taxPercent: Decimal;
  subtotal: Decimal;
  discountAmount: Decimal;
  discountedAmount: Decimal;
  taxAmount: Decimal;
  lineTotal: Decimal;
}

const DOCUMENT_SELECT = {
  id: true,
  title: true,
  customer: true,
  issueDate: true,
  status: true,
  subtotal: true,
  totalDiscount: true,
  totalTax: true,
  grandTotal: true,
  createdAt: true,
  updatedAt: true,
} as const;

function serializeDocument(doc: DocumentRecord): DocumentView {
  return {
    id: doc.id,
    title: doc.title,
    customer: doc.customer,
    issueDate: doc.issueDate.toISOString(),
    status: doc.status,
    subtotal: formatMoney(doc.subtotal),
    totalDiscount: formatMoney(doc.totalDiscount),
    totalTax: formatMoney(doc.totalTax),
    grandTotal: formatMoney(doc.grandTotal),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function serializeLine(line: LineRecord): LineView {
  return {
    id: line.id,
    description: line.description,
    quantity: formatMoney(line.quantity),
    unitPrice: formatMoney(line.unitPrice),
    discountType: line.discountType,
    discountValue: formatMoney(line.discountValue),
    taxPercent: formatMoney(line.taxPercent),
    subtotal: formatMoney(line.subtotal),
    discountAmount: formatMoney(line.discountAmount),
    discountedAmount: formatMoney(line.discountedAmount),
    taxAmount: formatMoney(line.taxAmount),
    lineTotal: formatMoney(line.lineTotal),
  };
}

function toHttpError(error: unknown): never {
  if (error instanceof ValidationError) {
    throw new HttpError(422, error.message);
  }
  throw error;
}

async function getOwnedDocument(userId: string, documentId: string): Promise<DocumentRecord> {
  const document = await getPrisma().document.findFirst({
    where: { id: documentId, userId },
    select: DOCUMENT_SELECT,
  });
  if (!document) {
    throw new HttpError(404, "Document not found");
  }
  return document;
}

function assertDraft(document: { status: string }): void {
  if (document.status !== "DRAFT") {
    throw new HttpError(409, "Finalized documents cannot be modified.");
  }
}

function toDecimalInput(value: unknown, field: string): Decimal {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HttpError(422, `${field} must be a number`);
  }
  return new Decimal(value);
}

function toDiscountType(value: unknown): DiscountType {
  if (typeof value !== "string" || !(DISCOUNT_TYPES as readonly string[]).includes(value)) {
    throw new HttpError(422, "discountType must be one of NONE, PERCENT, FIXED");
  }
  return value as DiscountType;
}

export function parseLineInput(body: RawLineInput): ResolvedLineInput {
  if (typeof body.description !== "string" || body.description.trim() === "") {
    throw new HttpError(422, "description is required");
  }
  return {
    description: body.description.trim(),
    quantity: toDecimalInput(body.quantity, "quantity"),
    unitPrice: toDecimalInput(body.unitPrice, "unitPrice"),
    discountType: toDiscountType(body.discountType),
    discountValue: toDecimalInput(body.discountValue, "discountValue"),
    taxPercent: toDecimalInput(body.taxPercent, "taxPercent"),
  };
}

export function parseLinePatch(body: RawLineInput): Partial<ResolvedLineInput> {
  const patch: Partial<ResolvedLineInput> = {};
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.trim() === "") {
      throw new HttpError(422, "description is required");
    }
    patch.description = body.description.trim();
  }
  if (body.quantity !== undefined) patch.quantity = toDecimalInput(body.quantity, "quantity");
  if (body.unitPrice !== undefined) patch.unitPrice = toDecimalInput(body.unitPrice, "unitPrice");
  if (body.discountType !== undefined) patch.discountType = toDiscountType(body.discountType);
  if (body.discountValue !== undefined) patch.discountValue = toDecimalInput(body.discountValue, "discountValue");
  if (body.taxPercent !== undefined) patch.taxPercent = toDecimalInput(body.taxPercent, "taxPercent");
  return patch;
}

function storedLineToInput(line: LineRecord): ResolvedLineInput {
  return {
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountType: line.discountType,
    discountValue: line.discountValue,
    taxPercent: line.taxPercent,
  };
}

async function loadLineInputs(tx: Prisma.TransactionClient, documentId: string): Promise<ResolvedLineInput[]> {
  const lines = await tx.lineItem.findMany({
    where: { documentId },
    select: {
      description: true,
      quantity: true,
      unitPrice: true,
      discountType: true,
      discountValue: true,
      taxPercent: true,
    },
  });
  return lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountType: line.discountType,
    discountValue: line.discountValue,
    taxPercent: line.taxPercent,
  }));
}

async function recomputeTotals(tx: Prisma.TransactionClient, documentId: string): Promise<DocumentTotals> {
  const inputs = await loadLineInputs(tx, documentId);
  const totals = calculateDocument(inputs);
  await tx.document.update({
    where: { id: documentId },
    data: {
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      totalTax: totals.totalTax,
      grandTotal: totals.grandTotal,
    },
  });
  return totals;
}

function toLineWrite(total: LineTotals) {
  return {
    subtotal: total.subtotal,
    discountAmount: total.discountAmount,
    discountedAmount: total.discountedAmount,
    taxAmount: total.taxAmount,
    lineTotal: total.lineTotal,
  };
}

export async function listDocuments(userId: string): Promise<DocumentView[]> {
  const documents = await getPrisma().document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: DOCUMENT_SELECT,
  });
  return documents.map(serializeDocument);
}

export async function getDocument(userId: string, documentId: string): Promise<DocumentView> {
  const document = await getOwnedDocument(userId, documentId);
  const lines = await getPrisma().lineItem.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
  });
  const view = serializeDocument(document);
  view.lines = lines.map(serializeLine);
  return view;
}

export function parseIssueDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(422, "issueDate must be a string (YYYY-MM-DD)");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(422, "issueDate must be a valid date (YYYY-MM-DD)");
  }
  return date;
}

export async function createDocument(
  userId: string,
  input: { title?: unknown; customer?: unknown; issueDate?: unknown },
): Promise<DocumentView> {
  if (typeof input.title !== "string" || input.title.trim() === "") {
    throw new HttpError(422, "title is required");
  }
  if (typeof input.customer !== "string" || input.customer.trim() === "") {
    throw new HttpError(422, "customer is required");
  }
  const issueDate = parseIssueDate(input.issueDate) ?? new Date();

  const document = await getPrisma().document.create({
    data: {
      userId,
      title: input.title.trim(),
      customer: input.customer.trim(),
      issueDate,
    },
    select: DOCUMENT_SELECT,
  });
  return serializeDocument(document);
}

export async function updateDocumentMeta(
  userId: string,
  documentId: string,
  input: { title?: unknown; customer?: unknown; issueDate?: unknown },
): Promise<DocumentView> {
  const document = await getOwnedDocument(userId, documentId);
  assertDraft(document);

  const data: { title?: string; customer?: string; issueDate?: Date } = {};
  if (input.title !== undefined) {
    if (typeof input.title !== "string" || input.title.trim() === "") {
      throw new HttpError(422, "title is required");
    }
    data.title = input.title.trim();
  }
  if (input.customer !== undefined) {
    if (typeof input.customer !== "string" || input.customer.trim() === "") {
      throw new HttpError(422, "customer is required");
    }
    data.customer = input.customer.trim();
  }
  if (input.issueDate !== undefined) {
    data.issueDate = parseIssueDate(input.issueDate);
  }

  const updated = await getPrisma().document.update({
    where: { id: documentId },
    data,
    select: DOCUMENT_SELECT,
  });
  return serializeDocument(updated);
}

export async function deleteDocument(userId: string, documentId: string): Promise<void> {
  const document = await getOwnedDocument(userId, documentId);
  assertDraft(document);
  await getPrisma().document.delete({ where: { id: documentId } });
}

export async function duplicateDocument(userId: string, documentId: string): Promise<DocumentView> {
  const source = await getOwnedDocument(userId, documentId);
  const sourceLines = await getPrisma().lineItem.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
  });

  const created = await getPrisma().$transaction(async (tx) => {
    const createdDocument = await tx.document.create({
      data: {
        userId,
        title: `${source.title} (copy)`,
        customer: source.customer,
        issueDate: source.issueDate,
      },
      select: DOCUMENT_SELECT,
    });

    if (sourceLines.length > 0) {
      for (const line of sourceLines) {
        const input: ResolvedLineInput = {
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountType: line.discountType,
          discountValue: line.discountValue,
          taxPercent: line.taxPercent,
        };
        let totals: LineTotals;
        try {
          totals = calculateLine(input);
        } catch (error) {
          toHttpError(error);
        }
        await tx.lineItem.create({
          data: {
            documentId: createdDocument.id,
            ...input,
            ...toLineWrite(totals),
          },
        });
      }
      await recomputeTotals(tx, createdDocument.id);
    }
    return createdDocument;
  });

  return getDocument(userId, created.id);
}

export async function addLine(
  userId: string,
  documentId: string,
  input: ResolvedLineInput,
): Promise<{ line: LineView; document: DocumentView }> {
  const document = await getOwnedDocument(userId, documentId);
  assertDraft(document);

  let totals: LineTotals;
  try {
    totals = calculateLine(input);
  } catch (error) {
    toHttpError(error);
  }

  const createdLine = await getPrisma().$transaction(async (tx) => {
    const line = await tx.lineItem.create({
      data: {
        documentId,
        description: input.description,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        discountType: input.discountType,
        discountValue: input.discountValue,
        taxPercent: input.taxPercent,
        ...toLineWrite(totals),
      },
    });
    await recomputeTotals(tx, documentId);
    return line;
  });

  const updatedDocument = await getOwnedDocument(userId, documentId);
  return { line: serializeLine(createdLine), document: serializeDocument(updatedDocument) };
}

export async function updateLine(
  userId: string,
  documentId: string,
  lineId: string,
  patch: Partial<ResolvedLineInput>,
): Promise<{ line: LineView; document: DocumentView }> {
  const document = await getOwnedDocument(userId, documentId);
  assertDraft(document);

  const existing = await getPrisma().lineItem.findFirst({ where: { id: lineId, documentId } });
  if (!existing) {
    throw new HttpError(404, "Line item not found");
  }

  const merged: ResolvedLineInput = { ...storedLineToInput(existing), ...patch };

  let totals: LineTotals;
  try {
    totals = calculateLine(merged);
  } catch (error) {
    toHttpError(error);
  }

  const updatedLine = await getPrisma().$transaction(async (tx) => {
    const line = await tx.lineItem.update({
      where: { id: lineId },
      data: {
        description: merged.description,
        quantity: merged.quantity,
        unitPrice: merged.unitPrice,
        discountType: merged.discountType,
        discountValue: merged.discountValue,
        taxPercent: merged.taxPercent,
        ...toLineWrite(totals),
      },
    });
    await recomputeTotals(tx, documentId);
    return line;
  });

  const updatedDocument = await getOwnedDocument(userId, documentId);
  return { line: serializeLine(updatedLine), document: serializeDocument(updatedDocument) };
}

export async function deleteLine(
  userId: string,
  documentId: string,
  lineId: string,
): Promise<{ document: DocumentView }> {
  const document = await getOwnedDocument(userId, documentId);
  assertDraft(document);

  const existing = await getPrisma().lineItem.findFirst({ where: { id: lineId, documentId } });
  if (!existing) {
    throw new HttpError(404, "Line item not found");
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.lineItem.delete({ where: { id: lineId } });
    await recomputeTotals(tx, documentId);
  });

  return { document: serializeDocument(await getOwnedDocument(userId, documentId)) };
}

export async function finalizeDocument(userId: string, documentId: string): Promise<DocumentView> {
  const document = await getOwnedDocument(userId, documentId);
  assertDraft(document);

  await getPrisma().$transaction(async (tx) => {
    const inputs = await loadLineInputs(tx, documentId);
    if (inputs.length === 0) {
      throw new HttpError(422, "A document must have at least one line to be finalized");
    }
    try {
      for (const input of inputs) {
        calculateLine(input);
      }
    } catch (error) {
      toHttpError(error);
    }
    const totals = calculateDocument(inputs);
    await tx.document.update({
      where: { id: documentId },
      data: {
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        totalTax: totals.totalTax,
        grandTotal: totals.grandTotal,
        status: "FINALIZED",
      },
    });
  });

  return serializeDocument(await getOwnedDocument(userId, documentId));
}