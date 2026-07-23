"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { theme } from "../../lib/theme";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState("staff");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: tab, name, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
        setLoading(false);
        return;
      }
      if (tab === "admin") {
        sessionStorage.setItem("adminPassword", password);
        sessionStorage.setItem("session", JSON.stringify({ role: "admin", name: data.name }));
        router.push("/admin");
      } else {
        sessionStorage.setItem("session", JSON.stringify({ role: "staff", name: data.name }));
        router.push("/pos");
      }
    } catch (err) {
      setError("เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.cream,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/logo.png" alt="เป๋าตุง Wash & Dry" style={{ width: 140, height: 140, borderRadius: 20 }} />
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 8px 24px rgba(18,84,158,0.12)",
            border: `1px solid ${theme.lightBlue}`,
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <TabButton active={tab === "staff"} onClick={() => { setTab("staff"); setError(""); }}>
              พนักงาน
            </TabButton>
            <TabButton active={tab === "admin"} onClick={() => { setTab("admin"); setError(""); }}>
              แอดมิน
            </TabButton>
          </div>

          <form onSubmit={handleSubmit}>
            {tab === "staff" && (
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>ชื่อพนักงาน</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อที่แอดมินตั้งให้"
                  required
                  style={inputStyle}
                />
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                required
                style={inputStyle}
              />
            </div>

            {error && (
              <p style={{ color: theme.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 10,
                border: "none",
                background: theme.navy,
                color: "#fff",
                fontSize: 15,
                fontWeight: 500,
                cursor: "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          {tab === "staff" && (
            <p style={{ fontSize: 12, color: "#888780", marginTop: 14, textAlign: "center" }}>
              บัญชีพนักงานตั้งค่าโดยแอดมินเท่านั้น
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px",
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: 500,
        background: active ? theme.navy : theme.cream,
        color: active ? "#fff" : theme.ink,
      }}
    >
      {children}
    </button>
  );
}

const labelStyle = { display: "block", fontSize: 13, color: "#5f5e5a", marginBottom: 6 };
const inputStyle = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 8,
  border: "1px solid #D3D1C7",
  fontSize: 15,
  boxSizing: "border-box",
};
