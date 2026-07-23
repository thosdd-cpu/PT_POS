"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { theme } from "../../lib/theme";
import { DEFAULT_PRICING, DEFAULT_SHOP_INFO, DEFAULT_INVENTORY } from "../../lib/pricing";

function fmt(n) {
  return Math.round(n).toLocaleString("th-TH");
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function thaiDate(d) {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function timeStr(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminPage() {
  const router = useRouter();
  const [checkedSession, setCheckedSession] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [tab, setTab] = useState("staff");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("session");
    const pw = sessionStorage.getItem("adminPassword");
    if (!raw || !pw) {
      router.replace("/login");
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed.role !== "admin") {
      router.replace("/login");
      return;
    }
    setAdminPassword(pw);
    setCheckedSession(true);
  }, [router]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  function logout() {
    sessionStorage.removeItem("session");
    sessionStorage.removeItem("adminPassword");
    router.replace("/login");
  }

  if (!checkedSession) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: theme.cream }}>
        <p style={{ color: "#5f5e5a" }}>กำลังโหลด...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: theme.cream, paddingBottom: 40 }}>
      <div style={{ background: theme.navy, color: "#fff", padding: "14px 16px", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src="/logo.png" alt="" style={{ width: 30, height: 30, borderRadius: 6 }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>แผงควบคุมแอดมิน</p>
          </div>
          <button onClick={logout} style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
            ออกจากระบบ
          </button>
        </div>
        <div style={{ maxWidth: 800, margin: "10px auto 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["staff", "จัดการพนักงาน"], ["pricing", "ราคาบริการ"], ["inventory", "สต็อกน้ำยา"], ["reports", "รายงานยอดขาย"], ["security", "เปลี่ยนรหัสผ่าน"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ padding: "8px 12px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", background: tab === key ? "#fff" : "rgba(255,255,255,0.12)", color: tab === key ? theme.navy : "#fff" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", top: 90, left: "50%", transform: "translateX(-50%)", background: theme.navyDark, color: "#fff", padding: "8px 18px", borderRadius: 8, fontSize: 14, zIndex: 50 }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: 800, margin: "0 auto", padding: 16 }}>
        {tab === "staff" && <StaffTab adminPassword={adminPassword} showToast={showToast} />}
        {tab === "pricing" && <PricingTab adminPassword={adminPassword} showToast={showToast} />}
        {tab === "inventory" && <InventoryTab adminPassword={adminPassword} showToast={showToast} />}
        {tab === "reports" && <ReportsTab showToast={showToast} />}
        {tab === "security" && <SecurityTab adminPassword={adminPassword} setAdminPassword={setAdminPassword} showToast={showToast} />}
      </div>
    </div>
  );
}

function StaffTab({ adminPassword, showToast }) {
  const [staff, setStaff] = useState([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/staff", { headers: { "x-admin-password": adminPassword } }).then((r) => r.json());
      setStaff(res.staff || []);
    } catch (e) {}
    setLoading(false);
  }, [adminPassword]);

  useEffect(() => { load(); }, [load]);

  async function addStaff(e) {
    e.preventDefault();
    if (!name.trim() || !password.trim()) return;
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({ name: name.trim(), password: password.trim() }),
      });
      if (!res.ok) throw new Error();
      setName("");
      setPassword("");
      showToast("บันทึกพนักงานแล้ว");
      load();
    } catch (e) {
      showToast("บันทึกไม่สำเร็จ");
    }
  }

  async function removeStaff(staffName) {
    try {
      await fetch(`/api/staff?name=${encodeURIComponent(staffName)}`, {
        method: "DELETE",
        headers: { "x-admin-password": adminPassword },
      });
      showToast("ลบพนักงานแล้ว");
      load();
    } catch (e) {
      showToast("ลบไม่สำเร็จ");
    }
  }

  return (
    <div>
      <SectionCard title="เพิ่ม / แก้ไขพนักงาน">
        <form onSubmit={addStaff} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อพนักงาน" style={{ ...inputStyle, flex: "1 1 160px" }} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="รหัสผ่าน" style={{ ...inputStyle, flex: "1 1 160px" }} />
          <button type="submit" style={primaryBtn}>บันทึก</button>
        </form>
        <p style={{ fontSize: 12, color: "#888780", marginTop: 8 }}>ใส่ชื่อเดิมเพื่อเปลี่ยนรหัสผ่านของพนักงานคนนั้น</p>
      </SectionCard>

      <SectionCard title={`รายชื่อพนักงาน (${staff.length})`}>
        {loading ? (
          <p style={{ color: "#888780", fontSize: 14 }}>กำลังโหลด...</p>
        ) : staff.length === 0 ? (
          <p style={{ color: "#888780", fontSize: 14 }}>ยังไม่มีพนักงาน</p>
        ) : (
          staff.map((s) => (
            <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid #EEEDEA" }}>
              <span style={{ fontSize: 14 }}>{s.name}</span>
              <button onClick={() => removeStaff(s.name)} style={{ ...ghostBtnSm, color: theme.danger }}>ลบ</button>
            </div>
          ))
        )}
      </SectionCard>
    </div>
  );
}

function PricingTab({ adminPassword, showToast }) {
  const [settings, setSettings] = useState({ ...DEFAULT_SHOP_INFO, pricing: DEFAULT_PRICING });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings").then((r) => r.json());
        if (res.settings) setSettings(res.settings);
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  function updateLiquid(i, field, val) {
    setSettings((prev) => {
      const liquids = [...prev.pricing.liquids];
      liquids[i] = { ...liquids[i], [field]: field === "price" ? parseFloat(val) || 0 : val };
      return { ...prev, pricing: { ...prev.pricing, liquids } };
    });
  }

  function updateWasherOption(machineIdx, optIdx, field, val) {
    setSettings((prev) => {
      const washers = prev.pricing.washers.map((m, i) => {
        if (i !== machineIdx) return m;
        const options = m.options.map((o, j) => {
          if (j !== optIdx) return o;
          if (field === "promoEnabled") {
            return { ...o, promoPrice: val ? o.normalPrice - 10 : null };
          }
          return { ...o, [field]: parseFloat(val) || 0 };
        });
        return { ...m, options };
      });
      return { ...prev, pricing: { ...prev.pricing, washers } };
    });
  }

  function updateDryer(i, field, val) {
    setSettings((prev) => {
      const dryers = prev.pricing.dryers.map((d, idx) => {
        if (idx !== i) return d;
        if (field === "promoEnabled") {
          return { ...d, promoPrice: val ? d.normalPrice - 10 : null };
        }
        return { ...d, [field]: parseFloat(val) || 0 };
      });
      return { ...prev, pricing: { ...prev.pricing, dryers } };
    });
  }

  function updateAddon(i, val) {
    setSettings((prev) => {
      const dryerAddons = [...prev.pricing.dryerAddons];
      dryerAddons[i] = parseFloat(val) || 0;
      return { ...prev, pricing: { ...prev.pricing, dryerAddons } };
    });
  }

  async function save() {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      showToast("บันทึกการตั้งค่าแล้ว");
    } catch (e) {
      showToast("บันทึกไม่สำเร็จ");
    }
  }

  if (loading) return <p style={{ color: "#888780" }}>กำลังโหลด...</p>;

  return (
    <div>
      <SectionCard title="ข้อมูลร้าน">
        <label style={labelStyle}>ชื่อร้าน</label>
        <input value={settings.shopName} onChange={(e) => setSettings((p) => ({ ...p, shopName: e.target.value }))} style={{ ...inputStyle, marginBottom: 10 }} />
        <label style={labelStyle}>ที่อยู่ (แสดงบนใบเสร็จ)</label>
        <textarea value={settings.address} onChange={(e) => setSettings((p) => ({ ...p, address: e.target.value }))} style={{ ...inputStyle, minHeight: 60 }} />
      </SectionCard>

      <SectionCard title="น้ำยา">
        {settings.pricing.liquids.map((it, i) => (
          <div key={it.id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={it.name} onChange={(e) => updateLiquid(i, "name", e.target.value)} style={{ ...inputStyle, flex: 2 }} />
            <input type="number" value={it.price} onChange={(e) => updateLiquid(i, "price", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <span style={{ alignSelf: "center", fontSize: 13, color: "#5f5e5a" }}>บาท/{it.unit}</span>
          </div>
        ))}
      </SectionCard>

      <SectionCard title="เครื่องซักผ้า">
        {settings.pricing.washers.map((m, mi) => (
          <div key={m.id} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 8px" }}>{m.name}</p>
            {m.options.map((o, oi) => (
              <div key={o.temp} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <span style={{ width: 64, fontSize: 13 }}>{o.label}</span>
                <input type="number" value={o.normalPrice} onChange={(e) => updateWasherOption(mi, oi, "normalPrice", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={!!o.promoPrice} onChange={(e) => updateWasherOption(mi, oi, "promoEnabled", e.target.checked)} />
                  โปร
                </label>
                {o.promoPrice != null && (
                  <input type="number" value={o.promoPrice} onChange={(e) => updateWasherOption(mi, oi, "promoPrice", e.target.value)} style={{ ...inputStyle, flex: 1, borderColor: theme.gold }} />
                )}
              </div>
            ))}
          </div>
        ))}
      </SectionCard>

      <SectionCard title="เครื่องอบผ้า">
        {settings.pricing.dryers.map((d, i) => (
          <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <span style={{ width: 130, fontSize: 13 }}>{d.name}</span>
            <input type="number" value={d.normalPrice} onChange={(e) => updateDryer(i, "normalPrice", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={!!d.promoPrice} onChange={(e) => updateDryer(i, "promoEnabled", e.target.checked)} />
              โปร
            </label>
            {d.promoPrice != null && (
              <input type="number" value={d.promoPrice} onChange={(e) => updateDryer(i, "promoPrice", e.target.value)} style={{ ...inputStyle, flex: 1, borderColor: theme.gold }} />
            )}
          </div>
        ))}
        <p style={{ fontSize: 13, margin: "10px 0 6px", color: "#5f5e5a" }}>ตัวเลือกเพิ่มเวลาอบ (บาท)</p>
        <div style={{ display: "flex", gap: 8 }}>
          {settings.pricing.dryerAddons.map((m, i) => (
            <input key={i} type="number" value={m} onChange={(e) => updateAddon(i, e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          ))}
        </div>
      </SectionCard>

      <button onClick={save} style={{ ...primaryBtn, width: "100%", padding: 13 }}>บันทึกการตั้งค่าทั้งหมด</button>
    </div>
  );
}

function InventoryTab({ adminPassword, showToast }) {
  const [inventory, setInventory] = useState(null);
  const [perDay, setPerDay] = useState(DEFAULT_INVENTORY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [invRes, settingsRes] = await Promise.all([
        fetch("/api/inventory").then((r) => r.json()),
        fetch("/api/settings").then((r) => r.json()),
      ]);
      if (invRes.inventory) setInventory(invRes.inventory);
      if (settingsRes.settings?.inventory) setPerDay(settingsRes.settings.inventory);
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function adjust(kind, delta) {
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify({ kind, delta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setInventory(data.inventory);
      showToast(delta > 0 ? "เพิ่มสต็อกแล้ว" : "ลดสต็อกแล้ว");
    } catch (e) {
      showToast("ปรับสต็อกไม่สำเร็จ");
    }
  }

  async function savePerDay() {
    try {
      const settingsRes = await fetch("/api/settings").then((r) => r.json());
      const settings = settingsRes.settings || { ...DEFAULT_SHOP_INFO, pricing: DEFAULT_PRICING };
      settings.inventory = perDay;
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-password": adminPassword },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      showToast("บันทึกจำนวนตั้งต้นต่อวันแล้ว");
    } catch (e) {
      showToast("บันทึกไม่สำเร็จ");
    }
  }

  if (loading) return <p style={{ color: "#888780" }}>กำลังโหลด...</p>;

  return (
    <div>
      <SectionCard title={`สต็อกวันนี้ (${inventory?.dateKey || ""})`} action={<button onClick={load} style={ghostBtnSm}>รีเฟรช</button>}>
        <p style={{ fontSize: 12, color: "#888780", marginBottom: 14 }}>
          เหลือเท่าไรจะถูกตัดจากยอดขายอัตโนมัติ และรีเซ็ตกลับเป็นจำนวนตั้งต้นทุกวันใหม่ (เวลาไทย)
        </p>
        <StockRow label="น้ำยาซักผ้า" remaining={inventory?.washLiquidRemaining} perDay={inventory?.washLiquidPerDay} onAdjust={(d) => adjust("wash", d)} />
        <StockRow label="น้ำยาปรับผ้านุ่ม" remaining={inventory?.softenerRemaining} perDay={inventory?.softenerPerDay} onAdjust={(d) => adjust("softener", d)} />
      </SectionCard>

      <SectionCard title="จำนวนตั้งต้นต่อวัน (รีเซ็ตทุกวันใหม่)">
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>น้ำยาซักผ้า (ซอง/วัน)</label>
            <input type="number" value={perDay.washLiquidPerDay} onChange={(e) => setPerDay((p) => ({ ...p, washLiquidPerDay: parseInt(e.target.value) || 0 }))} style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>น้ำยาปรับผ้านุ่ม (ซอง/วัน)</label>
            <input type="number" value={perDay.softenerPerDay} onChange={(e) => setPerDay((p) => ({ ...p, softenerPerDay: parseInt(e.target.value) || 0 }))} style={inputStyle} />
          </div>
        </div>
        <button onClick={savePerDay} style={primaryBtn}>บันทึกจำนวนตั้งต้น</button>
      </SectionCard>
    </div>
  );
}

function StockRow({ label, remaining, perDay, onAdjust }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "0.5px solid #EEEDEA" }}>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{label}</p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "#888780" }}>เหลือ {remaining ?? "-"} / {perDay ?? "-"} ซอง</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => onAdjust(-1)} style={stepBtn}>−</button>
        <button onClick={() => onAdjust(1)} style={stepBtn}>+</button>
        <button onClick={() => onAdjust(20)} style={ghostBtnSm}>เติม +20</button>
      </div>
    </div>
  );
}

function SecurityTab({ adminPassword, setAdminPassword, showToast }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  async function changePassword(e) {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        return;
      }
      sessionStorage.setItem("adminPassword", next);
      setAdminPassword(next);
      setCurrent("");
      setNext("");
      showToast("เปลี่ยนรหัสผ่านสำเร็จ");
    } catch (e) {
      showToast("เชื่อมต่อไม่สำเร็จ");
    }
  }

  return (
    <SectionCard title="เปลี่ยนรหัสผ่านแอดมิน">
      <form onSubmit={changePassword}>
        <label style={labelStyle}>รหัสผ่านปัจจุบัน</label>
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} required />
        <label style={labelStyle}>รหัสผ่านใหม่</label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} required />
        <button type="submit" style={primaryBtn}>เปลี่ยนรหัสผ่าน</button>
      </form>
    </SectionCard>
  );
}

function ReportsTab({ showToast }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportMode, setReportMode] = useState("day");
  const [reportDate, setReportDate] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sales").then((r) => r.json());
      setSales(res.sales || []);
    } catch (e) {
      showToast("โหลดข้อมูลไม่สำเร็จ");
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function toDateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

  const filtered = sales.filter((s) => {
    const d = new Date(s.ts);
    if (reportMode === "day") return toDateKey(d) === toDateKey(reportDate);
    if (reportMode === "month") return d.getFullYear() === reportDate.getFullYear() && d.getMonth() === reportDate.getMonth();
    return d.getFullYear() === reportDate.getFullYear();
  });

  const cash = filtered.filter((s) => s.payMethod === "cash").reduce((a, s) => a + s.total, 0);
  const transfer = filtered.filter((s) => s.payMethod === "transfer").reduce((a, s) => a + s.total, 0);

  function shift(delta) {
    setReportDate((prev) => {
      const d = new Date(prev);
      if (reportMode === "day") d.setDate(d.getDate() + delta);
      else if (reportMode === "month") d.setMonth(d.getMonth() + delta);
      else d.setFullYear(d.getFullYear() + delta);
      return d;
    });
  }

  function label() {
    if (reportMode === "day") return thaiDate(reportDate);
    if (reportMode === "month") {
      const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
      return `${months[reportDate.getMonth()]} ${reportDate.getFullYear() + 543}`;
    }
    return `พ.ศ. ${reportDate.getFullYear() + 543}`;
  }

  function exportExcel() {
    const rows = filtered.map((s) => {
      const d = new Date(s.ts);
      return {
        "วันที่": thaiDate(d),
        "เวลา": timeStr(d),
        "พนักงาน": s.employeeName,
        "รายการ": s.items.map((it) => `${it.name} x${it.qty}`).join(", "),
        "วิธีชำระ": s.payMethod === "cash" ? "เงินสด" : "โอนเงิน",
        "ยอดรวม (บาท)": s.total,
      };
    });
    rows.push({});
    rows.push({ "วันที่": "สรุป", "รายการ": "เงินสด", "ยอดรวม (บาท)": cash });
    rows.push({ "วันที่": "สรุป", "รายการ": "โอนเงิน", "ยอดรวม (บาท)": transfer });
    rows.push({ "วันที่": "สรุป", "รายการ": "รวมทั้งหมด", "ยอดรวม (บาท)": cash + transfer });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ยอดขาย");
    XLSX.writeFile(wb, `ยอดขาย-${label()}.xlsx`);
  }

  return (
    <div>
      <SectionCard title="ช่วงเวลา" action={<button onClick={load} style={ghostBtnSm}>รีเฟรช</button>}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[["day", "รายวัน"], ["month", "รายเดือน"], ["year", "รายปี"]].map(([key, l]) => (
            <button key={key} onClick={() => setReportMode(key)} style={{ flex: 1, padding: 8, borderRadius: 8, cursor: "pointer", fontSize: 13, border: reportMode === key ? `2px solid ${theme.navy}` : "0.5px solid #D3D1C7", background: reportMode === key ? theme.lightBlue : "#fff", fontWeight: 500 }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => shift(-1)} style={stepBtn}>‹</button>
          <span style={{ fontWeight: 500 }}>{label()}</span>
          <button onClick={() => shift(1)} style={stepBtn}>›</button>
        </div>
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10, marginBottom: 14 }}>
        <MetricCard label="ยอดรวม" value={`฿${fmt(cash + transfer)}`} />
        <MetricCard label="จำนวนบิล" value={filtered.length} />
        <MetricCard label="เงินสด" value={`฿${fmt(cash)}`} />
        <MetricCard label="โอนเงิน" value={`฿${fmt(transfer)}`} />
      </div>

      <SectionCard title={`รายการ (${filtered.length})`} action={filtered.length > 0 && <button onClick={exportExcel} style={ghostBtnSm}>Excel</button>}>
        {loading ? (
          <p style={{ color: "#888780" }}>กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: "#888780", fontSize: 14 }}>ไม่มีรายการ</p>
        ) : (
          filtered.map((s) => {
            const d = new Date(s.ts);
            return (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "0.5px solid #EEEDEA" }}>
                <p style={{ margin: 0, fontSize: 14 }}>{timeStr(d)} • {s.employeeName} • {s.items.map((it) => `${it.name}x${it.qty}`).join(", ")}</p>
                <span style={{ fontSize: 14, fontWeight: 500 }}>฿{fmt(s.total)}</span>
              </div>
            );
          })
        )}
      </SectionCard>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${theme.lightBlue}`, borderRadius: 12, padding: "12px 14px" }}>
      <p style={{ margin: 0, fontSize: 12, color: "#888780" }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 500, color: theme.navy }}>{value}</p>
    </div>
  );
}

function SectionCard({ title, children, action }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${theme.lightBlue}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: theme.ink }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, color: "#5f5e5a", marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #D3D1C7", fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const primaryBtn = { padding: "10px 16px", borderRadius: 8, border: "none", background: theme.navy, color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer" };
const ghostBtnSm = { padding: "8px 12px", borderRadius: 8, border: "1px solid #B4B2A9", background: "#fff", fontSize: 13, cursor: "pointer", color: "#2C2C2A", whiteSpace: "nowrap" };
const stepBtn = { width: 28, height: 28, borderRadius: 6, border: "0.5px solid #D3D1C7", background: "#fff", cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" };
