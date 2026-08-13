import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { finalizeDocument } from "@/lib/documents";
import { errorResponse, success } from "@/lib/http";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/documents/[id]/finalize">) {
  try {
    const userId = await requireAuth(request);
    const { id } = await ctx.params;
    return success({ document: await finalizeDocument(userId, id) });
  } catch (err) {
    return errorResponse(err);
  }
}