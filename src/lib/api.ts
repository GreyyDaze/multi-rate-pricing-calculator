export type DiscountType = "NONE" | "PERCENT" | "FIXED";

export interface UserView {
  id: string;
  email: string;
}

export interface LineView {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountType: DiscountType;
  discountValue: string;
  taxPercent: string;
  subtotal: string;
  discountAmount: string;
  discountedAmount: string;
  taxAmount: string;
  lineTotal: string;
}

export interface DocumentView {
  id: string;
  title: string;
  customer: string;
  issueDate: string;
  status: "DRAFT" | "FINALIZED";
  subtotal: string;
  totalDiscount: string;
  totalTax: string;
  grandTotal: string;
  createdAt: string;
  updatedAt: string;
  lines?: LineView[];
}

export interface ReportSummary {
  from: string;
  to: string;
  documentCount: number;
  sumSubtotal: string;
  sumTotalDiscount: string;
  sumTotalTax: string;
  sumGrandTotal: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ErrorBody {
  error?: unknown;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const message =
      body && typeof body === "object"
        ? (body as ErrorBody).error
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, typeof message === "string" ? message : `Request failed (${res.status})`);
  }
  return body as T;
}