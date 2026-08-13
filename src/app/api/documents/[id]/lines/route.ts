import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { addLine, parseLineInput } from "@/lib/documents";
import { errorResponse, HttpError, success } from "@/lib/http";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/documents/[id]/lines">) {
  try {
    const userId = await requireAuth(request);
    const { id } = await ctx.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }
    const result = await addLine(userId, id, parseLineInput((body ?? {}) as Record<string, unknown>));
    return success(result, 201);
  } catch (err) {
    return errorResponse(err);
  }
}