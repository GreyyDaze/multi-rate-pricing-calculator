import { cookies } from "next/headers";
import { getPrisma } from "./prisma";
import { SESSION_COOKIE, verifySessionToken } from "./auth/session";

export interface CurrentUser {
  id: string;
  email: string;
}

export async function currentUser(): Promise<CurrentUser | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const userId = await verifySessionToken(token);
    if (!userId) return null;
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    return user ? { id: user.id, email: user.email } : null;
  } catch {
    return null;
  }
}

export async function currentUserEmail(): Promise<string | null> {
  const user = await currentUser();
  return user?.email ?? null;
}