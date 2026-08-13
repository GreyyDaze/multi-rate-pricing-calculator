import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { HttpError } from "./http-error";

export { HttpError } from "./http-error";

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function success(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}