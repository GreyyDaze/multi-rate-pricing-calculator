import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { getPrisma } from "@/lib/prisma";
import { errorResponse, success } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return success({ user });
  } catch (err) {
    return errorResponse(err);
  }
}