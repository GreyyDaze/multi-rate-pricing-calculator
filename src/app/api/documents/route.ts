import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { createDocument, listDocuments } from "@/lib/documents";
import { errorResponse, HttpError, success } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);
    return success({ documents: await listDocuments(userId) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }
    const record = (body ?? {}) as { title?: unknown; customer?: unknown; issueDate?: unknown };
    const document = await createDocument(userId, record);
    return success({ document }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}