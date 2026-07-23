import { redis } from "../../../lib/redis";
import { notifyLine } from "../../../lib/line";
import { decrementForSaleItems, restoreForSaleItems } from "../../../lib/inventory";
import { NextResponse } from "next/server";

export async function GET() {
  const ids = await redis.zrange("sales-index", 0, -1, { rev: true });
  if (!ids || ids.length === 0) return NextResponse.json({ sales: [] });
  const keys = ids.map((id) => `sale:${id}`);
  const raw = await redis.mget(...keys);
  const sales = raw.filter(Boolean).map((v) => (typeof v === "string" ? JSON.parse(v) : v));
  return NextResponse.json({ sales });
}

export async function POST(req) {
  const sale = await req.json();
  if (!sale.id || !sale.ts) {
    return NextResponse.json({ error: "invalid sale" }, { status: 400 });
  }
  await redis.set(`sale:${sale.id}`, JSON.stringify(sale));
  await redis.zadd("sales-index", { score: sale.ts, member: sale.id });
  await decrementForSaleItems(sale.items);
  notifyLine(sale); // fire and forget, never blocks the sale
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const raw = await redis.get(`sale:${id}`);
  if (raw) {
    const sale = typeof raw === "string" ? JSON.parse(raw) : raw;
    await restoreForSaleItems(sale.items);
  }
  await redis.del(`sale:${id}`);
  await redis.zrem("sales-index", id);
  return NextResponse.json({ ok: true });
}
