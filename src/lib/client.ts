import { api, type DocumentView, type ReportSummary } from "@/lib/api";

export interface LinePayload {
  description: string;
  quantity: number;
  unitPrice: number;
  discountType: "NONE" | "PERCENT" | "FIXED";
  discountValue: number;
  taxPercent: number;
}

export function listDocuments(): Promise<{ documents: DocumentView[] }> {
  return api("/api/documents");
}

export function createDocument(input: {
  title: string;
  customer: string;
  issueDate?: string;
}): Promise<{ document: DocumentView }> {
  return api("/api/documents", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getDocument(id: string): Promise<{ document: DocumentView }> {
  return api(`/api/documents/${id}`);
}

export function updateDocumentMeta(
  id: string,
  input: { title?: string; customer?: string; issueDate?: string },
): Promise<{ document: DocumentView }> {
  return api(`/api/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteDocument(id: string): Promise<{ ok: true }> {
  return api(`/api/documents/${id}`, { method: "DELETE" });
}

export function addLine(
  id: string,
  input: LinePayload,
): Promise<{ line: DocumentView["lines"] extends (infer L)[] | undefined ? L : never; document: DocumentView }> {
  return api(`/api/documents/${id}/lines`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateLine(
  id: string,
  lineId: string,
  input: Partial<LinePayload>,
): Promise<{ line: NonNullable<DocumentView["lines"]>[number]; document: DocumentView }> {
  return api(`/api/documents/${id}/lines/${lineId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteLine(id: string, lineId: string): Promise<{ document: DocumentView }> {
  return api(`/api/documents/${id}/lines/${lineId}`, { method: "DELETE" });
}

export function finalizeDocument(id: string): Promise<{ document: DocumentView }> {
  return api(`/api/documents/${id}/finalize`, { method: "POST" });
}

export function getReportSummary(from?: string, to?: string): Promise<{ report: ReportSummary }> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return api(`/api/reports/summary${qs ? `?${qs}` : ""}`);
}