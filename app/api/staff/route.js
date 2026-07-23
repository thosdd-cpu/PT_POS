import { redis } from "../../../../lib/redis";
import { hashPassword, verifyPassword } from "../../../../lib/auth";
import { NextResponse } from "next/server";

async function checkAdmin(req) {
  const adminPassword = req.headers.get("x-admin-password") || "";
  const hash = await redis.get("admin-password-hash");
  if (!hash) return false;
  return verifyPassword(adminPassword, hash);
}

async function getStaffList() {
  const raw = await redis.get("staff-list");
  return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
}

export async function GET(req) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const staff = await getStaffList();
  // never send password hashes to the client
  return NextResponse.json({ staff: staff.map((s) => ({ name: s.name })) });
}

export async function POST(req) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { name, password } = await req.json();
  if (!name || !password) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const staff = await getStaffList();
  const existingIdx = staff.findIndex((s) => s.name === name);
  const entry = { name, passwordHash: hashPassword(password) };
  if (existingIdx >= 0) staff[existingIdx] = entry;
  else staff.push(entry);
  await redis.set("staff-list", JSON.stringify(staff));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  const staff = await getStaffList();
  const next = staff.filter((s) => s.name !== name);
  await redis.set("staff-list", JSON.stringify(next));
  return NextResponse.json({ ok: true });
}
