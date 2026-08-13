import { NextRequest } from "next/server";
import { HttpError } from "../http-error";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export async function requireAuth(request: NextRequest): Promise<string> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    throw new HttpError(401, "Authentication required");
  }
  const userId = await verifySessionToken(token);
  if (!userId) {
    throw new HttpError(401, "Invalid or expired session");
  }
  return userId;
}