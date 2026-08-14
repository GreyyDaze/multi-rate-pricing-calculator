import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { duplicateDocument } from "@/lib/documents";
import { errorResponse, success } from "@/lib/http";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAuth(request);
    const { id } = await ctx.params;
    return success({ document: await duplicateDocument(userId, id) }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}