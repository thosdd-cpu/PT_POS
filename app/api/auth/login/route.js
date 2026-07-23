import { redis } from "../../../../lib/redis";
import { hashPassword, verifyPassword } from "../../../../lib/auth";
import { NextResponse } from "next/server";

const DEFAULT_ADMIN_PASSWORD = "admin1234";

async function getAdminHash() {
  let hash = await redis.get("admin-password-hash");
  if (!hash) {
    hash = hashPassword(DEFAULT_ADMIN_PASSWORD);
    await redis.set("admin-password-hash", hash);
  }
  return hash;
}

export async function POST(req) {
  const { role, name, password } = await req.json();

  if (role === "admin") {
    const hash = await getAdminHash();
    if (verifyPassword(password || "", hash)) {
      return NextResponse.json({ ok: true, role: "admin", name: "แอดมิน" });
    }
    return NextResponse.json({ ok: false, error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  if (role === "staff") {
    const raw = await redis.get("staff-list");
    const staff = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
    const found = staff.find((s) => s.name === name);
    if (found && verifyPassword(password || "", found.passwordHash)) {
      return NextResponse.json({ ok: true, role: "staff", name: found.name });
    }
    return NextResponse.json({ ok: false, error: "ชื่อหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  return NextResponse.json({ ok: false, error: "invalid role" }, { status: 400 });
}
