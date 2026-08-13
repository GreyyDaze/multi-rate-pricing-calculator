import { NextRequest } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/requireAuth";
import { getPrisma } from "@/lib/prisma";

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
    return Response.json({ user });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: 401 });
    }
    console.error(err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}