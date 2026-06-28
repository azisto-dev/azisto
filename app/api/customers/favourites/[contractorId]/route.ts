import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function DELETE() {
  return NextResponse.json(
    {
      code: "favourites-unavailable",
      message: "Favourite contractors are not available yet.",
    },
    { status: 410 },
  );
}
