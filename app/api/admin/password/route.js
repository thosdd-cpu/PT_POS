import { redis } from "../../../../lib/redis";
import { hashPassword, verifyPassword } from "../../../../lib/auth";
import { NextResponse } from "next/server";

export async function POST(req) {
  const { currentPassword, newPassword } = await req.json();
  const hash = await redis.get("admin-password-hash");
  if (!hash || !verifyPassword(currentPassword || "", hash)) {
    return NextResponse.json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }, { status: 401 });
  }
  if (!newPassword || newPassword.length < 4) {
    return NextResponse.json({ error: "รหัสผ่านใหม่สั้นเกินไป" }, { status: 400 });
  }
  await redis.set("admin-password-hash", hashPassword(newPassword));
  return NextResponse.json({ ok: true });
}
