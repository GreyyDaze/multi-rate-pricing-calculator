import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { deleteDocument, getDocument, updateDocumentMeta } from "@/lib/documents";
import { errorResponse, HttpError, success } from "@/lib/http";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  try {
    const userId = await requireAuth(request);
    const { id } = await ctx.params;
    return success({ document: await getDocument(userId, id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  try {
    const userId = await requireAuth(request);
    const { id } = await ctx.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }
    const record = (body ?? {}) as { title?: unknown; customer?: unknown; issueDate?: unknown };
    return success({ document: await updateDocumentMeta(userId, id, record) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/documents/[id]">) {
  try {
    const userId = await requireAuth(request);
    const { id } = await ctx.params;
    await deleteDocument(userId, id);
    return success({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}