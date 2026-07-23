import { getOrInitTodayInventory, adjustInventory } from "../../../lib/inventory";
import { verifyPassword } from "../../../lib/auth";
import { redis } from "../../../lib/redis";
import { NextResponse } from "next/server";

export async function GET() {
  const inventory = await getOrInitTodayInventory();
  return NextResponse.json({ inventory });
}

// Admin-only: adjust today's remaining sachet count (+/-) or restock.
export async function POST(req) {
  const adminPassword = req.headers.get("x-admin-password") || "";
  const hash = await redis.get("admin-password-hash");
  if (!hash || !verifyPassword(adminPassword, hash)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { kind, delta } = await req.json();
  if (!["wash", "softener"].includes(kind) || typeof delta !== "number") {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const inventory = await adjustInventory(kind, delta);
  return NextResponse.json({ inventory });
}
