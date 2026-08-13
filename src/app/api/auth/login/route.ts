import { NextRequest } from "next/server";
import { loginUser } from "@/lib/auth/service";
import { errorResponse, success } from "@/lib/http";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const { user, sessionToken } = await loginUser(body.email, body.password);
    const res = success({ user });
    res.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}