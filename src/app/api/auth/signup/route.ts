import { NextRequest } from "next/server";
import { registerUser } from "@/lib/auth/service";
import { errorResponse, HttpError, success } from "@/lib/http";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Invalid JSON body");
    }
    const record = body as { email?: unknown; password?: unknown };
    const { user, sessionToken } = await registerUser(record.email, record.password);
    const res = success({ user }, 201);
    res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}