import { redis } from "../../../../lib/redis";
import { applyEditDelta } from "../../../../lib/inventory";
import { NextResponse } from "next/server";

// Public read-only fetch for the customer-facing receipt QR page.
export async function GET(req, { params }) {
  const raw = await redis.get(`sale:${params.id}`);
  if (!raw) return NextResponse.json({ error: "not found" }, { status: 404 });
  const sale = typeof raw === "string" ? JSON.parse(raw) : raw;
  return NextResponse.json({ sale });
}

// Edit an existing sale (same-day corrections). Keeps the original
// timestamp/score so it stays in place in the daily report, and nets out
// any change in liquid quantities against today's inventory.
export async function PUT(req, { params }) {
  const updates = await req.json();
  const raw = await redis.get(`sale:${params.id}`);
  if (!raw) return NextResponse.json({ error: "not found" }, { status: 404 });
  const existing = typeof raw === "string" ? JSON.parse(raw) : raw;
  const newItems = updates.items ?? existing.items;
  const updated = {
    ...existing,
    items: newItems,
    total: updates.total ?? existing.total,
    payMethod: updates.payMethod ?? existing.payMethod,
    customerName: updates.customerName ?? existing.customerName,
    editedAt: Date.now(),
  };
  await redis.set(`sale:${params.id}`, JSON.stringify(updated));
  await applyEditDelta(existing.items, newItems);
  return NextResponse.json({ ok: true, sale: updated });
}
