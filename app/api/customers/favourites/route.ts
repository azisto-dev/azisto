import { NextResponse } from "next/server";

export const runtime = "nodejs";

const unavailableResponse = {
  code: "favourites-unavailable",
  message: "Favourite contractors are not available yet.",
};

export async function GET() {
  return NextResponse.json(unavailableResponse, { status: 410 });
}

export async function POST() {
  return NextResponse.json(unavailableResponse, { status: 410 });
}
