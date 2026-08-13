import { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export class AuthError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAuth(request: NextRequest): Promise<string> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    throw new AuthError();
  }
  const userId = await verifySessionToken(token);
  if (!userId) {
    throw new AuthError("Invalid or expired session");
  }
  return userId;
}