import type { NextRequest } from "next/server";
import type { IssuePassportRequest } from "./types";

export async function parseIssuePassportRequest(
  request: NextRequest,
): Promise<IssuePassportRequest> {
  try {
    return (await request.json()) as IssuePassportRequest;
  } catch {
    const text = await request.text();

    if (!text.trim()) {
      throw new Error(
        "Request body was missing after payment. Refresh and mint again.",
      );
    }

    return JSON.parse(text) as IssuePassportRequest;
  }
}
