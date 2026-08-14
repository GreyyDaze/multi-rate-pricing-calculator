import { cookies } from "next/headers";
import { getPrisma } from "./prisma";
import { SESSION_COOKIE, verifySessionToken } from "./auth/session";

export async function currentUserEmail(): Promise<string | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const userId = await verifySessionToken(token);
    if (!userId) return null;
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  } catch {
    return null;
  }
}