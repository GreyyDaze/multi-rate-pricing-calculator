import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/requireAuth";
import { summarizeReports } from "@/lib/reports";
import { errorResponse, success } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const report = await summarizeReports(
      userId,
      searchParams.get("from"),
      searchParams.get("to"),
    );
    return success({ report });
  } catch (err) {
    return errorResponse(err);
  }
}