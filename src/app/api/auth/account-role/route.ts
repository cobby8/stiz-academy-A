import { NextResponse } from "next/server";
import { getPublicAccountRole } from "@/lib/public-account";

export async function GET() {
  const role = await getPublicAccountRole();

  return NextResponse.json(
    { role },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
