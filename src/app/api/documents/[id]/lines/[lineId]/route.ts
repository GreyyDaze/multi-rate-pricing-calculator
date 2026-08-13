import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { deleteLine, parseLinePatch, updateLine } from "@/lib/documents";
import { errorResponse, HttpError, success } from "@/lib/http";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/documents/[id]/lines/[lineId]">) {
  try {
    const userId = await requireAuth(request);
    const { id, lineId } = await ctx.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }
    const result = await updateLine(userId, id, lineId, parseLinePatch((body ?? {}) as Record<string, unknown>));
    return success(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/documents/[id]/lines/[lineId]">) {
  try {
    const userId = await requireAuth(request);
    const { id, lineId } = await ctx.params;
    return success(await deleteLine(userId, id, lineId));
  } catch (err) {
    return errorResponse(err);
  }
}