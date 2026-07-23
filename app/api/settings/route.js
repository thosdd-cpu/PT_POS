import { redis } from "../../../lib/redis";
import { verifyPassword } from "../../../lib/auth";
import { DEFAULT_PRICING, DEFAULT_SHOP_INFO, DEFAULT_INVENTORY } from "../../../lib/pricing";
import { NextResponse } from "next/server";

export async function GET() {
  const raw = await redis.get("settings-v2");
  const settings = raw
    ? typeof raw === "string"
      ? JSON.parse(raw)
      : raw
    : { ...DEFAULT_SHOP_INFO, pricing: DEFAULT_PRICING, inventory: DEFAULT_INVENTORY };
  if (!settings.inventory) settings.inventory = DEFAULT_INVENTORY;
  return NextResponse.json({ settings });
}

export async function POST(req) {
  const adminPassword = req.headers.get("x-admin-password") || "";
  const hash = await redis.get("admin-password-hash");
  if (!hash || !verifyPassword(adminPassword, hash)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await req.json();
  await redis.set("settings-v2", JSON.stringify(settings));
  return NextResponse.json({ ok: true });
}
